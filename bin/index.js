#!/usr/bin/env node

/**
 * FHipster CLI (profiles-aware)
 * - Preserves keep regions (see utils/file_writer.js)
 * - Partial generation: --only (entities), --skipParts=services,forms,views,models,enums,core,widgets,routes,main
 * - Emits main.dart when emitMain is true (YAML wins unless CLI explicitly sets it)
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
const { generateConnectivityServiceTemplate } = require('../generators/connectivity_service_generator');
const { generateSyncServiceTemplate } = require('../generators/sync_service_generator');
const { generateSamplePubspec } = require('../generators/pubspec_generator');

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
const { generateLocalDatabaseTemplate, generateDaoTemplate } = require('../generators/sqlite_generator');

const { generateLoginControllerTemplate } = require('../generators/login_controller_generator');
const { generateLoginViewTemplate } = require('../generators/login_view_generator');
const { generateSplashControllerTemplate } = require('../generators/splash_controller_generator');
const { generateSplashViewTemplate } = require('../generators/splash_view_generator');
const { generateHomeViewTemplate } = require('../generators/home_view_generator');
const { generateUnauthorizedViewTemplate } = require('../generators/unauthorized_view_generator');
const { generateForbiddenViewTemplate } = require('../generators/forbidden_view_generator');

const { generateMainDartTemplate } = require('../generators/main_dart_generator');

// ---- Parser / Utils ----
const { parseJdl } = require('../parser');
const {
  entityFileBase,
  entityClassName,
  controllerClassName,
  tableViewClassName,
  modelFileName,
  serviceFileName,
  controllerFileName,
  formFileName,
  tableViewFileName,
  enumFileName,
  resourcePlural,
} = require('../utils/naming');
const { writeFile } = require('../utils/file_writer');

function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 <jdlFile> --microservice <name> [options]')
    .option('config', { alias: 'c', type: 'string', describe: 'Path to YAML config (CLI overrides YAML)' })
    .option('microservice', { alias: 'm', type: 'string', describe: 'Microservice short name (e.g., dms)' })
    .option('apiHost', { alias: 'a', type: 'string', describe: 'Base host for the API (e.g., http://localhost:8080)' })
    .option('useGateway', { type: 'boolean', describe: 'Use JHipster gateway paths (/services/<svc>/api/**)' })
    .option('gatewayServiceName', { type: 'string', describe: 'Gateway service name (used if --useGateway)' })
    .option('outputDir', { alias: 'o', type: 'string', describe: 'Output directory (usually your Flutter lib/)' })
    .option('includeAuthGuards', { type: 'boolean', describe: 'Attach AuthMiddleware/RoleMiddleware to routes' })
    .option('emitMain', { type: 'boolean', describe: 'Also generate lib/main.dart (profiles-aware)' })
    .option('only', { type: 'string', describe: 'Only generate these entities (comma-separated)' })
    .option('skipParts', { type: 'string', describe: 'Skip parts: models,services,controllers,forms,views,enums,core,widgets,routes,main' })
    .option('force', { alias: 'f', type: 'boolean', default: false, describe: 'Overwrite existing files' })
    .help('h').alias('h', 'help')
    .version().alias('v', 'version')
    .epilog('FHipster — JDL → Flutter (GetX) generator')
    .argv;

  // YAML
  const yamlConfig = loadYamlConfig(argv.config);

  const enableSQLite = yamlConfig.enableSQLite ?? false;

  // Inputs
  const jdlFilePath = resolveJdlPath(argv._[0] || yamlConfig.jdlFile);
  const outputDir = path.resolve(process.cwd(), argv.outputDir || yamlConfig.outputDir || 'flutter_generated');

  const microserviceName = pick(argv.microservice, yamlConfig.microservice, null);
  if (!microserviceName) {
    console.error('❌ Missing required option: --microservice (or set microservice in YAML)');
    process.exit(1);
  }

  // Precedence: YAML wins when CLI not explicitly set
  const includeAuthGuards = argv.includeAuthGuards !== undefined ? argv.includeAuthGuards
                           : (yamlConfig.includeAuthGuards ?? true);
  const emitMain = argv.emitMain !== undefined ? argv.emitMain
                  : (yamlConfig.emitMain ?? false);

  const force = !!argv.force;

  // Partial gen flags
  const onlyEntities = parseCsv(argv.only || yamlConfig.only);
  const skipParts = new Set(parseCsv(argv.skipParts || yamlConfig.skipParts));
  const shouldGen = (part) => !skipParts.has(part);
  const entityAllowed = (name) =>
    !onlyEntities.length || onlyEntities.map(s => s.toLowerCase()).includes(String(name).toLowerCase());

  // Build profiles from YAML
  const { devProfile, prodProfile } = buildProfilesFromYaml(yamlConfig, argv);

  if (!fs.existsSync(jdlFilePath)) {
    console.error(`❌ JDL file not found at '${jdlFilePath}'`);
    process.exit(1);
  }

  // Parse JDL
  const jdlContent = fs.readFileSync(jdlFilePath, 'utf8');
  const { entities, enums, pluralOverrides: fromJdlPlural = {} } = parseJdl(jdlContent);
  devProfile.pluralOverrides = { ...(fromJdlPlural || {}), ...(devProfile.pluralOverrides || {}) };
  prodProfile.pluralOverrides = { ...(fromJdlPlural || {}), ...(prodProfile.pluralOverrides || {}) };

  // Dirs
  const dirs = resolveDirs(outputDir);
  ensureDirs(dirs);

  // Sample pubspec to track dependencies expected by generated code
  writeFile(
    path.join(dirs.projectRoot, 'pubspec.offline_sample.yaml'),
    generateSamplePubspec({ enableSQLite }),
    force,
    'pubspec.offline_sample.yaml'
  );

  // Header
  console.log(`\n📦 Output: '${outputDir}'`);
  console.log(`🔧 Microservice: '${microserviceName}'`);
  console.log(`🧩 Profiles: dev → ${devProfile.apiHost} | prod → ${prodProfile.apiHost}\n`);

  // Core / Env / Auth
  if (shouldGen('core')) {
    console.log('• Generating core/env/auth ...');

    writeFile(
      path.join(dirs.coreDir, 'env', 'env.dart'),
      generateEnvTemplate({ devProfile, prodProfile }),
      force,
      'core/env/env.dart'
    );

    writeFile(path.join(dirs.coreDir, 'api_client.dart'), generateApiClientTemplate(), force, 'core/api_client.dart');
    writeFile(path.join(dirs.coreAuthDir, 'auth_service.dart'), generateAuthServiceTemplate(), force, 'core/auth/auth_service.dart');
    writeFile(path.join(dirs.coreAuthDir, 'auth_middleware.dart'), generateAuthMiddlewareTemplate(), force, 'core/auth/auth_middleware.dart');
    writeFile(path.join(dirs.coreAuthDir, 'role_middleware.dart'), generateRoleMiddlewareTemplate(), force, 'core/auth/role_middleware.dart');
    writeFile(path.join(dirs.coreAuthDir, 'token_decoder.dart'), generateTokenDecoderTemplate(), force, 'core/auth/token_decoder.dart');

    writeFile(path.join(dirs.coreDir, 'app_shell.dart'), generateAppShellTemplate(), force, 'core/app_shell.dart');

    writeFile(
      path.join(dirs.coreConnectivityDir, 'connectivity_service.dart'),
      generateConnectivityServiceTemplate(),
      force,
      'core/connectivity/connectivity_service.dart'
    );
  }

  if (enableSQLite) {
    console.log('• Generating local SQLite cache ...');
    const entityNames = entities ? Object.keys(entities) : [];
    writeFile(
      path.join(dirs.localDir, 'local_database.dart'),
      generateLocalDatabaseTemplate(entityNames),
      force,
      'core/local/local_database.dart'
    );

    entityNames.forEach((entityName) => {
      const daoContent = generateDaoTemplate(entityName);
      writeFile(
        path.join(dirs.localDaoDir, `${entityFileBase(entityName)}_dao.dart`),
        daoContent,
        force,
        path.join('core/local/dao', `${entityFileBase(entityName)}_dao.dart`)
      );
    });

    writeFile(
      path.join(dirs.coreSyncDir, 'sync_service.dart'),
      generateSyncServiceTemplate(entityNames),
      force,
      'core/sync/sync_service.dart'
    );
  }

  // Widgets
  if (shouldGen('widgets')) {
    console.log('• Generating common widgets ...');
    writeFile(path.join(dirs.widgetsDir, 'fhipster_input_field.dart'), generateFHipsterInputFieldTemplate(), force, 'widgets/fhipster_input_field.dart');

    const tableWidgetFiles = generateTableWidgetsTemplates();
    Object.entries(tableWidgetFiles).forEach(([relPath, content]) => {
      writeFile(path.join(dirs.widgetsDir, relPath), content, force, path.join('widgets', relPath));
    });
  }

  // Enums
  if (shouldGen('enums') && enums && Object.keys(enums).length > 0) {
    console.log('• Generating enums ...');
    for (const [enumName, values] of Object.entries(enums)) {
      const eFile = enumFileName(enumName);
      writeFile(path.join(dirs.enumsDir, eFile), generateEnumTemplate(enumName, values), force, path.join('enums', eFile));
    }
  }

  // Entities
  console.log('• Generating entities (models/services/controllers/forms/views) ...');

  const entityRoutes = [];
  if (entities) {
    for (const [entityName, fields] of Object.entries(entities)) {
      if (!entityAllowed(entityName)) continue;

      const modelF = modelFileName(entityName);
      const serviceF = serviceFileName(entityName);
      const controllerF = controllerFileName(entityName);
      const formF = formFileName(entityName);
      const viewF = tableViewFileName(entityName);

      const tenantIsolation = {
        enabled: !!devProfile.tenantIsolationEnabled && !!devProfile.tenantFieldName && Array.isArray(fields) && fields.some(f => f?.name === devProfile.tenantFieldName),
        fieldName: devProfile.tenantFieldName,
      };

      if (devProfile.tenantIsolationEnabled && devProfile.tenantFieldName && !tenantIsolation.enabled) {
        console.warn(`⚠️ Tenant isolation enabled but field '${devProfile.tenantFieldName}' not found on entity '${entityName}'.`);
      }

      if (shouldGen('models')) {
        writeFile(path.join(dirs.modelsDir, modelF), generateModelTemplate(entityName, fields, enums), force, `models/${modelF}`);
      }
      if (shouldGen('services')) {
        writeFile(
          path.join(dirs.servicesDir, serviceF),
          generateServiceTemplate(entityName, {
            microserviceName: devProfile.gatewayServiceName || microserviceName,
            useGateway: !!devProfile.useGateway,
            tenantIsolation,
            enableSQLite,
          }),
          force,
          `services/${serviceF}`
        );
      }
      if (shouldGen('controllers')) {
        writeFile(path.join(dirs.controllersDir, controllerF), generateEntityControllerTemplate(entityName, fields, enums, { tenantIsolation }), force, `controllers/${controllerF}`);
      }
      if (shouldGen('forms')) {
        writeFile(path.join(dirs.formsDir, formF), generateFormTemplate(entityName, fields, enums, { tenantIsolation }), force, `forms/${formF}`);
      }
      if (shouldGen('views')) {
        writeFile(path.join(dirs.viewsDir, viewF), generateTableViewTemplate(entityName, fields, entities), force, `views/${viewF}`);
      }

      const pluralPathSeg = resourcePlural(entityName, devProfile.pluralOverrides || {});
      entityRoutes.push({
        path: `/${pluralPathSeg}`,
        controllerFile: controllerF,
        viewFile: viewF,
        controllerClass: controllerClassName(entityName),
        viewClass: tableViewClassName(entityName),
        roles: [],
      });
    }
  }

  // Static screens
  if (shouldGen('views') || shouldGen('controllers')) {
    console.log('• Generating static views/controllers ...');

    if (shouldGen('controllers')) {
      writeFile(path.join(dirs.controllersDir, 'splash_controller.dart'), generateSplashControllerTemplate(), force, 'controllers/splash_controller.dart');
      writeFile(path.join(dirs.controllersDir, 'login_controller.dart'), generateLoginControllerTemplate(), force, 'controllers/login_controller.dart');
    }
    if (shouldGen('views')) {
      writeFile(path.join(dirs.viewsDir, 'splash_view.dart'), generateSplashViewTemplate(), force, 'views/splash_view.dart');
      writeFile(path.join(dirs.viewsDir, 'login_view.dart'), generateLoginViewTemplate(), force, 'views/login_view.dart');
      writeFile(path.join(dirs.viewsDir, 'home_view.dart'), generateHomeViewTemplate(), force, 'views/home_view.dart');
      writeFile(path.join(dirs.viewsDir, 'unauthorized_view.dart'), generateUnauthorizedViewTemplate(), force, 'views/unauthorized_view.dart');
      writeFile(path.join(dirs.viewsDir, 'forbidden_view.dart'), generateForbiddenViewTemplate(), force, 'views/forbidden_view.dart');
    }
  }

  // Routes
  if (shouldGen('routes')) {
    writeFile(
      path.join(dirs.coreDir, 'routes.dart'),
      generateRoutesTemplate({ entityRoutes, includeAuthGuards }),
      force,
      'core/routes.dart'
    );
  }

  // main.dart
  if (emitMain && shouldGen('main')) {
    console.log('• Generating main.dart ...');
    writeFile(path.join(dirs.libDir, 'main.dart'), generateMainDartTemplate({ enableSQLite }), force, 'main.dart');
  }

  console.log('\n✅ Generation complete!');
  console.log("Next steps:");
  console.log("1) In Flutter: flutter pub add get get_storage responsive_grid");
  console.log("   (Optional security) flutter pub add flutter_secure_storage crypto");
  console.log("2) Run app: flutter run -t lib/main.dart --dart-define=ENV=dev");
  console.log(`3) Generated at: '${outputDir}'`);
}

// ---------- Profiles ----------

function buildProfilesFromYaml(yamlConfig, argv) {
  const base = {
    appName: yamlConfig.appName ?? 'FHipster',
    envName: yamlConfig.envName ?? 'dev',
    apiHost: yamlConfig.apiHost ?? 'http://localhost:8080',
    useGateway: yamlConfig.useGateway ?? false,
    gatewayServiceName: yamlConfig.gatewayServiceName ?? null,

    auth: yamlConfig.auth || { provider: 'keycloak', keycloak: {} },

    defaultPageSize: yamlConfig.defaultPageSize ?? 20,
    pageSizeOptions: yamlConfig.pageSizeOptions || [10, 20, 50, 100],
    defaultSort: yamlConfig.defaultSort || ['id,desc'],
    defaultSearchSort: yamlConfig.defaultSearchSort || ['_score,desc'],
    distinctByDefault: yamlConfig.distinctByDefault ?? false,

    totalCountHeaderName: yamlConfig.totalCountHeaderName || 'X-Total-Count',
    storageKeyAccessToken: yamlConfig.storageKeyAccessToken || 'fh_access_token',
    storageKeyAccessExpiry: yamlConfig.storageKeyAccessExpiry || 'fh_access_expiry',
    storageKeyRefreshToken: yamlConfig.storageKeyRefreshToken || 'fh_refresh_token',
    storageKeyRefreshExpiry: yamlConfig.storageKeyRefreshExpiry || 'fh_refresh_expiry',
    storageKeyRememberedUsername: yamlConfig.storageKeyRememberedUsername || 'fh_remembered_username',

    relationshipPayloadMode: yamlConfig.relationshipPayloadMode || 'idOnly',

    // Security options
    storageMode: yamlConfig.storageMode || 'get_storage',
    httpStrict: yamlConfig.httpStrict ?? false,
    pinnedSha256Certs: yamlConfig.pinnedSha256Certs || [],

    pluralOverrides: yamlConfig.pluralOverrides || {},

    tenantIsolationEnabled: yamlConfig.tenantIsolationEnabled ?? false,
    tenantFieldName: yamlConfig.tenantFieldName || null,

    syncIntervalMinutes: yamlConfig.syncIntervalMinutes ?? 15,
  };

  // CLI quick overrides
  if (argv.apiHost) base.apiHost = argv.apiHost;
  if (typeof argv.useGateway === 'boolean') base.useGateway = argv.useGateway;
  if (argv.gatewayServiceName) base.gatewayServiceName = argv.gatewayServiceName;

  const devIn = (yamlConfig.profiles || {}).dev || {};
  const prodIn = (yamlConfig.profiles || {}).prod || {};

  const dev = normalizeProfile(devIn, base);
  const prod = normalizeProfile(prodIn, base, { envName: 'prod', appName: base.appName });

  return { devProfile: dev, prodProfile: prod };
}

function normalizeProfile(pIn, base, hard = {}) {
  const authIn = pIn.auth || base.auth || {};
  const kcIn = authIn.keycloak || {};

  return {
    appName: valueOr(pIn.appName, base.appName, hard.appName),
    envName: valueOr(pIn.envName, base.envName, hard.envName),
    apiHost: valueOr(pIn.apiHost, base.apiHost),
    useGateway: valueOrBool(pIn.useGateway, base.useGateway),
    gatewayServiceName: valueOr(pIn.gatewayServiceName, base.gatewayServiceName),

    authProvider: authIn.provider || base.auth.provider || 'keycloak',
    jwtAuthEndpoint: authIn.jwtAuthEndpoint || '/api/authenticate',
    accountEndpoint: authIn.accountEndpoint || '/api/account',
    allowCredentialCacheForJwt: valueOrBool(authIn.allowCredentialCacheForJwt, false),

    keycloakTokenEndpoint: kcIn.tokenEndpoint || null,
    keycloakLogoutEndpoint: kcIn.logoutEndpoint || null,
    keycloakAuthorizeEndpoint: kcIn.authorizeEndpoint || null,
    keycloakUserinfoEndpoint: kcIn.userinfoEndpoint || null,
    keycloakClientId: kcIn.clientId || null,
    keycloakClientSecret: kcIn.clientSecret || null,
    keycloakScopes: Array.isArray(kcIn.scopes) && kcIn.scopes.length > 0 ? kcIn.scopes : ['openid','profile','email','offline_access'],

    defaultPageSize: valueOrNum(pIn.defaultPageSize, base.defaultPageSize),
    pageSizeOptions: Array.isArray(pIn.pageSizeOptions) ? pIn.pageSizeOptions : base.pageSizeOptions,
    defaultSort: Array.isArray(pIn.defaultSort) ? pIn.defaultSort : base.defaultSort,
    defaultSearchSort: Array.isArray(pIn.defaultSearchSort) ? pIn.defaultSearchSort : base.defaultSearchSort,
    distinctByDefault: valueOrBool(pIn.distinctByDefault, base.distinctByDefault),

    totalCountHeaderName: valueOr(pIn.totalCountHeaderName, base.totalCountHeaderName),
    storageKeyAccessToken: valueOr(pIn.storageKeyAccessToken, base.storageKeyAccessToken),
    storageKeyAccessExpiry: valueOr(pIn.storageKeyAccessExpiry, base.storageKeyAccessExpiry),
    storageKeyRefreshToken: valueOr(pIn.storageKeyRefreshToken, base.storageKeyRefreshToken),
    storageKeyRefreshExpiry: valueOr(pIn.storageKeyRefreshExpiry, base.storageKeyRefreshExpiry),
    storageKeyRememberedUsername: valueOr(pIn.storageKeyRememberedUsername, base.storageKeyRememberedUsername),

    relationshipPayloadMode: valueOr(pIn.relationshipPayloadMode, base.relationshipPayloadMode),

    storageMode: valueOr(pIn.storageMode, base.storageMode),
    httpStrict: valueOrBool(pIn.httpStrict, base.httpStrict),
    pinnedSha256Certs: Array.isArray(pIn.pinnedSha256Certs) ? pIn.pinnedSha256Certs : base.pinnedSha256Certs,

    pluralOverrides: {
      ...(base.pluralOverrides || {}),
      ...(pIn.pluralOverrides || {}),
    },

    tenantIsolationEnabled: valueOrBool(pIn.tenantIsolationEnabled, base.tenantIsolationEnabled),
    tenantFieldName: valueOr(pIn.tenantFieldName, base.tenantFieldName),

    syncIntervalMinutes: valueOrNum(pIn.syncIntervalMinutes, base.syncIntervalMinutes),
  };
}

// ---------- YAML / FS helpers ----------

function resolveDirs(rootOut) {
  const libDir = rootOut;
  return {
    libDir,
    projectRoot: path.resolve(libDir, '..'),
    coreDir: path.join(libDir, 'core'),
    coreAuthDir: path.join(libDir, 'core', 'auth'),
    coreEnvDir: path.join(libDir, 'core', 'env'),
    coreConnectivityDir: path.join(libDir, 'core', 'connectivity'),
    coreSyncDir: path.join(libDir, 'core', 'sync'),
    modelsDir: path.join(libDir, 'models'),
    servicesDir: path.join(libDir, 'services'),
    controllersDir: path.join(libDir, 'controllers'),
    formsDir: path.join(libDir, 'forms'),
    viewsDir: path.join(libDir, 'views'),
    widgetsDir: path.join(libDir, 'widgets'),
    widgetsTableDir: path.join(libDir, 'widgets', 'table'),
    widgetsCommonDir: path.join(libDir, 'widgets', 'common'),
    enumsDir: path.join(libDir, 'enums'),
    localDir: path.join(libDir, 'core', 'local'),
    localDaoDir: path.join(libDir, 'core', 'local', 'dao'),
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
    dirs.coreConnectivityDir,
    dirs.coreSyncDir,
    dirs.localDir,
    dirs.localDaoDir,
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
  const root = { ...(data || {}) };
  const proj = root.project || {};

  return {
    enableSQLite: pickBool(root.enableSQLite, proj.enableSQLite, false) ?? false,
    jdlFile: root.jdlFile || proj.jdlFile,
    outputDir: root.outputDir || proj.outputDir,
    microservice: root.microservice || proj.microservice,

    appName: root.appName || proj.appName,
    envName: root.envName || proj.envName,
    includeAuthGuards: pickBool(root.includeAuthGuards, proj.includeAuthGuards, undefined),
    emitMain: pickBool(root.emitMain, proj.emitMain, undefined),

    apiHost: root.apiHost || proj.apiHost,
    useGateway: pickBool(root.useGateway, proj.useGateway, undefined),
    gatewayServiceName: root.gatewayServiceName || proj.gatewayServiceName,

    auth: root.auth || proj.auth,

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

    storageMode: root.storageMode || proj.storageMode,
    httpStrict: pickBool(root.httpStrict, proj.httpStrict, undefined),
    pinnedSha256Certs: root.pinnedSha256Certs || proj.pinnedSha256Certs,

    pluralOverrides: root.pluralOverrides || proj.pluralOverrides || {},

    tenantIsolationEnabled: pickBool(root.tenantIsolationEnabled, proj.tenantIsolationEnabled, undefined),
    tenantFieldName: root.tenantFieldName || proj.tenantFieldName,

    profiles: root.profiles || proj.profiles || {},

    // Optional passthroughs for partial gen
    only: root.only || proj.only,
    skipParts: root.skipParts || proj.skipParts,

    syncIntervalMinutes: root.syncIntervalMinutes ?? proj.syncIntervalMinutes,
  };
}

function pick(...vals) {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
}
function pickBool(...vals) {
  for (const v of vals) if (v === true || v === false) return v;
  return undefined;
}
function valueOr(v, fallback, hardOverride) {
  if (hardOverride !== undefined) return hardOverride;
  return v !== undefined ? v : fallback;
}
function valueOrBool(v, fallback) {
  return (v === true || v === false) ? v : !!fallback;
}
function valueOrNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : Number(fallback);
}
function parseCsv(s) {
  if (!s) return [];
  return String(s).split(',').map(x => x.trim()).filter(Boolean);
}
function resolveJdlPath(jdlFromArgOrYaml) {
  if (!jdlFromArgOrYaml) {
    console.error('❌ Missing JDL file path (provide as first arg or set jdlFile in YAML).');
    process.exit(1);
  }
  return path.resolve(process.cwd(), jdlFromArgOrYaml);
}

main();
