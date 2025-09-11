#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

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
    return typeMapping[jdlType] || 'dynamic';
}

function parseJdl(jdlContent) {
    const entities = {};
    // Updated regex to capture optional annotations before the entity definition
    // match[1] will contain the annotation string (e.g., "@EnableAudit ") if present
    // match[2] will be the entity name
    // match[3] will be the raw fields string inside the entity block
    const entityRegex = /(@\w+\s*)*entity\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = entityRegex.exec(jdlContent)) !== null) {
        const annotations = match[1] || ''; // Get the captured annotations string
        const entityName = match[2];
        let rawFieldsStr = match[3]; // Get the raw string inside the entity block

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
                // fieldMatch[1] is the field name, fieldMatch[2] is the JDL type
                fields.push({ name: fieldMatch[1], type: fieldMatch[2] });
            }
        }

        // Check if the @EnableAudit annotation is present for this entity
        if (annotations.includes('@EnableAudit')) {
            // Add the four audit fields if @EnableAudit is found
            fields.push(
                { name: 'lastModifiedDate', type: 'Instant' }, // JDL Instant maps to Dart DateTime
                { name: 'lastModifiedBy', type: 'String' },
                { name: 'createdDate', type: 'Instant' },     // JDL Instant maps to Dart DateTime
                { name: 'createdBy', type: 'String' }
            );
        }

        entities[entityName] = fields;
    }
    return entities;
}

function generateModelTemplate(entityName, fields) {
    const className = `${entityName}Model`;
    const fieldsDeclarations = fields
        .map(f => `  final ${jdlToDartType(f.type)}? ${f.name};`)
        .join('\n');

    const constructorParams = fields
        .map(f => `    this.${f.name},`)
        .join('\n');

    const fromJsonAssignments = fields
        .map(f => {
            const fieldName = f.name;
            const dartType = jdlToDartType(f.type);
            if (dartType === 'DateTime') {
                return `      ${fieldName}: json['${fieldName}'] != null ? DateTime.parse(json['${fieldName}']) : null,`;
            }
            return `      ${fieldName}: json['${fieldName}'],`;
        })
        .join('\n');

    const toJsonAssignments = fields
        .map(f => {
            const fieldName = f.name;
            const dartType = jdlToDartType(f.type);
            if (dartType === 'DateTime') {
                return `      '${fieldName}': ${fieldName}?.toIso8601String(),`;
            }
            return `      '${fieldName}': ${fieldName},`;
        })
        .join('\n');

    return `class ${className} {
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
        if (dartType === 'bool') {
            return `  late bool _${fieldName}Value;`;
        }
        return `  late final TextEditingController _${fieldName}Controller;`;
    }).join('\n');

    const controllerInitializations = fields.map(f => {
        const dartType = jdlToDartType(f.type);
        const fieldName = f.name;
        if (dartType === 'bool') {
            return `    _${fieldName}Value = widget.initialData?.${fieldName} ?? false;`;
        } else if (dartType === 'DateTime') {
            return `    _${fieldName}Controller = TextEditingController(text: widget.initialData?.${fieldName}?.toIso8601String() ?? '');`;
        }
        return `    _${fieldName}Controller = TextEditingController(text: widget.initialData?.${fieldName}?.toString() ?? '');`;
    }).join('\n');

    const controllerDisposals = fields.map(f => {
        const dartType = jdlToDartType(f.type);
        const fieldName = f.name;
        if (dartType !== 'bool') { // Only dispose TextEditingControllers
            return `    _${fieldName}Controller.dispose();`;
        }
        return '';
    }).filter(line => line.length > 0).join('\n');

    // Generate form fields (TextFormField, CheckboxListTile)
    const formFields = fields.map(f => {
        const dartType = jdlToDartType(f.type);
        const fieldName = f.name;
        const labelText = fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // Convert camelCase to "Camel Case"

        if (dartType === 'bool') {
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
        if (dartType === 'bool') {
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

    return `import 'package:flutter/material.dart';
import '../models/${instanceName}_model.dart';

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
    const entities = parseJdl(jdlContent);

    if (Object.keys(entities).length === 0) {
        console.log('No entities found in the JDL file.');
        return;
    }

    const modelsDir = path.join(outputDir, 'models');
    const servicesDir = path.join(outputDir, 'services');
    const formsDir = path.join(outputDir, 'forms'); // New forms directory
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.mkdirSync(servicesDir, { recursive: true });
    fs.mkdirSync(formsDir, { recursive: true }); // Create forms directory

    console.log(`Generating files in '${outputDir}' directory for microservice '${microserviceName}' with API host '${apiHost}'...`);

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
