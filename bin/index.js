#!/usr/bin/env node

/**
 * FHipster CLI
 * JDL → Flutter GetX lib/ generator
 *
 * - YAML config support (CLI overrides YAML)
 * - Defaults output to ./lib
 * - Optional lib/main.dart via --emitMain or YAML emitMain: true
 * - Dual auth (Keycloak OIDC or JHipster JWT) baked into env.dart
 * - Gateway-aware URLs (JHipster API Gateway)
 * - Models, Services, Controllers, Forms, Table views
 * - Core app shell, routes, auth middlewares & service
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
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

const { generateMainDartTemplate } = require('../generators/main_dart_generator'); // optional main.dart

// ---- Parser / Utils ----
const { parseJdl } = require('../parser');
const { toFileName, toClassName, toInstanceName, toPlural } = require('../utils/naming');
const { writeFile } = require('../utils/file_writer');

// ----------------------------------------------------------------

function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [jdlFile] --microservice <name> [options]')
    .epilog('FHipster — JDL → Flutter (GetX) generator')
    .option('config', {
      alias: 'c',
      type: 'string',
      describe: 'Path to YAML config (CLI flags override YAML). If omitted, auto-detects fhipster.config.yaml|yml in CWD.',
    })
    .option('microservice', {
      alias: 'm',
      type: 'string',
      describe: 'Microservice short name (e.g., dms)',
    })
    .option('apiHost', {
      alias: 'a',
      type: 'string',
      describe: 'Base API host (e.g., http://localhost:8080)',
    })
    .option('useGateway', {
      alias: 'g',
      type: 'boolean',
      describe: 'Use JHipster gateway paths (/services/<svc>/api/...)',
    })
    .option('gatewayServiceName', {
      alias: 's',
      type: 'string',
      describe: 'Gateway service name when --useGateway is true (e.g., dms)',
    })
    .option('outputDir', {
      alias: 'o',
      type: 'string',
      describe: 'Output directory (defaults to ./lib)',
    })
    .option('pluralOverridesJson', {
      type: 'string',
      default: '{}',
      describe: 'JSON map of entity plural overrides, e.g. {"Person":"people","Address":"addresses"}',
    })
    // Auth (dual)
    .option('authProvider', {
      alias: 'p',
      choices: ['keycloak', 'jhipsterJwt'],
      describe: 'Auth provider baked into env.dart',
    })
    .option('jwtAuthEndpoint', { type: 'string', describe: 'JWT auth endpoint (e.g., /api/authenticate)' })
    .option('accountEndpoint', { type: 'string', describe: 'JWT account endpoint (e.g., /api/account)' })
    .option('allowCredentialCacheForJwt', { type: 'boolean', describe: 'Cache username/password for JWT (not recommended)' })
    // Keycloak extras (optional CLI)
    .option('keycloakTokenEndpoint', { type: 'string' })
    .option('keycloakLogoutEndpoint', { type: 'string' })
    .option('keycloakAuthorizeEndpoint', { type: 'string' })
    .option('keycloakUserinfoEndpoint', { type: 'string' })
    .option('keycloakClientId', { type: 'string' })
    .option('keycloakClientSecret', { type: 'string' })
    .option('keycloakScopes', { type: 'string', describe: 'Comma-separated scopes (e.g., openid,profile,email,offline_access)' })
    // Environment defaults
    .option('appName', { type: 'string' })
    .option('envName', { type: 'string' })
    .option('defaultPageSize', { type: 'number' })
    .option('pageSizeOptions', { type: 'string', describe: 'Comma-separated ints (e.g., 10,20,50,100)' })
    .option('defaultSort', { type: 'string', describe: 'Comma-separated sort (e.g., id,desc)' })
    .option('defaultSearchSort', { type: 'string', describe: 'Comma-separated search sort (e.g., _score,desc)' })
    .option('distinctByDefault', { type: 'boolean' })
    .option('totalCountHeaderName', { type: 'string' })
    .option('storageKeyAccessToken', { type: 'string' })
    .option('storageKeyAccessExpiry', { type: 'string' })
    .option('storageKeyRefreshToken', { type: 'string' })
    .option('storageKeyRefreshExpiry', { type: 'string' })
    .option('storageKeyRememberedUsername', { type: 'string' })
    .option('relationshipPayloadMode', { type: 'string', choices: ['idOnly', 'fullObject'] })
    // Guards & main.dart
    .option('includeAuthGuards', { type: 'boolean', describe: 'Attach AuthMiddleware/RoleMiddleware to routes' })
    .option('emitMain', { type: 'boolean', describe: 'Also generate lib/main.dart' })
    .option('force', { alias: 'f', type: 'boolean', default: false, describe: 'Overwrite existing files' })
    // IMPORTANT: do NOT .demandCommand(1) — we allow YAML-only usage
    .help('h')
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .argv;

  // 1) Load YAML (explicit path or autodetect)
  const yamlConfig = loadYamlConfig(argv.config);

  // 2) Resolve inputs (CLI > YAML > defaults)
  const jdlFilePath = resolveJdlPath(argv._[0] || yamlConfig.jdlFile);
  const outputDir = path.resolve(
    process.cwd(),
    pick(argv.outputDir, yamlConfig.outputDir, 'lib') // <-- default to ./lib
  );

  const microserviceName = pick(argv.microservice, yamlConfig.microservice, null);
  if (!microserviceName) {
    console.error('❌ Missing required option: --microservice (or set microservice in YAML)');
    process.exit(1);
  }

  const apiHost = pick(argv.apiHost, yamlConfig.apiHost, 'http://localhost:8080');
  const useGateway = pickBool(argv.useGateway, yamlConfig.useGateway, false);
  const gatewayServiceName = pick(argv.gatewayServiceName, yamlConfig.gatewayServiceName, null);

  const includeAuthGuards = pickBool(argv.includeAuthGuards, yamlConfig.includeAuthGuards, true);
  const emitMain = pickBool(argv.emitMain, yamlConfig.emitMain, false);
  const force = !!argv.force;

  // Auth (dual)
  const authProvider = pick(argv.authProvider, yamlConfig?.auth?.provider, 'keycloak');

  // JWT
  const jwtAuthEndpoint = pick(argv.jwtAuthEndpoint, yamlConfig?.auth?.jwtAuthEndpoint, '/api/authenticate');
  const accountEndpoint = pick(argv.accountEndpoint, yamlConfig?.auth?.accountEndpoint, '/api/account');
  const allowCredentialCacheForJwt = pickBool(
    argv.allowCredentialCacheForJwt,
    yamlConfig?.auth?.allowCredentialCacheForJwt,
    false
  );

  // Keycloak (optional)
  const keycloakTokenEndpoint = pick(argv.keycloakTokenEndpoint, yamlConfig?.auth?.keycloak?.tokenEndpoint, undefined);
  const keycloakLogoutEndpoint = pick(argv.keycloakLogoutEndpoint, yamlConfig?.auth?.keycloak?.logoutEndpoint, undefined);
  const keycloakAuthorizeEndpoint = pick(argv.keycloakAuthorizeEndpoint, yamlConfig?.auth?.keycloak?.authorizeEndpoint, undefined);
  const keycloakUserinfoEndpoint = pick(argv.keycloakUserinfoEndpoint, yamlConfig?.auth?.keycloak?.userinfoEndpoint, undefined);
  const keycloakClientId = pick(argv.keycloakClientId, yamlConfig?.auth?.keycloak?.clientId, undefined);
  const keycloakClientSecret = pick(argv.keycloakClientSecret, yamlConfig?.auth?.keycloak?.clientSecret, undefined);
  const keycloakScopes = resolveList(argv.keycloakScopes, yamlConfig?.auth?.keycloak?.scopes, []);

  // General env
  const appName = pick(argv.appName, yamlConfig.appName, 'FHipster');
  const envName = pick(argv.envName, yamlConfig.envName, 'dev');
  const defaultPageSize = pickNum(argv.defaultPageSize, yamlConfig.defaultPageSize, 20);
  const pageSizeOptions = resolveIntList(argv.pageSizeOptions, yamlConfig.pageSizeOptions, [10, 20, 50, 100]);
  const defaultSort = resolveList(argv.defaultSort, yamlConfig.defaultSort, ['id,desc']);
  const defaultSearchSort = resolveList(argv.defaultSearchSort, yamlConfig.defaultSearchSort, ['_score,desc']);
  const distinctByDefault = pickBool(argv.distinctByDefault, yamlConfig.distinctByDefault, false);
  const totalCountHeaderName = pick(argv.totalCountHeaderName, yamlConfig.totalCountHeaderName, 'X-Total-Count');
  const storageKeyAccessToken = pick(argv.storageKeyAccessToken, yamlConfig.storageKeyAccessToken, 'fh_access_token');
  const storageKeyAccessExpiry = pick(argv.storageKeyAccessExpiry, yamlConfig.storageKeyAccessExpiry, 'fh_access_expiry');
  const storageKeyRefreshToken = pick(argv.storageKeyRefreshToken, yamlConfig.storageKeyRefreshToken, 'fh_refresh_token');
  const storageKeyRefreshExpiry = pick(argv.storageKeyRefreshExpiry, yamlConfig.storageKeyRefreshExpiry, 'fh_refresh_expiry');
  const storageKeyRememberedUsername = pick(argv.storageKeyRememberedUsername, yamlConfig.storageKeyRememberedUsername, 'fh_remembered_username');
  const relationshipPayloadMode = pick(argv.relationshipPayloadMode, yamlConfig.relationshipPayloadMode, 'idOnly');

  // Plural overrides (merge YAML + CLI JSON)
  const pluralOverridesYaml = yamlConfig.pluralOverrides || {};
  let pluralOverridesCli = {};
  try {
    pluralOverridesCli = JSON.parse(argv.pluralOverridesJson || '{}');
  } catch {
    console.warn('⚠️  Could not parse --pluralOverridesJson; using {}');
  }
  const pluralOverrides = { ...pluralOverridesYaml, ...pluralOverridesCli };

  if (!fs.existsSync(jdlFilePath)) {
    console.error(`❌ JDL file not found at '${jdlFilePath}'`);
    process.exit(1);
  }

  // Parse JDL
  const jdlContent = fs.readFileSync(jdlFilePath, 'utf8');
  const { entities, enums, pluralOverrides: fromJdlPlural = {} } = parseJdl(jdlContent);
  const pluralMap = { ...fromJdlPlural, ...pluralOverrides };

  // Directories
  const dirs = resolveDirs(outputDir);
  ensureDirs(dirs);

  // Banner
  console.log(`\n📦 Output: '${outputDir}'`);
  console.log(`🔧 Service: '${microserviceName}'  🌐 API: '${apiHost}'  🔐 Auth: ${authProvider}`);
  if (useGateway) console.log(`🧭 Gateway mode ON  (service: ${gatewayServiceName || '(none set)'})\n`);
  else console.log('');

  // ---------------- Core / Env / Auth ----------------
  console.log('• Generating core/env/auth ...');

  writeFile(
    path.join(dirs.coreEnvDir, 'env.dart'),
    generateEnvTemplate({
      // General
      appName,
      envName,
      apiHost,
      useGateway,
      gatewayServiceName,
      pluralOverrides: pluralMap,

      // Auth
      authProvider,
      // JWT
      jwtAuthEndpoint,
      accountEndpoint,
      allowCredentialCacheForJwt,
      // Keycloak
      keycloakTokenEndpoint,
      keycloakLogoutEndpoint,
      keycloakAuthorizeEndpoint,
      keycloakUserinfoEndpoint,
      keycloakClientId,
      keycloakClientSecret,
      keycloakScopes,

      // Paging / sorting / flags
      defaultPageSize,
      pageSizeOptions,
      defaultSort,
      defaultSearchSort,
      distinctByDefault,

      // Headers / storage
      totalCountHeaderName,
      storageKeyAccessToken,
      storageKeyAccessExpiry,
      storageKeyRefreshToken,
      storageKeyRefreshExpiry,
      storageKeyRememberedUsername,

      // Relationships
      relationshipPayloadMode,
    }),
    force,
    'core/env/env.dart'
  );

  writeFile(path.join(dirs.coreDir, 'api_client.dart'), generateApiClientTemplate(), force, 'core/api_client.dart');
  writeFile(path.join(dirs.coreAuthDir, 'auth_service.dart'), generateAuthServiceTemplate(), force, 'core/auth/auth_service.dart');
  writeFile(path.join(dirs.coreAuthDir, 'auth_middleware.dart'), generateAuthMiddlewareTemplate(), force, 'core/auth/auth_middleware.dart');
  writeFile(path.join(dirs.coreAuthDir, 'role_middleware.dart'), generateRoleMiddlewareTemplate(), force, 'core/auth/role_middleware.dart');
  writeFile(path.join(dirs.coreAuthDir, 'token_decoder.dart'), generateTokenDecoderTemplate(), force, 'core/auth/token_decoder.dart');

  // App shell
  console.log('• Generating app shell & routes ...');
  writeFile(path.join(dirs.coreDir, 'app_shell.dart'), generateAppShellTemplate(), force, 'core/app_shell.dart');

  // ---------------- Common Widgets ----------------
  console.log('• Generating common widgets ...');
  writeFile(path.join(dirs.widgetsDir, 'fhipster_input_field.dart'), generateFHipsterInputFieldTemplate(), force, 'widgets/fhipster_input_field.dart');

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

  // ---------------- Entities ----------------
  console.log('• Generating entities (models/services/controllers/forms/views) ...');
  const entityRoutes = [];

  if (entities) {
    for (const [entityName, fields] of Object.entries(entities)) {
      const fileBase = toFileName(entityName);
      const classBase = toClassName(entityName);
      const instanceBase = toInstanceName(entityName); // reserved if needed
      const pluralBase = toPlural(fileBase);

      // Model
      writeFile(
        path.join(dirs.modelsDir, `${fileBase}_model.dart`),
        generateModelTemplate(entityName, fields, enums),
        force,
        `models/${fileBase}_model.dart`
      );

      // Service
      writeFile(
        path.join(dirs.servicesDir, `${fileBase}_service.dart`),
        generateServiceTemplate(entityName, microserviceName, apiHost),
        force,
        `services/${fileBase}_service.dart`
      );

      // Controller
      writeFile(
        path.join(dirs.controllersDir, `${fileBase}_controller.dart`),
        generateEntityControllerTemplate(entityName, fields, enums),
        force,
        `controllers/${fileBase}_controller.dart`
      );

      // Form
      writeFile(
        path.join(dirs.formsDir, `${fileBase}_form.dart`),
        generateFormTemplate(entityName, fields, enums),
        force,
        `forms/${fileBase}_form.dart`
      );

      // Table View
      writeFile(
        path.join(dirs.viewsDir, `${fileBase}_table_view.dart`),
        generateTableViewTemplate(entityName, fields),
        force,
        `views/${fileBase}_table_view.dart`
      );

      // Route
      entityRoutes.push({
        path: `/${pluralBase}`,
        controllerFile: `${fileBase}_controller.dart`,
        viewFile: `${fileBase}_table_view.dart`,
        controllerClass: `${classBase}Controller`,
        viewClass: `${classBase}TableView`,
        roles: [],
      });
    }
  }

  // Static screens
  console.log('• Generating static views/controllers ...');
  writeFile(path.join(dirs.controllersDir, 'splash_controller.dart'), generateSplashControllerTemplate(), force, 'controllers/splash_controller.dart');
  writeFile(path.join(dirs.viewsDir, 'splash_view.dart'), generateSplashViewTemplate(), force, 'views/splash_view.dart');

  writeFile(path.join(dirs.controllersDir, 'login_controller.dart'), generateLoginControllerTemplate(), force, 'controllers/login_controller.dart');
  writeFile(path.join(dirs.viewsDir, 'login_view.dart'), generateLoginViewTemplate(), force, 'views/login_view.dart');

  writeFile(path.join(dirs.viewsDir, 'home_view.dart'), generateHomeViewTemplate(), force, 'views/home_view.dart');
  writeFile(path.join(dirs.viewsDir, 'unauthorized_view.dart'), generateUnauthorizedViewTemplate(), force, 'views/unauthorized_view.dart');
  writeFile(path.join(dirs.viewsDir, 'forbidden_view.dart'), generateForbiddenViewTemplate(), force, 'views/forbidden_view.dart');

  // Routes
  writeFile(
    path.join(dirs.coreDir, 'routes.dart'),
    generateRoutesTemplate({ entityRoutes, includeAuthGuards }),
    force,
    'core/routes.dart'
  );

  // Optional main.dart
  if (emitMain) {
    writeFile(
      path.join(dirs.libDir, 'main.dart'),
      generateMainDartTemplate(),
      force,
      'main.dart'
    );
  }

  // Done
  console.log('\n✅ Generation complete!');
  console.log('Next steps:');
  console.log("1) Ensure Flutter deps:  flutter pub add get get_storage responsive_grid");
  console.log("2) If you didn't emit main.dart: wire Env.initGenerated(), ApiClient & AuthService, and AppRoutes.pages in your app.");
  console.log(`3) Output is at: ${outputDir}`);
}

// ----------------------------------------------------------------

function resolveDirs(rootOut) {
  const libDir = rootOut; // user usually passes ./lib; default is ./lib
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

function loadYamlConfig(providedPath) {
  const tryPaths = [];
  if (providedPath) tryPaths.push(path.resolve(process.cwd(), providedPath));
  tryPaths.push(
    path.resolve(process.cwd(), 'fhipster.config.yaml'),
    path.resolve(process.cwd(), 'fhipster.config.yml')
  );

  for (const p of tryPaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const data = yaml.load(raw) || {};
        console.log(`📝 Using config: ${p}`);
        return normalizeYaml(data);
      } catch (e) {
        console.error(`⚠️ Failed to read YAML at ${p}: ${e.message}`);
        return {};
      }
    }
  }
  return {};
}

function normalizeYaml(data) {
  // Accept flat keys or under "project"
  const root = { ...(data || {}) };
  const proj = root.project || {};
  const auth = root.auth || proj.auth || {};
  const kc = auth.keycloak || {};
  return {
    // project basics
    jdlFile: root.jdlFile || proj.jdlFile,
    outputDir: root.outputDir || proj.outputDir,
    microservice: root.microservice || proj.microservice,
    apiHost: root.apiHost || proj.apiHost,
    useGateway: pickBool(root.useGateway, proj.useGateway, undefined),
    gatewayServiceName: root.gatewayServiceName || proj.gatewayServiceName,
    includeAuthGuards: pickBool(root.includeAuthGuards, proj.includeAuthGuards, undefined),
    emitMain: pickBool(root.emitMain, proj.emitMain, undefined),

    // env extras
    appName: root.appName || proj.appName,
    envName: root.envName || proj.envName,
    defaultPageSize: root.defaultPageSize ?? proj.defaultPageSize,
    pageSizeOptions: root.pageSizeOptions || proj.pageSizeOptions,
    defaultSort: root.defaultSort || proj.defaultSort,
    defaultSearchSort: root.defaultSearchSort || proj.defaultSearchSort,
    distinctByDefault: pickBool(root.distinctByDefault, proj.distinctByDefault, undefined),
    totalCountHeaderName: root.totalCountHeaderName || proj.totalCountHeaderName,
    storageKeyAccessToken: root.storageKeyAccessToken || proj.storageKeyAccessToken,
    storageKeyAccessExpiry: root.storageKeyAccessExpiry || proj.storageKeyAccessExpiry,
    storageKeyRefreshToken: root.storageKeyRefreshToken || proj.storageKeyRefreshToken,
    storageKeyRefreshExpiry: root.storageKeyRefreshExpiry || proj.storageKeyRefreshExpiry,
    storageKeyRememberedUsername: root.storageKeyRememberedUsername || proj.storageKeyRememberedUsername,
    relationshipPayloadMode: root.relationshipPayloadMode || proj.relationshipPayloadMode,

    // auth
    auth: {
      provider: auth.provider,
      jwtAuthEndpoint: auth.jwtAuthEndpoint,
      accountEndpoint: auth.accountEndpoint,
      allowCredentialCacheForJwt: pickBool(auth.allowCredentialCacheForJwt, undefined, undefined),
      keycloak: {
        tokenEndpoint: kc.tokenEndpoint,
        logoutEndpoint: kc.logoutEndpoint,
        authorizeEndpoint: kc.authorizeEndpoint,
        userinfoEndpoint: kc.userinfoEndpoint,
        clientId: kc.clientId,
        clientSecret: kc.clientSecret,
        scopes: kc.scopes,
      },
    },

    // plural overrides
    pluralOverrides: root.pluralOverrides || proj.pluralOverrides || {},
  };
}

function pick(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}
function pickBool(...vals) {
  for (const v of vals) {
    if (v === true || v === false) return v;
  }
  return undefined;
}
function pickNum(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && isFinite(v)) return Number(v);
  }
  return undefined;
}

function resolveList(cliStringOrUndefined, yamlListOrUndefined, fallbackArr = []) {
  if (typeof cliStringOrUndefined === 'string' && cliStringOrUndefined.trim().length) {
    return cliStringOrUndefined.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (Array.isArray(yamlListOrUndefined)) return yamlListOrUndefined;
  return fallbackArr;
}
function resolveIntList(cliStringOrUndefined, yamlListOrUndefined, fallbackArr = []) {
  if (typeof cliStringOrUndefined === 'string' && cliStringOrUndefined.trim().length) {
    return cliStringOrUndefined
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n));
  }
  if (Array.isArray(yamlListOrUndefined)) {
    return yamlListOrUndefined.map(n => parseInt(n, 10)).filter(Number.isFinite);
  }
  return fallbackArr;
}

function resolveJdlPath(jdlFromArgOrYaml) {
  if (!jdlFromArgOrYaml) {
    console.error('❌ You must provide the path to the JDL file (positional arg) or set jdlFile in YAML.');
    process.exit(1);
  }
  return path.resolve(process.cwd(), jdlFromArgOrYaml);
}

main();
