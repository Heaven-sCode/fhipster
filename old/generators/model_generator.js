const { jdlToDartType } = require('../parser');

/**
 * Generates the Dart code for an entity's data model class.
 * @param {string} entityName - The name of the entity (e.g., 'Car').
 * @param {Array<Object>} fields - The fields of the entity.
 * @param {object} parsedEnums - The object of all parsed enums.
 * @returns {string} The Dart code for the model class.
 */
function generateModelTemplate(entityName, fields, parsedEnums) {
    const className = `${entityName}Model`;

    const imports = new Set();
    fields.forEach(f => {
        if (f.isRelationship) {
            const targetModelBaseName = f.type.startsWith('List<') 
                ? f.type.substring(5, f.type.length - 1) 
                : f.type;
            imports.add(`import '../models/${targetModelBaseName.charAt(0).toLowerCase() + targetModelBaseName.slice(1)}_model.dart';`);
        } else if (parsedEnums[f.type]) {
            imports.add(`import '../enums/${f.type.charAt(0).toLowerCase() + f.type.slice(1)}_enum.dart';`);
        }
    });

    const fieldsDeclarations = fields
        .map(f => {
            const dartType = f.isRelationship ? f.type : jdlToDartType(f.type, parsedEnums);
            return `  final ${dartType}? ${f.name};`;
        })
        .join('\n');

    const constructorParams = fields
        .map(f => `    required this.${f.name},`)
        .join('\n');

    const fromJsonAssignments = fields
        .map(f => {
            const fieldName = f.name;
            const jdlType = f.type; 

            if (f.isRelationship) {
                const targetModelName = f.type.startsWith('List<') 
                    ? f.type.substring(5, f.type.length - 1)
                    : f.type;
                if (f.type.startsWith('List<')) {
                    return `      ${fieldName}: (json['${fieldName}'] as List<dynamic>?)?.map((e) => ${targetModelName}Model.fromJson(e as Map<String, dynamic>)).toList(),`;
                } else {
                    return `      ${fieldName}: json['${fieldName}'] != null ? ${targetModelName}Model.fromJson(json['${fieldName}']) : null,`;
                }
            } else if (parsedEnums[jdlType]) {
                return `      ${fieldName}: json['${fieldName}'] != null ? ${jdlType}.values.firstWhere((e) => e.toString().split('.').last == json['${fieldName}']) : null,`;
            } else if (jdlToDartType(jdlType, parsedEnums) === 'DateTime') {
                return `      ${fieldName}: json['${fieldName}'] != null ? DateTime.parse(json['${fieldName}']) : null,`;
            }
            return `      ${fieldName}: json['${fieldName}'],`;
        })
        .join('\n');

    const toJsonAssignments = fields
        .map(f => {
            const fieldName = f.name;
            const jdlType = f.type; 

            if (f.isRelationship) {
                if (f.type.startsWith('List<')) {
                    return `      '${fieldName}': ${fieldName}?.map((e) => e.toJson()).toList(),`;
                } else {
                    return `      '${fieldName}': ${fieldName}?.toJson(),`;
                }
            } else if (parsedEnums[jdlType]) {
                return `      '${fieldName}': ${fieldName}?.toString().split('.').last,`;
            } else if (jdlToDartType(jdlType, parsedEnums) === 'DateTime') {
                return `      '${fieldName}': ${fieldName}?.toIso8601String(),`;
            }
            return `      '${fieldName}': ${fieldName},`;
        })
        .join('\n');

    return `${Array.from(imports).sort().join('\n')}${imports.size > 0 ? '\n' : ''}class ${className} {
${fieldsDeclarations}

  ${className}({
${constructorParams}
  });

  factory ${className}.fromJson(Map<String, dynamic> json) {
    return ${className}(
${fromJsonAssignments}
    );
  }

  Map<String, dynamic> toJson() {
    return {
${toJsonAssignments}
    };
  }
}
`;
}

module.exports = { generateModelTemplate };
