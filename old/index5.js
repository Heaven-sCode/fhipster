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
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.mkdirSync(servicesDir, { recursive: true });

    console.log(`Generating files in '${outputDir}' directory for microservice '${microserviceName}' with API host '${apiHost}'...`);

    for (const [entityName, fields] of Object.entries(entities)) {
        console.log(`- Processing entity: ${entityName}`);
        
        const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
        
        const modelContent = generateModelTemplate(entityName, fields);
        const modelPath = path.join(modelsDir, `${instanceName}_model.dart`);
        fs.writeFileSync(modelPath, modelContent);

        // Pass apiHost to generateServiceTemplate
        const serviceContent = generateServiceTemplate(entityName, microserviceName, apiHost);
        const servicePath = path.join(servicesDir, `${instanceName}_service.dart`);
        fs.writeFileSync(servicePath, serviceContent);
    }

    console.log('\n✅ Generation complete!');
    console.log('Next steps:');
    console.log(`1. Copy the '${outputDir}' folder into your Flutter project's 'lib' directory.`);
    console.log("2. Add 'get' to your 'pubspec.yaml': dependencies:\n     get: ^4.6.5");
    console.log("3. IMPORTANT: The '_baseUrl' in your generated service files is now set to include your microservice name and the specified API host.");
    console.log("4. Register your services in your GetX dependency injection setup.");
}

main();
