#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Global variable to store parsed enums for jdlToDartType lookup
let parsedEnums = {};

function jdlToDartType(jdlType) {
    const typeMapping = {
        'String': 'String',
        'Integer': 'int',
        'Long': 'int',
        'Float': 'double',
        'Double': 'double',
        'BigDecimal': 'double',
        'LocalDate': 'DateTime',
        'Instant': 'DateTime',
        'ZonedDateTime': 'DateTime',
        'Boolean': 'bool',
        'UUID': 'String'
    };
    // Check for List<EnumType> or List<EntityType>
    const listMatch = jdlType.match(/^List<(\w+)>$/);
    if (listMatch) {
        const innerType = listMatch[1];
        // If the inner type is a known enum, return List<EnumName>
        if (parsedEnums[innerType]) {
            return `List<${innerType}>`;
        }
        // For relationships, the type is already correctly passed as List<EntityName>
        // and handled in generateModelTemplate, so no need to map here.
    }

    // If the jdlType matches a parsed enum name, return the enum name
    if (parsedEnums[jdlType]) {
        return jdlType;
    }
    return typeMapping[jdlType] || 'dynamic';
}

function parseJdl(jdlContent) {
    const entities = {};
    parsedEnums = {}; // Reset parsed enums for each parse operation

    // Regex to capture enum definitions
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(jdlContent)) !== null) {
        const enumName = enumMatch[1];
        const rawValuesStr = enumMatch[2].trim();
        // Split values by comma, trim, and remove any descriptions in parentheses
        const values = rawValuesStr.split(',')
            .map(val => val.trim().split('(')[0].trim()) // Remove (description) and trim
            .filter(val => val.length > 0);
        parsedEnums[enumName] = values;
    }

    // Parse entities first, without relationships
    const entityRegex = /(@\w+\s*)*entity\s+(\w+)\s*\{([^}]+)\}/g;
    let entityMatch;
    while ((entityMatch = entityRegex.exec(jdlContent)) !== null) {
        const annotations = entityMatch[1] || ''; // Get the captured annotations string
        const entityName = entityMatch[2];
        let rawFieldsStr = entityMatch[3]; // Get the raw string inside the entity block

        // Step 1: Remove multi-line comments /* ... */
        let cleanedFieldsStr = rawFieldsStr.replace(/\/\*[\s\S]*?\*\//g, '');

        // Step 2: Remove single-line comments // ... to end of line, globally and across multiple lines
        cleanedFieldsStr = cleanedFieldsStr.replace(/\/\/.*$/gm, '');

        // Step 3: Trim whitespace from each line and filter out empty lines
        const lines = cleanedFieldsStr.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const fields = [];
        // Regex to capture fieldName and Type, anchored to the start of the line.
        const fieldLineRegex = /^(\w+)\s+([\w<>]+)/; 

        for (const line of lines) {
            const fieldMatch = line.match(fieldLineRegex);
            if (fieldMatch) {
                fields.push({ name: fieldMatch[1], type: fieldMatch[2], isRelationship: false });
            }
        }

        // Check if the @EnableAudit annotation is present for this entity
        if (annotations.includes('@EnableAudit')) {
            // Add the four audit fields if @EnableAudit is found
            fields.push(
                { name: 'lastModifiedDate', type: 'Instant', isRelationship: false }, // JDL Instant maps to Dart DateTime
                { name: 'lastModifiedBy', type: 'String', isRelationship: false },
                { name: 'createdDate', type: 'Instant', isRelationship: false },     // JDL Instant maps to Dart DateTime
                { name: 'createdBy', type: 'String', isRelationship: false }
            );
        }
        entities[entityName] = fields; // Store fields temporarily
    }

    // Now parse relationships and add them to the respective entity fields
    // Corrected Regex for JDL relationships: relationship <type> { <from entity>[(<from field>)] to <to entity>[(<to field>)] [options] }
    const relationshipRegex = /relationship\s+(OneToOne|ManyToOne|OneToMany|ManyToMany)\s*\{\s*(\w+)(?:\((\w+)\))?\s+to\s+(\w+)(?:\((\w+)\))?\s*(?:(?:required|with\s+jpaDerivedIdentifier|id)\s*)*\}/g;
    let relationshipMatch;

    // Reset the regex lastIndex before re-executing
    relationshipRegex.lastIndex = 0;

    while ((relationshipMatch = relationshipRegex.exec(jdlContent)) !== null) {
        const relationshipType = relationshipMatch[1];
        const fromEntityName = relationshipMatch[2]; // This is the source entity in the JDL definition
        const fromFieldOnFromEntity = relationshipMatch[3]; // Field name on the 'from' entity (e.g., Driver(cars))
        const toEntityName = relationshipMatch[4];   // This is the target entity in the JDL definition
        const toFieldOnToEntity = relationshipMatch[5];   // Field name on the 'to' entity (e.g., Car(driver))

        // Ensure both entities exist before trying to add fields
        if (!entities[fromEntityName] || !entities[toEntityName]) {
            console.warn(`Warning: Relationship involves undefined entity. Skipping: ${relationshipMatch[0]}`);
            continue;
        }

        // --- Add field to the 'from' entity (the source of the relationship) ---
        let fromFieldName;
        let fromFieldType;

        if (relationshipType === 'OneToMany' || relationshipType === 'ManyToMany') {
            fromFieldType = `List<${toEntityName}>`;
            fromFieldName = fromFieldOnFromEntity || (toEntityName.charAt(0).toLowerCase() + toEntityName.slice(1) + 's');
        } else { // OneToOne, ManyToOne
            fromFieldType = toEntityName;
            fromFieldName = fromFieldOnFromEntity || (toEntityName.charAt(0).toLowerCase() + toEntityName.slice(1));
        }
        // Check if the field already exists to avoid duplicates (important for bidirectional relationships)
        if (!entities[fromEntityName].some(field => field.name === fromFieldName)) {
            entities[fromEntityName].push({
                name: fromFieldName,
                type: fromFieldType,
                isRelationship: true,
                relationshipType: relationshipType, // Original relationship type
                targetEntity: toEntityName, // The model this field represents
            });
        }


        // --- Add field to the 'to' entity (the target of the relationship) ---
        let toFieldName;
        let toFieldType;

        // Determine the inverse relationship type from the perspective of the 'to' entity
        let inverseRelationshipType;
        if (relationshipType === 'OneToOne') {
            inverseRelationshipType = 'OneToOne';
        } else if (relationshipType === 'ManyToOne') {
            inverseRelationshipType = 'OneToMany'; // A ManyToOne from A to B means B has OneToMany to A
        } else if (relationshipType === 'OneToMany') {
            inverseRelationshipType = 'ManyToOne'; // A OneToMany from A to B means B has ManyToOne to A
        } else if (relationshipType === 'ManyToMany') {
            inverseRelationshipType = 'ManyToMany';
        }

        if (inverseRelationshipType === 'OneToMany' || inverseRelationshipType === 'ManyToMany') {
            toFieldType = `List<${fromEntityName}>`;
            toFieldName = toFieldOnToEntity || (fromEntityName.charAt(0).toLowerCase() + fromEntityName.slice(1) + 's');
        } else { // OneToOne, ManyToOne
            toFieldType = fromEntityName;
            toFieldName = toFieldOnToEntity || (fromEntityName.charAt(0).toLowerCase() + fromEntityName.slice(1));
        }

        // Check if the field already exists to avoid duplicates
        if (!entities[toEntityName].some(field => field.name === toFieldName)) {
            entities[toEntityName].push({
                name: toFieldName,
                type: toFieldType,
                isRelationship: true,
                relationshipType: inverseRelationshipType, // Use inverse relationship type here
                targetEntity: fromEntityName, // The model this field represents
            });
        }
    }

    return { entities, enums: parsedEnums };
}

function generateModelTemplate(entityName, fields) {
    const className = `${entityName}Model`;

    // Collect unique imports for related models and enums
    const imports = new Set();
    fields.forEach(f => {
        if (f.isRelationship) {
            // Assuming related models are in '../models/'
            // Extract the base entity name if it's a List<Entity>
            const targetModelBaseName = f.type.startsWith('List<') 
                ? f.type.substring(5, f.type.length - 1) 
                : f.type;
            imports.add(`import '../models/${targetModelBaseName.charAt(0).toLowerCase() + targetModelBaseName.slice(1)}_model.dart';`);
        } else if (parsedEnums[f.type]) {
            // Assuming enums are in '../enums/'
            imports.add(`import '../enums/${f.type.charAt(0).toLowerCase() + f.type.slice(1)}_enum.dart';`);
        }
    });

    const fieldsDeclarations = fields
        .map(f => {
            // For relationships, use the actual type (e.g., List<TargetModel> or TargetModel)
            const dartType = f.isRelationship ? f.type : jdlToDartType(f.type);
            return `  final ${dartType}? ${f.name};`;
        })
        .join('\n');

    const constructorParams = fields
        .map(f => `    this.${f.name},`)
        .join('\n');

    const fromJsonAssignments = fields
        .map(f => {
            const fieldName = f.name;
            const jdlType = f.type; 

            if (f.isRelationship) {
                const targetModelName = f.type.startsWith('List<') 
                    ? f.type.substring(5, f.type.length - 1) // Extract type inside List<>
                    : f.type;
                if (f.type.startsWith('List<')) { // List relationship (OneToMany, ManyToMany)
                    return `      ${fieldName}: (json['${fieldName}'] as List<dynamic>?)?.map((e) => ${targetModelName}Model.fromJson(e as Map<String, dynamic>)).toList(),`;
                } else { // Single relationship (OneToOne, ManyToOne)
                    return `      ${fieldName}: json['${fieldName}'] != null ? ${targetModelName}Model.fromJson(json['${fieldName}']) : null,`;
                }
            } else if (parsedEnums[jdlType]) { // Handle enum types
                return `      ${fieldName}: json['${fieldName}'] != null ? ${jdlType}.values.firstWhere((e) => e.toString().split('.').last == json['${fieldName}']) : null,`;
            } else if (jdlToDartType(jdlType) === 'DateTime') { // Handle DateTime
                return `      ${fieldName}: json['${fieldName}'] != null ? DateTime.parse(json['${fieldName}']) : null,`;
            }
            // Default for primitive types (String, int, double, bool, UUID)
            return `      ${fieldName}: json['${fieldName}'],`;
        })
        .join('\n');

    const toJsonAssignments = fields
        .map(f => {
            const fieldName = f.name;
            const jdlType = f.type; 

            if (f.isRelationship) {
                if (f.type.startsWith('List<')) { // List relationship
                    return `      '${fieldName}': ${fieldName}?.map((e) => e.toJson()).toList(),`;
                } else { // Single relationship
                    return `      '${fieldName}': ${fieldName}?.toJson(),`;
                }
            } else if (parsedEnums[jdlType]) { // Handle enum types
                return `      '${fieldName}': ${fieldName}?.toString().split('.').last,`;
            } else if (jdlToDartType(jdlType) === 'DateTime') { // Handle DateTime
                return `      '${fieldName}': ${fieldName}?.toIso8601String(),`;
            }
            // Default for primitive types
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

/**
 * Converts a camelCase string to kebab-case.
 * @param {string} camelCaseString - The string in camelCase.
 * @returns {string} The string in kebab-case.
 */
function camelToKebabCase(camelCaseString) {
    return camelCaseString.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Generates the content for a GetX service file.
 * @param {string} entityName - The name of the entity.
 * @param {string} microserviceName - The name of the microservice.
 * @param {string} apiHost - The base host for the API (e.g., 'https://api.yourapp.com').
 * @returns {string} The Dart code for the service.
 */
function generateServiceTemplate(entityName, microserviceName, apiHost) {
    const modelClassName = `${entityName}Model`;
    const serviceClassName = `${entityName}Service`;
    const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    
    // First, determine the pluralized camelCase endpoint name
    let pluralCamelCaseEndpoint = instanceName.endsWith('y') 
        ? `${instanceName.slice(0, -1)}ies` 
        : `${instanceName}s`;

    // Then, convert the pluralized camelCase name to kebab-case
    const endpointName = camelToKebabCase(pluralCamelCaseEndpoint);

    // Construct the base URL using the provided apiHost
    const baseUrl = `'${apiHost}/services/${microserviceName}/api'`;
    const searchUrl = `'${apiHost}/services/${microserviceName}/api/${endpointName}/_search'`;


    return `import 'package:get/get.dart';
import '../models/${instanceName}_model.dart';

class ${serviceClassName} extends GetxService {
  final _apiClient = GetConnect(timeout: Duration(seconds: 30));
  // IMPORTANT: Replace the host part if 'apiHost' argument was not used, or adjust as needed.
  final String _baseUrl = ${baseUrl};
  final String _searchUrl = ${searchUrl}; // JHipster search endpoint

  @override
  void onInit() {
    _apiClient.baseUrl = _baseUrl;
    super.onInit();
  }

  // Corresponds to JHipster's create
  Future<${modelClassName}> create(${modelClassName} ${instanceName}) async {
    final response = await _apiClient.post('/${endpointName}', ${instanceName}.toJson());
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  // Corresponds to JHipster's update
  Future<${modelClassName}> update(${modelClassName} ${instanceName}) async {
    if (${instanceName}.id == null) {
      return Future.error("Cannot update a model without an ID. Ensure your JDL includes 'id Long' for updatable entities.");
    }
    final response = await _apiClient.put('/${endpointName}/${'$'}{${instanceName}.id}', ${instanceName}.toJson());
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  // Corresponds to JHipster's partialUpdate
  Future<${modelClassName}> partialUpdate(${modelClassName} ${instanceName}) async {
    if (${instanceName}.id == null) {
      return Future.error("Cannot partially update a model without an ID. Ensure your JDL includes 'id Long' for updatable entities.");
    }
    final response = await _apiClient.patch('/${endpointName}/${'$'}{${instanceName}.id}', ${instanceName}.toJson());
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  // Corresponds to JHipster's find
  Future<${modelClassName}> find(int id) async {
    final response = await _apiClient.get('/${endpointName}/$id');
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  // Corresponds to JHipster's query (getAll with optional request parameters)
  Future<List<${modelClassName}>> query({Map<String, dynamic>? req}) async {
    final response = await _apiClient.get('/${endpointName}', query: req);
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return (response.body as List).map((json) => ${modelClassName}.fromJson(json)).toList();
  }

  // Corresponds to JHipster's delete
  Future<void> delete(int id) async {
    final response = await _apiClient.delete('/${endpointName}/$id');
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
  }

  // Corresponds to JHipster's search
  Future<List<${modelClassName}>> search({required Map<String, dynamic> req}) async {
    final response = await _apiClient.get(_searchUrl, query: req);
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return (response.body as List).map((json) => ${modelClassName}.fromJson(json)).toList();
  }
}
`;
}

/**
 * Generates the content for a Dart GetX form file.
 * @param {string} entityName - The name of the entity.
 * @param {Array<Object>} fields - The fields of the entity.
 * @returns {string} The Dart code for the form.
 */
function generateFormTemplate(entityName, fields) {
    const modelClassName = `${entityName}Model`;
    const formClassName = `${entityName}Form`;
    const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);

    // Generate controller declarations and initializations
    const controllerDeclarations = fields.map(f => {
        const dartType = jdlToDartType(f.type);
        const fieldName = f.name;
        if (f.isRelationship) {
            // For relationships, we won't generate a direct controller for now
            return ''; 
        } else if (dartType === 'bool') {
            return `  late bool _${fieldName}Value;`;
        } else if (parsedEnums[f.type]) { // For enum fields
            return `  ${f.type}? _${fieldName}Value;`;
        }
        return `  late final TextEditingController _${fieldName}Controller;`;
    }).filter(line => line.length > 0).join('\n'); // Filter out empty lines

    const controllerInitializations = fields.map(f => {
        const dartType = jdlToDartType(f.type);
        const fieldName = f.name;
        if (f.isRelationship) {
            return '';
        } else if (dartType === 'bool') {
            return `    _${fieldName}Value = widget.initialData?.${fieldName} ?? false;`;
        } else if (parsedEnums[f.type]) { // For enum fields
            return `    _${fieldName}Value = widget.initialData?.${fieldName};`;
        } else if (dartType === 'DateTime') {
            return `    _${fieldName}Controller = TextEditingController(text: widget.initialData?.${fieldName}?.toIso8601String() ?? '');`;
        }
        return `    _${fieldName}Controller = TextEditingController(text: widget.initialData?.${fieldName}?.toString() ?? '');`;
    }).filter(line => line.length > 0).join('\n');

    const controllerDisposals = fields.map(f => {
        const dartType = jdlToDartType(f.type);
        const fieldName = f.name;
        if (f.isRelationship) {
            return '';
        } else if (dartType !== 'bool' && !parsedEnums[f.type]) { // Only dispose TextEditingControllers
            return `    _${fieldName}Controller.dispose();`;
        }
        return '';
    }).filter(line => line.length > 0).join('\n');

    // Generate form fields (TextFormField, CheckboxListTile, DropdownButtonFormField)
    const formFields = fields.map(f => {
        const dartType = jdlToDartType(f.type);
        const fieldName = f.name;
        const labelText = fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // Convert camelCase to "Camel Case"

        if (f.isRelationship) {
            return `
            // TODO: Implement UI for relationship '${fieldName}' (${f.relationshipType} to ${f.targetEntity})
            // This typically involves a DropdownButton for ManyToOne/OneToOne, or a multi-select for ManyToMany/OneToMany.
            // You will need to fetch data for ${f.targetEntity}Model and manage selection.
            TextFormField(
              decoration: InputDecoration(
                labelText: '${labelText} (Relationship - Manual Implementation Needed)',
                border: OutlineInputBorder(),
              ),
              enabled: false, // Disable for now as it needs custom logic
              controller: TextEditingController(text: 'Relationship: ${f.relationshipType} to ${f.targetEntity}'),
            ),`;
        } else if (dartType === 'bool') {
            return `
          CheckboxListTile(
            title: Text('${labelText}'),
            value: _${fieldName}Value,
            onChanged: (bool? newValue) {
              setState(() {
                _${fieldName}Value = newValue ?? false;
              });
            },
            controlAffinity: ListTileControlAffinity.leading,
          ),`;
        } else if (parsedEnums[f.type]) { // For enum fields
            const enumValues = parsedEnums[f.type].map(val => `${f.type}.${val.toUpperCase()}`).join(',\n              '); 
            return `
          DropdownButtonFormField<${f.type}>(
            value: _${fieldName}Value,
            decoration: InputDecoration(
              labelText: '${labelText}',
              border: OutlineInputBorder(),
            ),
            items: <${f.type}>[
              ${enumValues}
            ].map<DropdownMenuItem<${f.type}>>((${f.type} value) {
              return DropdownMenuItem<${f.type}>(
                value: value,
                child: Text(value.toString().split('.').last), // Display enum value as string
              );
            }).toList(),
            onChanged: (${f.type}? newValue) {
              setState(() {
                _${fieldName}Value = newValue;
              });
            },
            validator: (value) {
              if (value == null) {
                return 'Please select a ${labelText.toLowerCase()}';
              }
              return null;
            },
          ),`;
        } else if (dartType === 'DateTime') {
            return `
          TextFormField(
            controller: _${fieldName}Controller,
            decoration: InputDecoration(
              labelText: '${labelText} (YYYY-MM-DDTHH:MM:SSZ)', // Suggest ISO 8601 format
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.datetime,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter ${labelText.toLowerCase()}';
              }
              // Basic validation for DateTime string
              try {
                DateTime.parse(value);
              } catch (e) {
                return 'Invalid date format. Use YYYY-MM-DDTHH:MM:SSZ';
              }
              return null;
            },
          ),`;
        } else if (dartType === 'int' || dartType === 'double') {
            return `
          TextFormField(
            controller: _${fieldName}Controller,
            decoration: InputDecoration(
              labelText: '${labelText}',
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter ${labelText.toLowerCase()}';
              }
              if (double.tryParse(value) == null) {
                return 'Please enter a valid number';
              }
              return null;
            },
          ),`;
        } else { // String and UUID (treated as String)
            return `
          TextFormField(
            controller: _${fieldName}Controller,
            decoration: InputDecoration(
              labelText: '${labelText}',
              border: OutlineInputBorder(),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter ${labelText.toLowerCase()}';
              }
              return null;
            },
          ),`;
        }
    }).join('\n\n');

    // Logic to construct the model from controller values
    const modelConstruction = fields.map(f => {
        const dartType = jdlToDartType(f.type);
        const fieldName = f.name;
        if (f.isRelationship) {
            // For relationships, we cannot construct directly from form fields.
            // This part will need manual adjustment based on how you implement relationship selection.
            // For now, we'll assume it's handled externally or left null.
            return `      // ${fieldName}: /* Handle ${f.relationshipType} relationship with ${f.targetEntity} manually */,`;
        } else if (dartType === 'bool') {
            return `      ${fieldName}: _${fieldName}Value,`;
        } else if (parsedEnums[f.type]) { // For enum fields
            return `      ${fieldName}: _${fieldName}Value,`;
        } else if (dartType === 'DateTime') {
            return `      ${fieldName}: DateTime.tryParse(_${fieldName}Controller.text),`;
        } else if (dartType === 'int') {
            return `      ${fieldName}: int.tryParse(_${fieldName}Controller.text),`;
        } else if (dartType === 'double') {
            return `      ${fieldName}: double.tryParse(_${fieldName}Controller.text),`;
        } else { // String and UUID
            return `      ${fieldName}: _${fieldName}Controller.text,`;
        }
    }).join('\n');

    // Import necessary enum models
    const enumImports = fields
        .filter(f => parsedEnums[f.type])
        .map(f => `import '../enums/${f.type.charAt(0).toLowerCase() + f.type.slice(1)}_enum.dart';`)
        .filter((value, index, self) => self.indexOf(value) === index) // Ensure unique imports
        .join('\n');

    return `import 'package:flutter/material.dart';
import '../models/${instanceName}_model.dart';
${enumImports.length > 0 ? enumImports + '\n' : ''}
class ${formClassName} extends StatefulWidget {
  final ${modelClassName}? initialData;
  final Function(${modelClassName}) onSubmit;

  const ${formClassName}({
    Key? key,
    this.initialData,
    required this.onSubmit,
  }) : super(key: key);

  @override
  State<${formClassName}> createState() => _${formClassName}State();
}

class _${formClassName}State extends State<${formClassName}> {
  final _formKey = GlobalKey<FormState>();

${controllerDeclarations}

  @override
  void initState() {
    super.initState();
${controllerInitializations}
  }

  @override
  void dispose() {
${controllerDisposals}
    super.dispose();
  }

  void _submitForm() {
    if (_formKey.currentState?.validate() ?? false) {
      final ${instanceName} = ${modelClassName}(
${modelConstruction}
      );
      widget.onSubmit(${instanceName});
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // Form Fields
${formFields}
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _submitForm,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16.0),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8.0),
                ),
              ),
              child: Text(
                widget.initialData == null ? 'Create ${entityName}' : 'Update ${entityName}',
                style: const TextStyle(fontSize: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
`;
}

/**
 * Generates the content for a Dart enum file.
 * @param {string} enumName - The name of the enum.
 * @param {Array<string>} values - The values of the enum.
 * @returns {string} The Dart code for the enum.
 */
function generateEnumTemplate(enumName, values) {
    // Convert all enum values to uppercase
    const enumValues = values.map(val => `  ${val.toUpperCase()}`).join(',\n'); 

    return `enum ${enumName} {
${enumValues}
}
`;
}


function main() {
    const argv = yargs(hideBin(process.argv))
        .usage('Usage: $0 <jdlFile> --microservice <name> [--apiHost <host>] [outputDir]')
        .demandCommand(1, 'You must provide the path to the JDL file.')
        .option('microservice', {
            alias: 'm',
            description: 'The name of the microservice (e.g., dms).',
            type: 'string',
            demandOption: true,
        })
        .option('apiHost', {
            alias: 'a',
            description: 'The base host for the API (e.g., https://your-domain.com). Defaults to https://api.yourapp.com.',
            type: 'string',
            default: 'https://api.yourapp.com', // Default API host
        })
        .help('h')
        .alias('h', 'help')
        .argv;

    const jdlFilePath = argv._[0];
    const microserviceName = argv.microservice;
    const apiHost = argv.apiHost; // Get the apiHost from arguments
    const outputDir = argv._[1] || 'flutter_generated';

    if (!fs.existsSync(jdlFilePath)) {
        console.error(`Error: JDL file not found at '${jdlFilePath}'`);
        process.exit(1);
    }

    const jdlContent = fs.readFileSync(jdlFilePath, 'utf8');
    const { entities, enums } = parseJdl(jdlContent); // Destructure to get both entities and enums

    if (Object.keys(entities).length === 0 && Object.keys(enums).length === 0) {
        console.log('No entities or enums found in the JDL file.');
        return;
    }

    const modelsDir = path.join(outputDir, 'models');
    const servicesDir = path.join(outputDir, 'services');
    const formsDir = path.join(outputDir, 'forms');
    const enumsDir = path.join(outputDir, 'enums'); // New enums directory

    fs.mkdirSync(modelsDir, { recursive: true });
    fs.mkdirSync(servicesDir, { recursive: true });
    fs.mkdirSync(formsDir, { recursive: true });
    fs.mkdirSync(enumsDir, { recursive: true }); // Create enums directory

    console.log(`Generating files in '${outputDir}' directory for microservice '${microserviceName}' with API host '${apiHost}'...`);

    // Generate Enum files
    for (const [enumName, values] of Object.entries(enums)) {
        console.log(`- Processing enum: ${enumName}`);
        const enumContent = generateEnumTemplate(enumName, values);
        const enumPath = path.join(enumsDir, `${enumName.charAt(0).toLowerCase() + enumName.slice(1)}_enum.dart`);
        fs.writeFileSync(enumPath, enumContent);
    }

    // Generate Entity Models, Services, and Forms
    for (const [entityName, fields] of Object.entries(entities)) {
        console.log(`- Processing entity: ${entityName}`);
        
        const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
        
        // Generate and write model file
        const modelContent = generateModelTemplate(entityName, fields);
        const modelPath = path.join(modelsDir, `${instanceName}_model.dart`);
        fs.writeFileSync(modelPath, modelContent);

        // Generate and write service file
        const serviceContent = generateServiceTemplate(entityName, microserviceName, apiHost);
        const servicePath = path.join(servicesDir, `${instanceName}_service.dart`);
        fs.writeFileSync(servicePath, serviceContent);

        // Generate and write form file
        const formContent = generateFormTemplate(entityName, fields);
        const formPath = path.join(formsDir, `${instanceName}_form.dart`);
        fs.writeFileSync(formPath, formContent);
    }

    console.log('\n✅ Generation complete!');
    console.log('Next steps:');
    console.log(`1. Copy the '${outputDir}' folder into your Flutter project's 'lib' directory.`);
    console.log("2. Add 'get' to your 'pubspec.yaml': dependencies:\n     get: ^4.6.5");
    console.log("3. IMPORTANT: The '_baseUrl' in your generated service files is now set to include your microservice name and the specified API host.");
    console.log("4. Register your services in your GetX dependency injection setup.");
    console.log("5. Integrate the generated form widgets into your Flutter UI, passing an 'initialData' model for editing or 'null' for creation, and providing an 'onSubmit' callback.");
}

main();
