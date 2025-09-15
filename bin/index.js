#!/usr/bin/env node

/**
 * FHipster CLI (profiles-aware)
 * JDL → Flutter (GetX) lib/ generator
 *
 * - Reads YAML config (supports profiles.dev & profiles.prod)
 * - Bakes both profiles into env.dart (Env.initGenerated + Env.setProfile)
 * - Optional: emits a minimal main.dart
 * - Generates core, auth, widgets, enums, entities (models/services/controllers/forms/views), routes
 *
 * Usage:
 *   fhipster --config ./fhipster.config.yaml [-f]
 *   fhipster <jdlFile> --microservice <name> [options]
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

const { generateMainDartTemplate } = require('../generators/main_dart_generator');

// ---- Parser / Utils ----
const { parseJdl } = require('../parser'); // ../parser/index.js
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

// ------------------------------------------------------------

function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 <jdlFile> --microservice <name> [options]')
    .option('config', {
      alias: 'c',
      type: 'string',
      describe: 'Path to YAML config (CLI flags override YAML)',
    })
    .option('microservice', {
      alias: 'm',
      type: 'string',
      describe: 'Microservice short name (e.g., dms)',
    })
    .option('apiHost', {
      alias: 'a',
      type: 'string',
      describe: 'Base host for the API (e.g., http://localhost:8080)',
    })
    .option('useGateway', {
      type: 'boolean',
      describe: 'Use JHipster gateway paths (/services/<svc>/api/**)',
    })
    .option('gatewayServiceName', {
      type: 'string',
      describe: 'Gateway service name (e.g., dms). Used if --useGateway is true',
    })
    .option('outputDir', {
      alias: 'o',
      type: 'string',
      describe: 'Output directory (copy/point this to your Flutter project’s lib/)',
    })
    .option('includeAuthGuards', {
      type: 'boolean',
      describe: 'Attach AuthMiddleware/RoleMiddleware to secured routes',
      default: undefined,
    })
    .option('emitMain', {
      type: 'boolean',
      default: true,
      describe: 'Also generate lib/main.dart populated from config (profiles-aware)',
    })
    .option('force', {
      alias: 'f',
      type: 'boolean',
      default: false,
      describe: 'Overwrite existing files without prompting',
    })
    .help('h').alias('h', 'help')
    .version().alias('v', 'version')
    .epilog('FHipster — JDL → Flutter (GetX) generator')
    .argv;

  // 1) Load YAML if provided or auto-detected
  const yamlConfig = loadYamlConfig(argv.config);

  // 2) Resolve inputs (CLI > YAML > defaults)
  const jdlFilePath = resolveJdlPath(argv._[0] || yamlConfig.jdlFile);
  const outputDir = path.resolve(process.cwd(), argv.outputDir || yamlConfig.outputDir || 'flutter_generated');

  const microserviceName = pick(argv.microservice, yamlConfig.microservice, null);
  if (!microserviceName) {
    console.error('❌ Missing required option: --microservice (or set microservice in YAML)');
    process.exit(1);
  }

  const includeAuthGuards = pickBool(argv.includeAuthGuards, yamlConfig.includeAuthGuards, true);
  const emitMain = pickBool(argv.emitMain, yamlConfig.emitMain, false);
  const force = !!argv.force;

  // Build profiles (dev & prod) from YAML (with top-level fallbacks & optional CLI overrides)
  const { devProfile, prodProfile } = buildProfilesFromYaml(yamlConfig, argv);

  if (!fs.existsSync(jdlFilePath)) {
    console.error(`❌ JDL file not found at '${jdlFilePath}'`);
    process.exit(1);
  }

  // Parse JDL
  const jdlContent = fs.readFileSync(jdlFilePath, 'utf8');
  const { entities, enums, pluralOverrides: fromJdlPlural = {} } = parseJdl(jdlContent);
  // Merge plural overrides into each profile (favor YAML explicit map)
  devProfile.pluralOverrides = { ...(fromJdlPlural || {}), ...(devProfile.pluralOverrides || {}) };
  prodProfile.pluralOverrides = { ...(fromJdlPlural || {}), ...(prodProfile.pluralOverrides || {}) };

  // Directories (under lib/)
  const dirs = resolveDirs(outputDir);
  ensureDirs(dirs);

  // A friendly header with summary
  console.log(`\n📦 Output: '${outputDir}'`);
  console.log(`🔧 Microservice: '${microserviceName}'`);
  console.log(`🧩 Profiles: dev → ${devProfile.apiHost} | prod → ${prodProfile.apiHost}`);
  if (devProfile.useGateway) {
    console.log(`🧭 Gateway mode (dev): ON (service: ${devProfile.gatewayServiceName || '(unset)'})`);
  }
  if (prodProfile.useGateway) {
    console.log(`🧭 Gateway mode (prod): ON (service: ${prodProfile.gatewayServiceName || '(unset)'})`);
  }
  console.log('');

  // ---------------- Core / Env / Auth ----------------
  console.log('• Generating core/env/auth ...');

  // Env (bakes both profiles; main can Env.setProfile('dev'|'prod'))
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
      const eFile = enumFileName(enumName);
      writeFile(path.join(dirs.enumsDir, eFile), generateEnumTemplate(enumName, values), force, path.join('enums', eFile));
    }
  }

  // ---------------- Per-entity generation ----------------
  console.log('• Generating entities (models/services/controllers/forms/views) ...');

  /** Build route registrations */
  const entityRoutes = [];

  if (entities) {
    for (const [entityName, fields] of Object.entries(entities)) {
      const fileBase = entityFileBase(entityName); // camel base for file names
      const modelF = modelFileName(entityName);
      const serviceF = serviceFileName(entityName);
      const controllerF = controllerFileName(entityName);
      const formF = formFileName(entityName);
      const viewF = tableViewFileName(entityName);

      // Models
      writeFile(
        path.join(dirs.modelsDir, modelF),
        generateModelTemplate(entityName, fields, enums),
        force,
        `models/${modelF}`
      );

      // Services (template uses Env.apiBasePath; microservice name is passed)
      writeFile(
        path.join(dirs.servicesDir, serviceF),
        generateServiceTemplate(entityName, microserviceName, devProfile.apiHost),
        force,
        `services/${serviceF}`
      );

      // Controllers
      writeFile(
        path.join(dirs.controllersDir, controllerF),
        generateEntityControllerTemplate(entityName, fields, enums),
        force,
        `controllers/${controllerF}`
      );

      // Forms
      writeFile(
        path.join(dirs.formsDir, formF),
        generateFormTemplate(entityName, fields, enums),
        force,
        `forms/${formF}`
      );

      // Table view
      writeFile(
        path.join(dirs.viewsDir, viewF),
        generateTableViewTemplate(entityName, fields),
        force,
        `views/${viewF}`
      );

      // Route path (plural, lowercase; allow overrides)
      const pluralPathSeg = resourcePlural(entityName, devProfile.pluralOverrides || {});
      entityRoutes.push({
        path: `/${pluralPathSeg}`,
        controllerFile: controllerF,
        viewFile: viewF,
        controllerClass: controllerClassName(entityName),
        viewClass: tableViewClassName(entityName),
        roles: [], // add per-entity roles if desired
      });
    }
  }

  // ---------------- Static screens ----------------
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

  // Optional: emit main.dart (profiles-aware, simple switch)
  if (emitMain) {
    writeFile(
      path.join(dirs.libDir, 'main.dart'),
      generateMainDartTemplate(), // minimal main uses Env.initGenerated() & Env.setProfile()
      force,
      'main.dart'
    );
  }

  // ---------------- Done ----------------
  console.log('\n✅ Generation complete!');
  console.log('Next steps:');
  console.log("1) In your Flutter app's main.dart (if not emitted):  Env.initGenerated(); Env.setProfile('dev');");
  console.log("   Or run with:  flutter run -t lib/main.dart --dart-define=ENV=prod");
  console.log("2) Ensure Flutter deps:  flutter pub add get get_storage responsive_grid");
  console.log("3) Set initialRoute to AppRoutes.splash and use GetMaterialApp with AppRoutes.pages.");
  console.log(`4) Copy '${outputDir}' into your Flutter project's 'lib' (or generate directly to ./lib).`);
}

// ------------------------------------------------------------
// Profiles builder from YAML

function buildProfilesFromYaml(yamlConfig, argv) {
  // Top-level defaults used as fallbacks:
  const commonDefaults = {
    appName: yamlConfig.appName ?? 'FHipster',
    envName: yamlConfig.envName ?? 'dev',

    apiHost: yamlConfig.apiHost ?? 'http://localhost:8080',
    useGateway: yamlConfig.useGateway ?? false,
    gatewayServiceName: yamlConfig.gatewayServiceName ?? null,

    auth: yamlConfig.auth || { provider: 'keycloak', keycloak: {} },

    // Paging / sorting
    defaultPageSize: yamlConfig.defaultPageSize ?? 20,
    pageSizeOptions: yamlConfig.pageSizeOptions || [10, 20, 50, 100],
    defaultSort: yamlConfig.defaultSort || ['id,desc'],
    defaultSearchSort: yamlConfig.defaultSearchSort || ['_score,desc'],
    distinctByDefault: yamlConfig.distinctByDefault ?? false,

    // Headers / storage
    totalCountHeaderName: yamlConfig.totalCountHeaderName || 'X-Total-Count',
    storageKeyAccessToken: yamlConfig.storageKeyAccessToken || 'fh_access_token',
    storageKeyAccessExpiry: yamlConfig.storageKeyAccessExpiry || 'fh_access_expiry',
    storageKeyRefreshToken: yamlConfig.storageKeyRefreshToken || 'fh_refresh_token',
    storageKeyRefreshExpiry: yamlConfig.storageKeyRefreshExpiry || 'fh_refresh_expiry',
    storageKeyRememberedUsername: yamlConfig.storageKeyRememberedUsername || 'fh_remembered_username',

    relationshipPayloadMode: yamlConfig.relationshipPayloadMode || 'idOnly',
    pluralOverrides: yamlConfig.pluralOverrides || {},
  };

  // CLI overrides for quick tweaks (optional)
  if (argv.apiHost) commonDefaults.apiHost = argv.apiHost;
  if (typeof argv.useGateway === 'boolean') commonDefaults.useGateway = argv.useGateway;
  if (argv.gatewayServiceName) commonDefaults.gatewayServiceName = argv.gatewayServiceName;

  const profilesYaml = yamlConfig.profiles || {};
  const devIn = profilesYaml.dev || {};
  const prodIn = profilesYaml.prod || {};

  const dev = normalizeProfile(devIn, commonDefaults);
  const prod = normalizeProfile(prodIn, commonDefaults, { envName: 'prod', appName: commonDefaults.appName });

  return { devProfile: dev, prodProfile: prod };
}

function normalizeProfile(pIn, base, hardOverrides = {}) {
  const authIn = pIn.auth || base.auth || {};
  const kcIn = authIn.keycloak || {};

  return {
    // identity/network
    appName: valueOr(pIn.appName, base.appName, hardOverrides.appName),
    envName: valueOr(pIn.envName, base.envName, hardOverrides.envName),
    apiHost: valueOr(pIn.apiHost, base.apiHost),
    useGateway: valueOrBool(pIn.useGateway, base.useGateway),
    gatewayServiceName: valueOr(pIn.gatewayServiceName, base.gatewayServiceName),

    // auth
    authProvider: authIn.provider || base.auth.provider || 'keycloak',

    // JWT
    jwtAuthEndpoint: authIn.jwtAuthEndpoint || '/api/authenticate',
    accountEndpoint: authIn.accountEndpoint || '/api/account',
    allowCredentialCacheForJwt: valueOrBool(authIn.allowCredentialCacheForJwt, false),

    // Keycloak
    keycloakTokenEndpoint: kcIn.tokenEndpoint || null,
    keycloakLogoutEndpoint: kcIn.logoutEndpoint || null,
    keycloakAuthorizeEndpoint: kcIn.authorizeEndpoint || null,
    keycloakUserinfoEndpoint: kcIn.userinfoEndpoint || null,
    keycloakClientId: kcIn.clientId || null,
    keycloakClientSecret: kcIn.clientSecret || null,
    keycloakScopes: Array.isArray(kcIn.scopes) && kcIn.scopes.length > 0
      ? kcIn.scopes
      : ['openid', 'profile', 'email', 'offline_access'],

    // paging/sorting & keys
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
    pluralOverrides: base.pluralOverrides || {},
  };
}

// ------------------------------------------------------------
// FS & YAML helpers

function resolveDirs(rootOut) {
  const libDir = rootOut; // generate a lib/ tree (user may pass ./lib)
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
  // Accept either flat keys or nested under "project"
  const root = { ...(data || {}) };
  const proj = root.project || {};

  // Direct passthrough of new schema fields (profiles supported)
  return {
    jdlFile: root.jdlFile || proj.jdlFile,
    outputDir: root.outputDir || proj.outputDir,
    microservice: root.microservice || proj.microservice,

    // Common defaults
    appName: root.appName || proj.appName,
    envName: root.envName || proj.envName,
    includeAuthGuards: pickBool(root.includeAuthGuards, proj.includeAuthGuards, undefined),
    emitMain: pickBool(root.emitMain, proj.emitMain, undefined),

    apiHost: root.apiHost || proj.apiHost,
    useGateway: pickBool(root.useGateway, proj.useGateway, undefined),
    gatewayServiceName: root.gatewayServiceName || proj.gatewayServiceName,

    // Auth (legacy single-profile style)
    auth: root.auth || proj.auth,

    // Optional defaults
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

    pluralOverrides: root.pluralOverrides || proj.pluralOverrides || {},

    // New: profiles block
    profiles: root.profiles || proj.profiles || {},
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

function resolveJdlPath(jdlFromArgOrYaml) {
  if (!jdlFromArgOrYaml) {
    console.error('❌ Missing JDL file path (provide as first arg or set jdlFile in YAML).');
    process.exit(1);
  }
  return path.resolve(process.cwd(), jdlFromArgOrYaml);
}

main();
