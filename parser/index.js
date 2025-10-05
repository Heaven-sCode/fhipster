// parser/index.js
// Lightweight JDL parser -> { entities, enums }
// - Supports: entity blocks, enum blocks, relationship blocks (O2O/M2O/O2M/M2M)
// - Adds an implicit 'id' field to each entity if not declared
// - Embeds relationship fields directly into entities:
//     * OneToOne / ManyToOne  -> single object field on that side
//     * OneToMany / ManyToMany -> List<Target> field on that side
// - Each relationship field has:
//     { name, isRelationship: true, relationshipType, targetEntity, inverseField? }
// - Field shape for non-relations: { name, type, required?, nullable? }
//
// NOTE: jdlToDartType is handled elsewhere (parser/type_mapping.js).
// This file ONLY parses JDL text into a normalized JSON structure.

function parseJdl(jdlText) {
  const text = stripComments(jdlText);

  const enums = parseEnums(text);                // { EnumName: ['A','B'] }
  const entities = parseEntities(text);          // { EntityName: [ fields... ] }
  const rels = parseRelationships(text);         // [ {type, from, to, fromField?, toField?} ]

  // Ensure each entity has an 'id' field if not defined.
  for (const [name, fields] of Object.entries(entities)) {
    const hasId = fields.some(f => f.name.toLowerCase() === 'id');
    if (!hasId) {
      fields.unshift({
        name: 'id',
        type: 'Long',
        required: false,
        nullable: true,
        isRelationship: false,
      });
    }
  }

  // Materialize relationship fields onto entities
  applyRelationshipsToEntities(entities, rels);

  return { entities, enums };
}

// -------------------- Parsing helpers --------------------

function stripComments(s) {
  // remove /* ... */ and // ...
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n\r]*/g, '');
}

function parseEnums(text) {
  const enums = {};
  const re = /enum\s+([A-Za-z_]\w*)\s*\{\s*([^}]*)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim();
    const body = m[2];
    const vals = body
      .split(/[,;\n]/)
      .map(v => v.trim())
      .filter(v => v.length > 0);
    if (vals.length > 0) enums[name] = vals;
  }
  return enums;
}

function parseEntities(text) {
  const entities = {};
  const re = /((?:@[A-Za-z_][\w]*(?:\([^)]*\))?\s*)*)entity\s+([A-Za-z_]\w*)\s*\{\s*([^}]*)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const annotationsRaw = (m[1] || '').trim();
    const name = m[2].trim();
    const body = m[3] || '';
    const fields = [];

    body
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .forEach(line => {
        // fieldName Type [validations...]
        // e.g. name String required
        const fm = /^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)(?:\s+(.*))?$/.exec(line);
        if (!fm) return;
        const fname = fm[1].trim();
        const ftype = fm[2].trim();
        const flags = (fm[3] || '').trim();

        const required = /\brequired\b/i.test(flags);
        // nullable: if not required -> nullable true by default
        const nullable = !required;

        fields.push({
          name: fname,
          type: ftype,
          required,
          nullable,
          isRelationship: false,
        });
      });

    entities[name] = fields;

    if (/@EnableAudit\b/i.test(annotationsRaw)) {
      addAuditFields(fields);
    }
  }
  return entities;
}

function addAuditFields(fields) {
  const ensureField = (name, type) => {
    const exists = fields.some(f => f.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    fields.push({
      name,
      type,
      required: false,
      nullable: true,
      isRelationship: false,
      isAudit: true,
      readOnly: true,
    });
  };

  ensureField('createdBy', 'String');
  ensureField('createdDate', 'Instant');
  ensureField('lastModifiedBy', 'String');
  ensureField('lastModifiedDate', 'Instant');
}

function parseRelationships(text) {
  // relationship OneToMany { A{a} to B{b} }
  // relationship ManyToOne { Order{customer} to Customer }
  // relationship OneToOne   { User to Profile{user} }
  // relationship ManyToMany { Tag{posts} to Post{tags} }
  const rels = [];
  const blockRe = /relationship\s+([A-Za-z]+)\s*\{/g;
  let bm;
  while ((bm = blockRe.exec(text)) !== null) {
    const type = bm[1].trim();
    let bodyStart = blockRe.lastIndex;
    let i = bodyStart;
    let depth = 1;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) {
      // malformed block; skip to avoid infinite loop
      break;
    }
    const bodyEnd = i - 1;
    const body = text.slice(bodyStart, bodyEnd);
    blockRe.lastIndex = i;

    const lines = body.split(/\r?\n|,/).map(l => l.trim()).filter(Boolean);

    lines.forEach(line => {
      // A{foo(bar)} to B{baz}
      const rm = /^([A-Za-z_]\w*)(?:\{([^}]*)\})?\s+to\s+([A-Za-z_]\w*)(?:\{([^}]*)\})?;?$/.exec(line);
      if (!rm) return;
      const from = rm[1].trim();
      const fromSpec = (rm[2] || '').trim(); // may contain fieldName or fieldName(display)
      const to = rm[3].trim();
      const toSpec = (rm[4] || '').trim();

      const fromField = extractInjectedField(fromSpec); // { name, display? }
      const toField = extractInjectedField(toSpec);

      rels.push({
        type, from, to,
        fromField: fromField?.name,
        toField: toField?.name,
      });
    });
  }
  return rels;
}

function extractInjectedField(spec) {
  if (!spec) return null;
  // patterns:
  //   "orders"
  //   "customer(name)"
  //   "customer()"
  const m = /^([A-Za-z_]\w*)(?:\([^)]*\))?$/.exec(spec);
  if (!m) return null;
  return { name: m[1].trim() };
}

function applyRelationshipsToEntities(entities, rels) {
  for (const r of rels) {
    const t = r.type.toLowerCase();

    if (!entities[r.from] || !entities[r.to]) continue;

    if (t === 'onetomany') {
      // From: collection of To
      addRelField(entities[r.from], {
        name: r.fromField || pluralize(lcFirst(r.to)),
        relationshipType: 'OneToMany',
        targetEntity: r.to,
      });

      // To: single From
      addRelField(entities[r.to], {
        name: r.toField || lcFirst(r.from),
        relationshipType: 'ManyToOne',
        targetEntity: r.from,
      });

    } else if (t === 'manytoone') {
      // From: single To
      addRelField(entities[r.from], {
        name: r.fromField || lcFirst(r.to),
        relationshipType: 'ManyToOne',
        targetEntity: r.to,
      });

      // To: optional backref collection
      if (r.toField) {
        addRelField(entities[r.to], {
          name: r.toField,
          relationshipType: 'OneToMany',
          targetEntity: r.from,
        });
      }

    } else if (t === 'onetoone') {
      // Single on both sides; only create when field name provided, otherwise create on "from"
      addRelField(entities[r.from], {
        name: r.fromField || lcFirst(r.to),
        relationshipType: 'OneToOne',
        targetEntity: r.to,
      });

      if (r.toField) {
        addRelField(entities[r.to], {
          name: r.toField,
          relationshipType: 'OneToOne',
          targetEntity: r.from,
        });
      }

    } else if (t === 'manytomany') {
      // Collections on both sides
      addRelField(entities[r.from], {
        name: r.fromField || pluralize(lcFirst(r.to)),
        relationshipType: 'ManyToMany',
        targetEntity: r.to,
      });

      addRelField(entities[r.to], {
        name: r.toField || pluralize(lcFirst(r.from)),
        relationshipType: 'ManyToMany',
        targetEntity: r.from,
      });
    }
  }
}

function addRelField(fields, rel) {
  // Avoid duplicates
  if (fields.some(f => f.name === rel.name && f.isRelationship)) return;
  fields.push({
    name: rel.name,
    type: 'relationship',
    isRelationship: true,
    relationshipType: rel.relationshipType,
    targetEntity: rel.targetEntity,
    nullable: true,
    required: false,
  });
}

// -------------------- tiny utils --------------------

function lcFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function pluralize(word) {
  // naive pluralization: add 's' if not ending with s
  if (!word) return word;
  return word.endsWith('s') ? word : word + 's';
}

module.exports = {
  parseJdl,
};
