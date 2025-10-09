// generators/routes_generator.js
// Emits lib/core/routes.dart
// - Centralizes GetX routes and bindings
// - Registers ApiClient + AuthService once per page via _ensureCore()
// - Attaches AuthMiddleware (and RoleMiddleware when roles provided)
// - Wires splash/login/home + entity table views
//
// Usage in bin/index.js:
//   writeFile(path.join(coreDir, 'routes.dart'), generateRoutesTemplate({
//     entityRoutes,                   // [{ path, controllerFile, viewFile, controllerClass, viewClass, roles: [] }]
//     includeAuthGuards: true,
//   }), force, 'core/routes.dart');

function generateRoutesTemplate({ entityRoutes = [], includeAuthGuards = true, includeColumnSettings = false } = {}) {
  // Dynamic imports for entities
  const entityViewImports = entityRoutes
    .map(r => `import '../views/${r.viewFile}';`)
    .join('\n');
  const entityControllerImports = entityRoutes
    .map(r => `import '../controllers/${r.controllerFile}';`)
    .join('\n');
  const columnSettingsImports = includeColumnSettings
    ? "import '../views/settings/column_settings_view.dart';\nimport 'preferences/column_preferences.dart';\n"
    : '';

  // Build GetPages for entities
  const entityPages = entityRoutes.map(r => {
    const middlewares = [];
    if (includeAuthGuards) {
      middlewares.push('AuthMiddleware(requireAuth: true)');
      if (Array.isArray(r.roles) && r.roles.length > 0) {
        const roleList = r.roles.map(x => `'${x}'`).join(', ');
        middlewares.push(`RoleMiddleware(requiredAuthorities: const [${roleList}])`);
      }
    }
    const mw = middlewares.length ? `middlewares: [${middlewares.join(', ')}],` : '';

    return `    GetPage(
      name: '${r.path}',
      page: () => ${r.viewClass}(),
      binding: BindingsBuilder(() {
        _ensureCore();
        if (!Get.isRegistered<${r.controllerClass}>()) Get.put(${r.controllerClass}());
      }),
      ${mw}
    ),\n    GetPage(
      name: '${r.path}/:id',
      page: () => ${r.viewClass}(),
      binding: BindingsBuilder(() {
        _ensureCore();
        if (!Get.isRegistered<${r.controllerClass}>()) Get.put(${r.controllerClass}());
      }),
      ${mw}
    ),`;
  }).join('\n');

  const columnSettingsRoute = includeColumnSettings
    ? `    GetPage(
      name: columnSettings,
      page: () => const ColumnSettingsView(),
      binding: BindingsBuilder(() {
        _ensureCore();
        if (!Get.isRegistered<ColumnPreferencesService>()) Get.put(ColumnPreferencesService(), permanent: true);
      }),
      ${includeAuthGuards ? 'middlewares: [AuthMiddleware(requireAuth: true)],' : ''}
    ),\n`
    : '';

  return `import 'package:get/get.dart';

import 'api_client.dart';
import 'auth/auth_service.dart';
import 'auth/auth_middleware.dart';
import 'auth/role_middleware.dart';

import '../views/splash_view.dart';
import '../views/login_view.dart';
import '../views/home_view.dart';
import '../views/unauthorized_view.dart';
import '../views/forbidden_view.dart';

import '../controllers/splash_controller.dart';
import '../controllers/login_controller.dart';

${entityViewImports}
${entityControllerImports}
${columnSettingsImports}

class AppRoutes {
  static const splash = '/';
  static const login = '/login';
  static const home = '/home';
  static const unauthorized = '/unauthorized';
  static const forbidden = '/forbidden';
${includeColumnSettings ? "  static const columnSettings = '/settings/columns';\n" : ''}

  static final pages = <GetPage>[
    // Splash (bootstraps auth & decides where to go)
    GetPage(
      name: splash,
      page: () => const SplashView(),
      binding: BindingsBuilder(() {
        _ensureCore();
        if (!Get.isRegistered<SplashController>()) Get.put(SplashController());
      }),
    ),

    // Login (no guards)
    GetPage(
      name: login,
      page: () => const LoginView(),
      binding: BindingsBuilder(() {
        _ensureCore();
        if (!Get.isRegistered<LoginController>()) Get.put(LoginController());
      }),
    ),

    // Home (guarded if enabled)
    GetPage(
      name: home,
      page: () => const HomeView(),
      binding: BindingsBuilder(() {
        _ensureCore();
      }),
      ${includeAuthGuards ? 'middlewares: [AuthMiddleware(requireAuth: true)],' : ''}
    ),

    // Auth helper routes
    GetPage(
      name: unauthorized,
      page: () => const UnauthorizedView(),
    ),
    GetPage(
      name: forbidden,
      page: () => const ForbiddenView(),
    ),

${columnSettingsRoute}
${entityPages}
  ];
}

/// Ensure core singletons are registered once.
/// Works for both Keycloak and JHipster JWT since they plug through AuthService/ApiClient.
void _ensureCore() {
  if (!Get.isRegistered<ApiClient>()) Get.put(ApiClient(), permanent: true);
  if (!Get.isRegistered<AuthService>()) Get.put(AuthService(), permanent: true);
}
`;
}

module.exports = { generateRoutesTemplate };
