#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { parseJdl } = require('./parser');
const { generateModelTemplate } = require('./generators/model_generator');
const { generateServiceTemplate } = require('./generators/service_generator');
const { generateFormTemplate } = require('./generators/form_generator');
const { generateEnumTemplate } = require('./generators/enum_generator');
const { generateTableViewTemplate } = require('./generators/table_view_generator.js');
const { generateApiClientTemplate } = require('./generators/api_client_generator.js');
const { generateLoginControllerTemplate } = require('./generators/login_controller_generator.js');
const { generateLoginViewTemplate } = require('./generators/login_view_generator.js');
const { generateSplashControllerTemplate } = require('./generators/splash_controller_generator.js');
const { generateSplashViewTemplate } = require('./generators/splash_view_generator.js');
const { generateHomeViewTemplate } = require('./generators/home_view_generator.js');
const { generateFHipsterInputFieldTemplate } = require('./generators/fhipster_input_field_generator.js');

/**
 * Main function to execute the script.
 */
function main() {
    const argv = yargs(hideBin(process.argv))
        .usage('Usage: $0 <jdlFile> --microservice <name> [--apiHost <host>] [outputDir]')
        .version()
        .alias('v', 'version')
        .describe('v', 'Show version number')
        .help('h')
        .alias('h', 'help')
        .demandCommand(1, 'You must provide the path to the JDL file.')
        .option('microservice', {
            alias: 'm',
            description: 'The name of the microservice (e.g., dms).',
            type: 'string',
            demandOption: true,
        })
        .option('apiHost', {
            alias: 'a',
            description: 'The base host for the API (e.g., https://your-domain.com).',
            type: 'string',
            default: 'https://api.yourapp.com',
        })
        .argv;

    const jdlFilePath = argv._[0];
    const microserviceName = argv.microservice;
    const apiHost = argv.apiHost;
    const outputDir = argv._[1] || 'flutter_generated';

    if (!fs.existsSync(jdlFilePath)) {
        console.error(`Error: JDL file not found at '${jdlFilePath}'`);
        process.exit(1);
    }

    const jdlContent = fs.readFileSync(jdlFilePath, 'utf8');
    const { entities, enums } = parseJdl(jdlContent);

    // Create all directories
    const modelsDir = path.join(outputDir, 'models');
    const servicesDir = path.join(outputDir, 'services');
    const formsDir = path.join(outputDir, 'forms');
    const enumsDir = path.join(outputDir, 'enums');
    const viewsDir = path.join(outputDir, 'views');
    const coreDir = path.join(outputDir, 'core');
    const controllersDir = path.join(outputDir, 'controllers');
    const widgetsDir = path.join(outputDir, 'widgets'); // New directory for custom widgets

    [modelsDir, servicesDir, formsDir, enumsDir, viewsDir, coreDir, controllersDir, widgetsDir].forEach(dir => {
        fs.mkdirSync(dir, { recursive: true });
    });

    console.log(`Generating files in '${outputDir}'...`);

    // Generate core, auth, and custom widget files
    console.log('- Generating core ApiClient...');
    fs.writeFileSync(path.join(coreDir, 'api_client.dart'), generateApiClientTemplate());

    console.log('- Generating custom FHipsterInputField widget...');
    fs.writeFileSync(path.join(widgetsDir, 'fhipster_input_field.dart'), generateFHipsterInputFieldTemplate());

    console.log('- Generating Login Controller...');
    fs.writeFileSync(path.join(controllersDir, 'login_controller.dart'), generateLoginControllerTemplate());
    
    console.log('- Generating Login View...');
    fs.writeFileSync(path.join(viewsDir, 'login_view.dart'), generateLoginViewTemplate());

    console.log('- Generating Splash Controller...');
    fs.writeFileSync(path.join(controllersDir, 'splash_controller.dart'), generateSplashControllerTemplate());

    console.log('- Generating Splash View...');
    fs.writeFileSync(path.join(viewsDir, 'splash_view.dart'), generateSplashViewTemplate());

    console.log('- Generating Home View...');
    fs.writeFileSync(path.join(viewsDir, 'home_view.dart'), generateHomeViewTemplate());

    // Generate files for each enum
    if (enums) {
        for (const [enumName, values] of Object.entries(enums)) {
            console.log(`- Processing enum: ${enumName}`);
            const enumContent = generateEnumTemplate(enumName, values);
            const enumPath = path.join(enumsDir, `${enumName.charAt(0).toLowerCase() + enumName.slice(1)}_enum.dart`);
            fs.writeFileSync(enumPath, enumContent);
        }
    }

    // Generate files for each entity
    if (entities) {
        for (const [entityName, fields] of Object.entries(entities)) {
            console.log(`- Processing entity: ${entityName}`);
            
            const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
            
            fs.writeFileSync(path.join(modelsDir, `${instanceName}_model.dart`), generateModelTemplate(entityName, fields, enums));
            fs.writeFileSync(path.join(servicesDir, `${instanceName}_service.dart`), generateServiceTemplate(entityName, microserviceName, apiHost));
            fs.writeFileSync(path.join(formsDir, `${instanceName}_form.dart`), generateFormTemplate(entityName, fields, enums));
            fs.writeFileSync(path.join(viewsDir, `${instanceName}_table_view.dart`), generateTableViewTemplate(entityName, fields));
        }
    }

    console.log('\n✅ Generation complete!');
    console.log('Next steps:');
    console.log("1. Update Keycloak details in 'core/api_client.dart' and 'controllers/login_controller.dart'.");
    console.log("2. Initialize GetStorage and register ApiClient in main.dart: \n   await GetStorage.init();\n   Get.put(ApiClient());");
    console.log("3. Set up your GetX translations and set SplashView as the initial route.");
    console.log(`4. Copy the '${outputDir}' folder into your Flutter project's 'lib' directory.`);
}

main();
