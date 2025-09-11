// parser/relationship_mapping.js
// Normalizes relationship metadata on parsed entities in-place.
// This DOES NOT re-create relationships already materialized by the parser;
// it simply standardizes fields, marks collection/single cardinality, and
// links inverse fields when they exist.
//
// Shape expected for a relationship field (already added by parser/index.js):
//   {
//     name: 'customer' | 'orders' | ...,
//     isRelationship: true,
//     relationshipType: 'OneToOne' | 'ManyToOne' | 'OneToMany' | 'ManyToMany',
//     targetEntity: 'Customer' | 'Order' | ...,
//     // optional from parser: inverseField
//     // standard fields also allowed: required, nullable
//   }
//
// After normalization, each relationship field also has:
//   - relKind: 'O2O' | 'M2O' | 'O2M' | 'M2M'
//   - isCollection: boolean
//   - cardinality: { self: 'one'|'many', target: 'one'|'many' }
//   - targetEntityModel: '<Target>Model'
//   - inverse?: { entity: '<Target>', fieldName: '<inverseFieldName>' }  // only if found
//
// NOTE: This module is designed to be idempotent and safe to call even if
// the parser already injected both sides of a relationship.

function normalizeRelationships(entities, opts = {}) {
  const options = {
    // Only annotate; do not create missing inverse fields by default to avoid duplicates.
    addMissingInverse: false,
    ...opts,
  };

  const entityNames = Object.keys(entities);

  // 1) Standardize all rel fields on all entities
  for (const [entityName, fields] of Object.entries(entities)) {
    fields.forEach((f) => {
      if (!f || !f.isRelationship) return;

      // Normalize relationshipType token
      f.relationshipType = normalizeRelType(f.relationshipType);

      // Standard flags
      const kind = toKind(f.relationshipType);
      f.relKind = kind; // 'O2O' | 'M2O' | 'O2M' | 'M2M'

      const isColl = kind === 'O2M' || kind === 'M2M';
      f.isCollection = isColl;

      f.cardinality = {
        self: isColl ? 'many' : 'one',
        target: (kind === 'O2M' || kind === 'O2O') ? 'one' : 'many',
      };

      // Convenience: target model class name for codegen
      f.targetEntityModel = `${f.targetEntity}Model`;

      // Ensure basic flags exist
      if (typeof f.required !== 'boolean') f.required = false;
      if (typeof f.nullable !== 'boolean') f.nullable = !f.required;
    });
  }

  // 2) Link inverse fields when present (do NOT create by default)
  for (const [entityName, fields] of Object.entries(entities)) {
    fields.forEach((f) => {
      if (!f || !f.isRelationship) return;
      if (!f.targetEntity || !entities[f.targetEntity]) return;

      const inverse = findInverseField(entities, entityName, f);
      if (inverse) {
        f.inverse = { entity: f.targetEntity, fieldName: inverse.name };
        // Also mirror inverse.inverse if not set (optional)
        if (!inverse.inverse) {
          inverse.inverse = { entity: entityName, fieldName: f.name };
        }
      } else if (options.addMissingInverse) {
        // Optionally synthesize a missing inverse field (disabled by default).
        const invFieldName = suggestInverseFieldName(entityName, f);
        const invRelType = expectedInverseType(f.relationshipType);
        addInverseField(entities[f.targetEntity], {
          name: invFieldName,
          relationshipType: invRelType,
          targetEntity: entityName,
        });
        // re-link after adding
        const inverse2 = findInverseField(entities, entityName, f);
        if (inverse2) {
          f.inverse = { entity: f.targetEntity, fieldName: inverse2.name };
          inverse2.inverse = { entity: entityName, fieldName: f.name };
        }
      }
    });
  }

  return entities;
}

// ------------------- helpers -------------------

function normalizeRelType(t) {
  const v = String(t || '').toLowerCase();
  if (v === 'onetoone' || v === 'one-to-one' || v === 'o2o') return 'OneToOne';
  if (v === 'manytoone' || v === 'many-to-one' || v === 'm2o') return 'ManyToOne';
  if (v === 'onetomany' || v === 'one-to-many' || v === 'o2m') return 'OneToMany';
  if (v === 'manytomany' || v === 'many-to-many' || v === 'm2m') return 'ManyToMany';
  // default to ManyToOne (safer for UI forms)
  return 'ManyToOne';
}

function toKind(relType) {
  switch (normalizeRelType(relType)) {
    case 'OneToOne': return 'O2O';
    case 'ManyToOne': return 'M2O';
    case 'OneToMany': return 'O2M';
    case 'ManyToMany': return 'M2M';
    default: return 'M2O';
  }
}

function expectedInverseType(relType) {
  switch (normalizeRelType(relType)) {
    case 'OneToOne': return 'OneToOne';
    case 'ManyToOne': return 'OneToMany';
    case 'OneToMany': return 'ManyToOne';
    case 'ManyToMany': return 'ManyToMany';
    default: return 'ManyToOne';
  }
}

/**
 * Try to find a matching inverse field on the target entity.
 * Matching rules:
 *  - entity(target) must exist
 *  - relationshipType must be the expected inverse type (e.g., O2M <-> M2O)
 *  - targetEntity of that candidate must equal current entity
 * If multiple candidates exist, prefer exact inverse naming match if we have f.inverseField,
 * otherwise prefer a field whose name equals lcFirst(currentEntity) or pluralized version.
 */
function findInverseField(entities, currentEntity, field) {
  const targetName = field.targetEntity;
  const targetFields = entities[targetName] || [];
  const expType = expectedInverseType(field.relationshipType);

  const candidates = targetFields.filter((g) =>
    g.isRelationship &&
    normalizeRelType(g.relationshipType) === normalizeRelType(expType) &&
    String(g.targetEntity) === String(currentEntity)
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Heuristics: prefer names that resemble the expected defaults
  const want1 = lcFirst(currentEntity);
  const want2 = pluralize(want1);

  const byName = candidates.find((c) => c.name === want1) ||
                 candidates.find((c) => c.name === want2);
  return byName || candidates[0];
}

function addInverseField(targetFields, { name, relationshipType, targetEntity }) {
  if (!Array.isArray(targetFields)) return;
  const exists = targetFields.some((f) => f.isRelationship && f.name === name && f.targetEntity === targetEntity);
  if (exists) return;
  targetFields.push({
    name,
    type: 'relationship',
    isRelationship: true,
    relationshipType: normalizeRelType(relationshipType),
    targetEntity,
    required: false,
    nullable: true,
  });
}

function suggestInverseFieldName(currentEntity, field) {
  // If current side is ManyToOne, inverse is OneToMany -> likely plural of current entity on target.
  // Else fallback to lcFirst(target/current) heuristics.
  const type = normalizeRelType(field.relationshipType);
  if (type === 'ManyToOne') {
    return pluralize(lcFirst(currentEntity));
  }
  if (type === 'OneToMany') {
    return lcFirst(currentEntity);
  }
  if (type === 'ManyToMany') {
    // symmetrical: use plural on both
    return pluralize(lcFirst(currentEntity));
  }
  // OneToOne fallback
  return lcFirst(currentEntity);
}

function lcFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function pluralize(word) {
  if (!word) return word;
  // very naive pluralization; generator can override later via env plural overrides
  return word.endsWith('s') ? word : word + 's';
}

module.exports = {
  normalizeRelationships,
  normalizeRelType,
  toKind,
  expectedInverseType,
};
