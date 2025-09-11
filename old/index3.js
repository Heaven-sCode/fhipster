#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// --- Helper Functions for Code Generation ---

/**
 * Converts JDL data types to their Dart equivalents.
 * @param {string} jdlType - The JDL data type.
 * @returns {string} The corresponding Dart type.
 */
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
        'UUID':'String'
    };
    return typeMapping[jdlType] || 'dynamic';
}

/**
 * Parses the JDL content to extract entities and their fields.
 * @param {string} jdlContent - The content of the JDL file.
 * @returns {Object} An object where keys are entity names and values are arrays of fields.
 */
function parseJdl(jdlContent) {
    const entities = {};
    const entityRegex = /entity\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = entityRegex.exec(jdlContent)) !== null) {
        const entityName = match[1];
        const fieldsStr = match[2].trim();
        const fields = [];
        const fieldRegex = /(\w+)\s+([\w<>]+)/g;
        let fieldMatch;

        while ((fieldMatch = fieldRegex.exec(fieldsStr)) !== null) {
            fields.push({ name: fieldMatch[1], type: fieldMatch[2] });
        }
        entities[entityName] = fields;
    }
    return entities;
}


// --- Template Generators ---

/**
 * Generates the content for a Dart data model file.
 * @param {string} entityName - The name of the entity.
 * @param {Array<Object>} fields - The fields of the entity.
 * @returns {string} The Dart code for the model.
 */
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
 * Generates the content for a GetX service file.
 * @param {string} entityName - The name of the entity.
 * @param {string} microserviceName - The name of the microservice.
 * @returns {string} The Dart code for the service.
 */
function generateServiceTemplate(entityName, microserviceName) {
    const modelClassName = `${entityName}Model`;
    const serviceClassName = `${entityName}Service`;
    const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    const endpointName = instanceName.endsWith('y') 
        ? `${instanceName.slice(0, -1)}ies` 
        : `${instanceName}s`;

    // Construct the base URL to include the microservice name
    const baseUrl = `'https://api.yourapp.com/services/${microserviceName}/api'`;

    return `import 'package:get/get.dart';
import '../models/${instanceName}_model.dart';

class ${serviceClassName} extends GetxService {
  final _apiClient = GetConnect(timeout: Duration(seconds: 30));
  // IMPORTANT: Replace 'https://api.yourapp.com' with your actual API root URL
  // The base URL now includes the microservice name and 'api' path
  final String _baseUrl = ${baseUrl};

  @override
  void onInit() {
    _apiClient.baseUrl = _baseUrl;
    super.onInit();
  }

  Future<List<${modelClassName}>> getAll() async {
    final response = await _apiClient.get('/${endpointName}');
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return (response.body as List).map((json) => ${modelClassName}.fromJson(json)).toList();
  }

  Future<${modelClassName}> getById(int id) async {
    final response = await _apiClient.get('/${endpointName}/$id');
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  Future<${modelClassName}> create(${modelClassName} ${instanceName}) async {
    final response = await _apiClient.post('/${endpointName}', ${instanceName}.toJson());
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  Future<${modelClassName}> update(${modelClassName} ${instanceName}) async {
    // Assumes the model has an 'id' field for the URL path.
    // You might need to add an 'id' field to your JDL entity if it's not present.
    if (${instanceName}.id == null) {
      return Future.error("Cannot update a model without an ID.");
    }
    final response = await _apiClient.put('/${endpointName}/${'$'}{${instanceName}.id}', ${instanceName}.toJson());
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  Future<void> delete(int id) async {
    final response = await _apiClient.delete('/${endpointName}/$id');
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
  }
}
`;
}


// --- Main Execution Logic ---

function main() {
    const argv = yargs(hideBin(process.argv))
        .usage('Usage: $0 <jdlFile> --microservice <name> [outputDir]')
        .demandCommand(1, 'You must provide the path to the JDL file.')
        .option('microservice', {
            alias: 'm',
            description: 'The name of the microservice (e.g., dms).',
            type: 'string',
            demandOption: true, // Make this argument mandatory
        })
        .help('h')
        .alias('h', 'help')
        .argv;

    const jdlFilePath = argv._[0];
    const microserviceName = argv.microservice;
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

    // Create base directories
    const modelsDir = path.join(outputDir, 'models');
    const servicesDir = path.join(outputDir, 'services');
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.mkdirSync(servicesDir, { recursive: true });

    console.log(`Generating files in '${outputDir}' directory for microservice '${microserviceName}'...`);

    for (const [entityName, fields] of Object.entries(entities)) {
        console.log(`- Processing entity: ${entityName}`);
        
        const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
        
        // Generate and write model file
        const modelContent = generateModelTemplate(entityName, fields);
        const modelPath = path.join(modelsDir, `${instanceName}_model.dart`);
        fs.writeFileSync(modelPath, modelContent);

        // Generate and write service file, passing the microserviceName
        const serviceContent = generateServiceTemplate(entityName, microserviceName);
        const servicePath = path.join(servicesDir, `${instanceName}_service.dart`);
        fs.writeFileSync(servicePath, serviceContent);
    }

    console.log('\n✅ Generation complete!');
    console.log('Next steps:');
    console.log(`1. Copy the '${outputDir}' folder into your Flutter project's 'lib' directory.`);
    console.log("2. Add 'get' to your 'pubspec.yaml': dependencies:\n     get: ^4.6.5");
    console.log("3. IMPORTANT: The '_baseUrl' in your generated service files is now set to include your microservice name.");
    console.log("4. Register your services in your GetX dependency injection setup.");
}

main();
