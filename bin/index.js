#!/usr/bin/env node

/**
 * FHipster CLI
 *  - Reads a JDL file and generates a Flutter (GetX) app scaffold under an output dir.
 *  - Includes: env, api client (Keycloak + refresh), routes, app shell, auth middleware/service,
 *    models (with relationships), services (GET/POST/PUT/PATCH/DELETE + JPA criteria + ES search),
 *    controllers (paging/search/relations), forms (ResponsiveGrid), table views (search/pagination/h-scroll + dialogs),
 *    common/table widgets, and basic views (splash/login/home/unauthorized/forbidden).
 *
 * Usage:
 *   fhipster <path/to/app.jdl> --microservice dms [--apiHost http://localhost:8080] [--useGateway] [--gatewayServiceName dms] [--outputDir lib] [--force]
 *
 * Example:
 *   fhipster ./example.jdl -m dms -a http://localhost:8080 -g -s dms -o flutter_generated
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// ---- Parsers / utils ----
const { parseJdl } = require('../parser');
const { jdlToDartType } = require('../parser/type_mapping');
const { normalizeRelationships } = require('../parser/relationship_mapping');

// ---- Generators ----
const { generateEnvTemplate } = require('../generators/env_generator');

const { generateApiClientTemplate } = require('../generators/api_client_generator');
const { generateAppShellTemplate } = require('../generators/app_shell_generator');
const { generateRoutesTemplate } = require('../generators/routes_generator');

const { generateEnumTemplate } = require('../generators/enum_generator');
const { generateModelTemplate } = require('../generators/model_generator');
const { generateServiceTemplate } = require('../generators/service_generator');
const { generateEntityControllerTemplate } = require('../generators/entity_controller_generator');
const { generateFormTemplate } = require('../generators/form_generator');
const { generateTableViewTemplate } = require('../generators/table_view_generator');

const { generateLoginControllerTemplate } = require('../generators/login_controller_generator');
const { generateLoginViewTemplate } = require('../generators/login_view_generator');
const { generateSplashControllerTemplate } = require('../generators/splash_controller_generator');
const { generateSplashViewTemplate } = require('../generators/splash_view_generator');
const { generateHomeViewTemplate } = require('../generators/home_view_generator');

const { generateFHipsterInputFieldTemplate } = require('../generators/fhipster_input_field_generator');

const { generateAuthServiceTemplate } = require('../generators/auth_service_generator');
const { generateTokenDecoderTemplate } = require('../generators/token_decoder_generator');
const { generateAuthMiddlewareTemplate } = require('../generators/auth_middleware_generator');
const { generateRoleMiddlewareTemplate } = require('../generators/role_middleware_generator');
const { generateUnauthorizedViewTemplate } = require('../generators/unauthorized_view_generator');
const { generateForbiddenViewTemplate } = require('../generators/forbidden_view_generator');

const {
  generateSearchFieldTemplate,
  generatePaginationBarTemplate,
  generateTableToolbarTemplate,
} = require('../generators/table_widgets_generator');

// -------------- CLI --------------

function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 <jdlFile> --microservice <name> [options]')
    .demandCommand(1, 'You must provide the path to the JDL file.')
    .option('microservice', {
      alias: 'm',
      type: 'string',
      describe: 'Microservice short name (e.g., dms)',
      demandOption: true,
    })
    .option('apiHost', {
      alias: 'a',
      type: 'string',
      describe: 'Base host for the API (e.g., http://localhost:8080)',
      default: 'http://localhost:8080',
    })
    .option('useGateway', {
      alias: 'g',
      type: 'boolean',
      describe: 'Use JHipster gateway paths (/services/<svc>/api/...)',
      default: false,
    })
    .option('gatewayServiceName', {
      alias: 's',
      type: 'string',
      describe: 'Gateway service name (e.g., dms). Used if --useGateway is true.',
      default: 'app',
    })
    .option('outputDir', {
      alias: 'o',
      type: 'string',
      describe: 'Output directory (copy/point this to your Flutter project’s lib/)',
      default: 'flutter_generated',
    })
    .option('pluralOverridesJson', {
      type: 'string',
      describe:
        'JSON map of entity plural overrides, e.g. {"Person":"people","Address":"addresses"}',
      default: '{}',
    })
    .option('force', {
      alias: 'f',
      type: 'boolean',
      describe: 'Overwrite existing files',
      default: false,
    })
    .help('h')
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .epilog('FHipster — JDL → Flutter (GetX) generator')
    .argv;

  const jdlFilePath = path.resolve(String(argv._[0]));
  const outputDir = path.resolve(String(argv.outputDir));
  const microserviceName = String(argv.microservice);
  const apiHost = String(argv.apiHost);
  const useGateway = !!argv.useGateway;
  const gatewayServiceName = String(argv.gatewayServiceName);
  const force = !!argv.force;

  let pluralOverrides = {};
  try {
    pluralOverrides = JSON.parse(String(argv.pluralOverridesJson || '{}'));
  } catch (e) {
    console.warn('⚠️ Could not parse pluralOverridesJson. Using empty map.');
  }

  if (!fs.existsSync(jdlFilePath)) {
    console.error(`❌ JDL file not found at '${jdlFilePath}'`);
    process.exit(1);
  }

  // -------------- Read & parse JDL --------------
  const jdlContent = fs.readFileSync(jdlFilePath, 'utf8');
  const parsed = parseJdl(jdlContent); // { entities, enums, relationships? }
  const entities = parsed.entities || {};
  const enums = parsed.enums || {};

  // normalize relationships (O2O/M2O/O2M/M2M) onto fields in entities
  normalizeRelationships(entities);

  // enrich fields with dartType for convenience
  Object.entries(entities).forEach(([entityName, fields]) => {
    fields.forEach((f) => {
      f.dartType = jdlToDartType(f.type, enums);
    });
  });

  // -------------- Create directories --------------
  const dirs = computeDirs(outputDir);
  Object.values(dirs).forEach((d) => ensureDir(d));
  ensureDir(path.join(dirs.coreDir, 'auth'));
  ensureDir(path.join(dirs.coreDir, 'env'));
  ensureDir(path.join(dirs.widgetsDir, 'table'));
  ensureDir(path.join(dirs.widgetsDir, 'common'));

  console.log(`\n📁 Output: ${outputDir}\n`);

  // -------------- Core / Env / Auth --------------
  writeFile(path.join(dirs.coreDir, 'env', 'env.dart'), generateEnvTemplate({
    apiHost,
    useGateway,
    gatewayServiceName,
    pluralOverrides,
  }), force, 'core/env/env.dart');

  writeFile(path.join(dirs.coreDir, 'api_client.dart'), generateApiClientTemplate(), force, 'core/api_client.dart');
  writeFile(path.join(dirs.coreDir, 'app_shell.dart'), generateAppShellTemplate(), force, 'core/app_shell.dart');

  // Auth service + middleware + token decoder
  writeFile(path.join(dirs.coreDir, 'auth', 'auth_service.dart'), generateAuthServiceTemplate(), force, 'core/auth/auth_service.dart');
  writeFile(path.join(dirs.coreDir, 'auth', 'token_decoder.dart'), generateTokenDecoderTemplate(), force, 'core/auth/token_decoder.dart');
  writeFile(path.join(dirs.coreDir, 'auth', 'auth_middleware.dart'), generateAuthMiddlewareTemplate(), force, 'core/auth/auth_middleware.dart');
  writeFile(path.join(dirs.coreDir, 'auth', 'role_middleware.dart'), generateRoleMiddlewareTemplate(), force, 'core/auth/role_middleware.dart');

  // -------------- Widgets --------------
  writeFile(path.join(dirs.widgetsDir, 'fhipster_input_field.dart'), generateFHipsterInputFieldTemplate(), force, 'widgets/fhipster_input_field.dart');

  // table widgets
  writeFile(path.join(dirs.widgetsDir, 'table', 'fhipster_search_field.dart'), generateSearchFieldTemplate(), force, 'widgets/table/fhipster_search_field.dart');
  writeFile(path.join(dirs.widgetsDir, 'table', 'fhipster_pagination_bar.dart'), generatePaginationBarTemplate(), force, 'widgets/table/fhipster_pagination_bar.dart');
  writeFile(path.join(dirs.widgetsDir, 'table', 'fhipster_table_toolbar.dart'), generateTableToolbarTemplate(), force, 'widgets/table/fhipster_table_toolbar.dart');

  // common widgets
  writeFile(path.join(dirs.widgetsDir, 'common', 'empty_state.dart'), emptyStateTemplate(), force, 'widgets/common/empty_state.dart');
  writeFile(path.join(dirs.widgetsDir, 'common', 'confirm_dialog.dart'), confirmDialogTemplate(), force, 'widgets/common/confirm_dialog.dart');

  // -------------- Auth-related views --------------
  writeFile(path.join(dirs.viewsDir, 'unauthorized_view.dart'), generateUnauthorizedViewTemplate(), force, 'views/unauthorized_view.dart');
  writeFile(path.join(dirs.viewsDir, 'forbidden_view.dart'), generateForbiddenViewTemplate(), force, 'views/forbidden_view.dart');

  // -------------- Basic controllers/views --------------
  writeFile(path.join(dirs.controllersDir, 'login_controller.dart'), generateLoginControllerTemplate(), force, 'controllers/login_controller.dart');
  writeFile(path.join(dirs.viewsDir, 'login_view.dart'), generateLoginViewTemplate(), force, 'views/login_view.dart');

  writeFile(path.join(dirs.controllersDir, 'splash_controller.dart'), generateSplashControllerTemplate(), force, 'controllers/splash_controller.dart');
  writeFile(path.join(dirs.viewsDir, 'splash_view.dart'), generateSplashViewTemplate(), force, 'views/splash_view.dart');

  writeFile(path.join(dirs.viewsDir, 'home_view.dart'), generateHomeViewTemplate(), force, 'views/home_view.dart');

  // -------------- Enums --------------
  Object.entries(enums).forEach(([enumName, values]) => {
    const file = path.join(dirs.enumsDir, `${lcFirst(enumName)}_enum.dart`);
    writeFile(file, generateEnumTemplate(enumName, values), force, `enums/${lcFirst(enumName)}_enum.dart`);
  });

  // -------------- Entities --------------
  const entityRoutes = [];
  Object.entries(entities).forEach(([entityName, fields]) => {
    const instance = lcFirst(entityName);

    // model (with relationship imports + object/list fields)
    writeFile(
      path.join(dirs.modelsDir, `${instance}_model.dart`),
      generateModelTemplate(entityName, fields, enums),
      force,
      `models/${instance}_model.dart`
    );

    // service (CRUD + criteria + ES search; uses Env at runtime)
    writeFile(
      path.join(dirs.servicesDir, `${instance}_service.dart`),
      generateServiceTemplate(entityName, { microserviceName, useGateway }),
      force,
      `services/${instance}_service.dart`
    );

    // controller (paging/search/relations + CRUD)
    writeFile(
      path.join(dirs.controllersDir, `${instance}_controller.dart`),
      generateEntityControllerTemplate(entityName, fields, enums),
      force,
      `controllers/${instance}_controller.dart`
    );

    // form (stateless GetView + ResponsiveGrid + relations)
    writeFile(
      path.join(dirs.formsDir, `${instance}_form.dart`),
      generateFormTemplate(entityName, fields, enums),
      force,
      `forms/${instance}_form.dart`
    );

    // table view (search + pagination + h-scroll + dialogs)
    writeFile(
      path.join(dirs.viewsDir, `${instance}_table_view.dart`),
      generateTableViewTemplate(entityName, fields),
      force,
      `views/${instance}_table_view.dart`
    );

    entityRoutes.push({
      path: `/${instance}`,
      controllerFile: `${instance}_controller.dart`,
      viewFile: `${instance}_table_view.dart`,
      controllerClass: `${entityName}Controller`,
      viewClass: `${entityName}TableView`,
      // roles can be added later if you want per-route guards
      roles: [], // e.g., ['ROLE_USER']
    });
  });

  // -------------- Routes (GetPages + bindings + middleware) --------------
  writeFile(
    path.join(dirs.coreDir, 'routes.dart'),
    generateRoutesTemplate({
      entityRoutes,
      includeAuthGuards: true,
    }),
    force,
    'core/routes.dart'
  );

  // -------------- Done --------------
  console.log('\n✅ Generation complete!');
  console.log('Next steps:');
  console.log(`  1) Point --outputDir to your Flutter project's "lib/" OR copy "${outputDir}" into "lib/".`);
  console.log('  2) In main.dart, call Env.init(); then set up GetMaterialApp with routes from core/routes.dart.');
  console.log('  3) Configure Keycloak realm/client in core/env/env.dart (or pass --dart-define overrides at build time).');
  console.log('  4) Run and profit 🚀');
}

// -------------- Helpers --------------

function computeDirs(base) {
  const coreDir = path.join(base, 'core');
  return {
    base,
    coreDir,
    enumsDir: path.join(base, 'enums'),
    modelsDir: path.join(base, 'models'),
    servicesDir: path.join(base, 'services'),
    controllersDir: path.join(base, 'controllers'),
    formsDir: path.join(base, 'forms'),
    viewsDir: path.join(base, 'views'),
    widgetsDir: path.join(base, 'widgets'),
  };
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function writeFile(absPath, content, force, label) {
  ensureDir(path.dirname(absPath));
  if (fs.existsSync(absPath) && !force) {
    console.log(`  ↩︎  Skipped (exists): ${label || absPath}`);
    return;
  }
  fs.writeFileSync(absPath, content, 'utf8');
  console.log(`  ✍️  Wrote: ${label || absPath}`);
}

function lcFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

// Minimal common widget templates inline so index.js can run without those generators.
// (Real projects can move these to dedicated generator files if preferred.)
function emptyStateTemplate() {
  return `import 'package:flutter/material.dart';

class EmptyState extends StatelessWidget {
  final String title;
  final String? subtitle;
  const EmptyState({super.key, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.inbox, size: 48),
        const SizedBox(height: 8),
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Text(subtitle!, style: Theme.of(context).textTheme.bodySmall),
        ],
      ]),
    );
  }
}
`;
}

function confirmDialogTemplate() {
  return `import 'package:flutter/material.dart';

Future<bool> confirmDialog(BuildContext context, {String title = 'Confirm', String message = 'Are you sure?'}) async {
  final res = await showDialog<bool>(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('OK')),
      ],
    ),
  );
  return res ?? false;
}
`;
}

main();
