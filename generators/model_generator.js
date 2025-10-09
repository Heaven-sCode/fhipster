// generators/model_generator.js
// Emits lib/models/<entity>_model.dart
// - Fields for primitives + enums
// - Relationship fields per JHipster semantics:
//     * OneToOne / ManyToOne  -> TargetModel? field
//     * OneToMany / ManyToMany -> List<TargetModel>? field
//   Imports each target model once.
// - Tolerant fromJson (accepts nested object or *Id fields)
// - toJson respects Env.get().relationshipPayloadMode (idOnly|fullObject)
// - Includes copyWith()

const { jdlToDartType, normalizeJdlType } = require('../parser/type_mapping');
const { toFileName } = require('../utils/naming');

function lcFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
function modelImportPath(name) { return `../models/${toFileName(name)}_model.dart`; }
function enumImportPath(name) { return `../enums/${toFileName(name)}_enum.dart`; }

function generateModelTemplate(entityName, fields, parsedEnums) {
  const className = `${entityName}Model`;
  const instance = lcFirst(entityName);

  // Collect related targets and enums used
  const relationshipTargets = Array.from(new Set(
    fields.filter(f => f.isRelationship).map(f => f.targetEntity)
  ));

  const enumTypesUsed = Array.from(new Set(
    fields.filter(f => !f.isRelationship && parsedEnums?.[f.type]).map(f => f.type)
  ));

  // Imports
  const relImports = relationshipTargets.map(t => `import '${modelImportPath(t)}';`).join('\n');
  const enumImports = enumTypesUsed.map(e => `import '${enumImportPath(e)}';`).join('\n');

  // Properties
  const props = fields.map(f => {
    if (f.isRelationship) {
      const tModel = `${f.targetEntity}Model`;
      const kind = (f.relationshipType || '').toLowerCase();
      if (kind === 'onetomany' || kind === 'manytomany') {
        return `  final List<${tModel}>? ${f.name};`;
      }
      return `  final ${tModel}? ${f.name};`;
    }
    const dartType = jdlToDartType(f.type, parsedEnums);
    return `  final ${dartType}? ${f.name};`;
  }).join('\n');

  // Constructor params
  const ctorParams = fields.map(f => `    this.${f.name},`).join('\n');

  // fromJson builder
  const fromJsonLines = fields.map(f => {
    const n = f.name;
    if (f.isRelationship) {
      const tModel = `${f.targetEntity}Model`;
      const kind = (f.relationshipType || '').toLowerCase();
      if (kind === 'onetomany' || kind === 'manytomany') {
        // Accept list of maps or list of ids (fallback)
        return `    ${n}: (json['${n}'] is List)
        ? (json['${n}'] as List).whereType<dynamic>().map((e) {
            if (e is Map) return ${tModel}.fromJson(Map<String, dynamic>.from(e));
            // id fallback
            return ${tModel}(id: e);
          }).toList()
        : null,`;
      }
      // single: accept nested object or "<name>Id" fallback
      return `    ${n}: (json['${n}'] is Map)
        ? ${tModel}.fromJson(Map<String, dynamic>.from(json['${n}']))
        : (json['${n}Id'] != null ? ${tModel}(id: json['${n}Id']) : null),`;
    }

    // enums
    if (parsedEnums?.[f.type]) {
      const helper = lcFirst(f.type) + 'FromJson';
      return `    ${n}: ${helper}(json['${n}']),`;
    }

    const dartType = jdlToDartType(f.type, parsedEnums);
    if (dartType === 'DateTime') {
      const jdlType = normalizeJdlType(f.type);
      if (jdlType === 'zoneddatetime') {
        return `    ${n}: json['${n}'] != null ? DateTime.tryParse(json['${n}'].toString())?.toUtc() : null,`;
      }
      return `    ${n}: json['${n}'] != null ? DateTime.tryParse(json['${n}'].toString()) : null,`;
    }
    if (dartType === 'int') {
      return `    ${n}: json['${n}'] is int ? json['${n}'] : int.tryParse(json['${n}']?.toString() ?? ''),`;
    }
    if (dartType === 'double') {
      return `    ${n}: json['${n}'] is num ? (json['${n}'] as num).toDouble() : double.tryParse(json['${n}']?.toString() ?? ''),`;
    }
    if (dartType === 'bool') {
      return `    ${n}: json['${n}'] == true,`;
    }
    if (dartType === 'Duration') {
      // store as ISO-8601 duration string or seconds; try both
      return `    ${n}: _parseDuration(json['${n}']),`;
    }
    // default string/json
    if (dartType === 'Map<String, dynamic>') {
      return `    ${n}: json['${n}'] is Map ? Map<String, dynamic>.from(json['${n}']) : null,`;
    }
    return `    ${n}: json['${n}']?.toString(),`;
  }).join('\n');

  // toJson builder
  const toJsonLines = fields.map(f => {
    const n = f.name;
    if (f.isRelationship) {
      const kind = (f.relationshipType || '').toLowerCase();
      if (kind === 'onetomany' || kind === 'manytomany') {
        return `    '${n}': (() {
      final mode = Env.get().relationshipPayloadMode;
      if (${n} == null) return null;
      if (mode == RelationshipPayloadMode.idOnly) {
        return ${n}!.map((e) => {'id': e.id}).toList();
      }
      return ${n}!.map((e) => e.toJson()).toList();
    })(),`;
      }
      // single
      return `    '${n}': (() {
      final mode = Env.get().relationshipPayloadMode;
      if (${n} == null) return null;
      if (mode == RelationshipPayloadMode.idOnly) return {'id': ${n}!.id};
      return ${n}!.toJson();
    })(),`;
    }

    if (parsedEnums?.[f.type]) {
      return `    '${n}': ${n}?.value,`;
    }
    const dartType = jdlToDartType(f.type, parsedEnums);
    if (dartType === 'DateTime') {
      const jdlType = normalizeJdlType(f.type);
      if (jdlType === 'localdate') {
        return `    '${n}': ${n} != null ? DateFormat('yyyy-MM-dd').format(${n}!.toLocal()) : null,`;
      } else if (jdlType === 'zoneddatetime') {
        return `    '${n}': ${n} != null ? DateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").format(${n}!.toUtc()) : null,`;
      } else {
        // For Instant and other datetime types, send as ISO with Z
        return `    '${n}': ${n}?.toIso8601String(),`;
      }
    }
    if (dartType === 'Duration') {
      return `    '${n}': ${n}?.inSeconds,`;
    }
    // numbers/bool/string/json pass-through
    return `    '${n}': ${n},`;
  }).join('\n');

  // copyWith params
  const copyParams = fields.map(f => {
    if (f.isRelationship) {
      const tModel = `${f.targetEntity}Model`;
      const kind = (f.relationshipType || '').toLowerCase();
      if (kind === 'onetomany' || kind === 'manytomany') {
        return `    List<${tModel}>? ${f.name},`;
      }
      return `    ${tModel}? ${f.name},`;
    }
    const dartType = jdlToDartType(f.type, parsedEnums);
    return `    ${dartType}? ${f.name},`;
  }).join('\n');

  const copyBody = fields.map(f => `      ${f.name}: ${f.name} ?? this.${f.name},`).join('\n');

  const header = `/// Generated model for ${entityName}.
/// Relationships are typed per cardinality and serialized using Env.relationshipPayloadMode.
`;

  return `${header}import 'package:intl/intl.dart';
import '../core/env/env.dart';
${enumImports ? enumImports + '\n' : ''}${relImports ? relImports + '\n' : ''}

class ${className} {
${props}

  const ${className}({
${ctorParams}
  });

  ${className} copyWith({
${copyParams}
  }) {
    return ${className}(
${copyBody}
    );
  }

  factory ${className}.fromJson(Map<String, dynamic> json) => ${className}(
${fromJsonLines}
  );

  Map<String, dynamic> toJson() => {
${toJsonLines}
  };
}

// ----------------- helpers -----------------

Duration? _parseDuration(dynamic v) {
  if (v == null) return null;
  if (v is int) return Duration(seconds: v);
  if (v is String) {
    // try seconds
    final n = int.tryParse(v);
    if (n != null) return Duration(seconds: n);
    // TODO: parse ISO-8601 duration PnDTnHnMnS if needed
  }
  return null;
}
`;
}

module.exports = { generateModelTemplate };
