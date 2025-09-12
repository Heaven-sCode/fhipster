#!/usr/bin/env node

/**
 * FHipster CLI
 * JDL → Flutter GetX lib/ generator
 *
 * - Dual auth (Keycloak OIDC or JHipster JWT) baked into env.dart
 * - Gateway-aware URLs (JHipster API Gateway)
 * - Models, Services, Controllers, Forms, Table views
 * - Core app shell, routes, auth middlewares & service
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// ---- Generators ----
const { generateEnvTemplate } = require('../generators/env_generator');
const { generateApiClientTemplate } = require('../generators/api_client_generator');
const { generateAuthServiceTemplate } = require('../generators/auth_service_generator');
const { generateAuthMiddlewareTemplate } = require('../generators/auth_middleware_generator');
const { generateRoleMiddlewareTemplate } = require('../generators/role_middleware_generator');
const { generateTokenDecoderTemplate } = require('../generators/token_decoder_generator');

const { generateAppShellTemplate } = require('../generators/app_shell_generator');
const { generateRoutesTemplate } = require('../generators/routes_generator');

const { generateEnumTemplate } = require('../generators/enum_generator');
const { generateModelTemplate } = require('../generators/model_generator');
const { generateServiceTemplate } = require('../generators/service_generator');
const { generateEntityControllerTemplate } = require('../generators/entity_controller_generator');
const { generateFormTemplate } = require('../generators/form_generator');
const { generateTableViewTemplate } = require('../generators/table_view_generator');
const { generateTableWidgetsTemplates } = require('../generators/table_widgets_generator');
const { generateFHipsterInputFieldTemplate } = require('../generators/fhipster_input_field_generator');

const { generateLoginControllerTemplate } = require('../generators/login_controller_generator');
const { generateLoginViewTemplate } = require('../generators/login_view_generator');
const { generateSplashControllerTemplate } = require('../generators/splash_controller_generator');
const { generateSplashViewTemplate } = require('../generators/splash_view_generator');
const { generateHomeViewTemplate } = require('../generators/home_view_generator');
const { generateUnauthorizedViewTemplate } = require('../generators/unauthorized_view_generator');
const { generateForbiddenViewTemplate } = require('../generators/forbidden_view_generator');

// ---- Parser / Utils ----
const { parseJdl } = require('../parser');                 // ../parser/index.js
const { toFileName, toClassName, toInstanceName, toPlural } = require('../utils/naming');
const { writeFile } = require('../utils/file_writer');

// ------------------------------------------------------------

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
      description: 'Base host for the API (e.g., https://api.example.com).',
      type: 'string',
      default: 'http://localhost:8080',
    })
    .option('useGateway', {
      type: 'boolean',
      default: false,
      describe: 'Use JHipster API Gateway style URLs: /services/<name>/api/**',
    })
    .option('gatewayServiceName', {
      type: 'string',
      describe: 'Default gateway service name (required when --useGateway if not overridden per-service).',
    })
    .option('authProvider', {
      alias: 'p',
      choices: ['keycloak', 'jhipsterJwt'],
      default: 'keycloak',
      describe: 'Auth provider baked into env.dart',
    })
    .option('jwtAuthEndpoint', {
      type: 'string',
      default: '/api/authenticate',
      describe: 'JWT auth endpoint (JHipster JWT mode)',
    })
    .option('accountEndpoint', {
      type: 'string',
      default: '/api/account',
      describe: 'Account/identity endpoint (JHipster JWT mode)',
    })
    .option('includeAuthGuards', {
      type: 'boolean',
      default: true,
      describe: 'Attach AuthMiddleware/RoleMiddleware to secured routes',
    })
    .option('force', {
      alias: 'f',
      type: 'boolean',
      default: false,
      describe: 'Overwrite existing files without prompting',
    })
    .help('h')
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .argv;

  const jdlFilePath = path.resolve(process.cwd(), argv._[0]);
  const outputDir = path.resolve(process.cwd(), argv._[1] || 'flutter_generated');

  const microserviceName = argv.microservice;
  const apiHost = argv.apiHost;
  const useGateway = !!argv.useGateway;
  const gatewayServiceName = argv.gatewayServiceName || null;
  const authProvider = argv.authProvider;
  const jwtAuthEndpoint = argv.jwtAuthEndpoint;
  const accountEndpoint = argv.accountEndpoint;
  const includeAuthGuards = !!argv.includeAuthGuards;
  const force = !!argv.force;

  if (!fs.existsSync(jdlFilePath)) {
    console.error(`❌ JDL file not found at '${jdlFilePath}'`);
    process.exit(1);
  }

  // Parse JDL
  const jdlContent = fs.readFileSync(jdlFilePath, 'utf8');
  const { entities, enums, pluralOverrides = {} } = parseJdl(jdlContent);

  // Directories (under lib/)
  const dirs = resolveDirs(outputDir);
  ensureDirs(dirs);

  console.log(`\n📦 Output: '${outputDir}'`);
  console.log(`🔧 Service: '${microserviceName}'  🌐 API: '${apiHost}'  🔐 Auth: ${authProvider}\n`);

  // ---------------- Core / Env / Auth ----------------
  console.log('• Generating core/env/auth ...');

  writeFile(
    path.join(dirs.coreDir, 'env', 'env.dart'),
    generateEnvTemplate({
      apiHost,
      useGateway,
      gatewayServiceName,
      pluralOverrides,
      authProvider,
      jwtAuthEndpoint,
      accountEndpoint,
    }),
    force,
    'core/env/env.dart'
  );

  writeFile(path.join(dirs.coreDir, 'api_client.dart'), generateApiClientTemplate(), force, 'core/api_client.dart');
  writeFile(path.join(dirs.coreAuthDir, 'auth_service.dart'), generateAuthServiceTemplate(), force, 'core/auth/auth_service.dart');
  writeFile(path.join(dirs.coreAuthDir, 'auth_middleware.dart'), generateAuthMiddlewareTemplate(), force, 'core/auth/auth_middleware.dart');
  writeFile(path.join(dirs.coreAuthDir, 'role_middleware.dart'), generateRoleMiddlewareTemplate(), force, 'core/auth/role_middleware.dart');
  writeFile(path.join(dirs.coreAuthDir, 'token_decoder.dart'), generateTokenDecoderTemplate(), force, 'core/auth/token_decoder.dart');

  // App shell & routes
  console.log('• Generating app shell & routes ...');
  writeFile(path.join(dirs.coreDir, 'app_shell.dart'), generateAppShellTemplate(), force, 'core/app_shell.dart');

  // ---------------- Common Widgets ----------------
  console.log('• Generating common widgets ...');
  writeFile(path.join(dirs.widgetsDir, 'fhipster_input_field.dart'), generateFHipsterInputFieldTemplate(), force, 'widgets/fhipster_input_field.dart');

  // Table widgets (multiple files)
  const tableWidgetFiles = generateTableWidgetsTemplates();
  Object.entries(tableWidgetFiles).forEach(([relPath, content]) => {
    writeFile(path.join(dirs.widgetsDir, relPath), content, force, path.join('widgets', relPath));
  });

  // ---------------- Enums ----------------
  if (enums && Object.keys(enums).length > 0) {
    console.log('• Generating enums ...');
    for (const [enumName, values] of Object.entries(enums)) {
      const enumFile = `${toFileName(enumName)}_enum.dart`;
      writeFile(path.join(dirs.enumsDir, enumFile), generateEnumTemplate(enumName, values), force, path.join('enums', enumFile));
    }
  }

  // ---------------- Per-entity generation ----------------
  console.log('• Generating entities (models/services/controllers/forms/views) ...');

  /** Build route registrations */
  const entityRoutes = [];

  if (entities) {
    for (const [entityName, fields] of Object.entries(entities)) {
      const fileBase = toFileName(entityName);         // e.g., "user_profile"
      const classBase = toClassName(entityName);       // e.g., "UserProfile"
      const instanceBase = toInstanceName(entityName); // e.g., "userProfile"
      const pluralBase = toPlural(fileBase);           // e.g., "user_profiles" (or use your pluralizer)

      // Models
      writeFile(
        path.join(dirs.modelsDir, `${fileBase}_model.dart`),
        generateModelTemplate(entityName, fields, enums),
        force,
        `models/${fileBase}_model.dart`
      );

      // Services
      writeFile(
        path.join(dirs.servicesDir, `${fileBase}_service.dart`),
        generateServiceTemplate(entityName, microserviceName, apiHost),
        force,
        `services/${fileBase}_service.dart`
      );

      // Controllers
      writeFile(
        path.join(dirs.controllersDir, `${fileBase}_controller.dart`),
        generateEntityControllerTemplate(entityName, fields, enums),
        force,
        `controllers/${fileBase}_controller.dart`
      );

      // Forms
      writeFile(
        path.join(dirs.formsDir, `${fileBase}_form.dart`),
        generateFormTemplate(entityName, fields, enums),
        force,
        `forms/${fileBase}_form.dart`
      );

      // Table view
      writeFile(
        path.join(dirs.viewsDir, `${fileBase}_table_view.dart`),
        generateTableViewTemplate(entityName, fields),
        force,
        `views/${fileBase}_table_view.dart`
      );

      // Register route for the entity table view (guarded by Auth; add roles if you want)
      entityRoutes.push({
        path: `/${pluralBase}`,                                  // e.g., /user_profiles
        controllerFile: `${fileBase}_controller.dart`,
        viewFile: `${fileBase}_table_view.dart`,
        controllerClass: `${classBase}Controller`,
        viewClass: `${classBase}TableView`,
        roles: [], // put ['ROLE_ADMIN'] etc if you want role guard by default
      });
    }
  }

  // ---------------- Static screens ----------------
  console.log('• Generating static views/controllers ...');

  // Splash
  writeFile(path.join(dirs.controllersDir, 'splash_controller.dart'), generateSplashControllerTemplate(), force, 'controllers/splash_controller.dart');
  writeFile(path.join(dirs.viewsDir, 'splash_view.dart'), generateSplashViewTemplate(), force, 'views/splash_view.dart');

  // Login
  writeFile(path.join(dirs.controllersDir, 'login_controller.dart'), generateLoginControllerTemplate(), force, 'controllers/login_controller.dart');
  writeFile(path.join(dirs.viewsDir, 'login_view.dart'), generateLoginViewTemplate(), force, 'views/login_view.dart');

  // Home
  writeFile(path.join(dirs.viewsDir, 'home_view.dart'), generateHomeViewTemplate(), force, 'views/home_view.dart');

  // Unauthorized / Forbidden
  writeFile(path.join(dirs.viewsDir, 'unauthorized_view.dart'), generateUnauthorizedViewTemplate(), force, 'views/unauthorized_view.dart');
  writeFile(path.join(dirs.viewsDir, 'forbidden_view.dart'), generateForbiddenViewTemplate(), force, 'views/forbidden_view.dart');

  // Routes
  writeFile(
    path.join(dirs.coreDir, 'routes.dart'),
    generateRoutesTemplate({ entityRoutes, includeAuthGuards }),
    force,
    'core/routes.dart'
  );

  // ---------------- Done ----------------
  console.log('\n✅ Generation complete!');
  console.log('Next steps:');
  console.log("1) In your Flutter app's main.dart, call:  Env.initGenerated();");
  console.log("   (Or Env.init(EnvConfig(...)) to override values at runtime.)");
  console.log("2) Ensure you added Flutter deps:  flutter pub add get get_storage responsive_grid");
  console.log("3) Set initialRoute to AppRoutes.splash and use GetMaterialApp with AppRoutes.pages.");
  console.log(`4) Copy '${outputDir}' into your Flutter project's 'lib' (or generate directly to ./lib).`);
}

// ------------------------------------------------------------

function resolveDirs(rootOut) {
  const libDir = rootOut; // we generate a lib/ tree (user may pass ./lib)

  return {
    libDir,
    coreDir: path.join(libDir, 'core'),
    coreAuthDir: path.join(libDir, 'core', 'auth'),
    coreEnvDir: path.join(libDir, 'core', 'env'),
    modelsDir: path.join(libDir, 'models'),
    servicesDir: path.join(libDir, 'services'),
    controllersDir: path.join(libDir, 'controllers'),
    formsDir: path.join(libDir, 'forms'),
    viewsDir: path.join(libDir, 'views'),
    widgetsDir: path.join(libDir, 'widgets'),
    widgetsTableDir: path.join(libDir, 'widgets', 'table'),
    widgetsCommonDir: path.join(libDir, 'widgets', 'common'),
    enumsDir: path.join(libDir, 'enums'),
  };
}

function ensureDirs(dirs) {
  [
    dirs.libDir,
    dirs.coreDir,
    dirs.coreAuthDir,
    dirs.coreEnvDir,
    dirs.modelsDir,
    dirs.servicesDir,
    dirs.controllersDir,
    dirs.formsDir,
    dirs.viewsDir,
    dirs.widgetsDir,
    dirs.widgetsTableDir,
    dirs.widgetsCommonDir,
    dirs.enumsDir,
  ].forEach((d) => fs.mkdirSync(d, { recursive: true }));
}

main();
