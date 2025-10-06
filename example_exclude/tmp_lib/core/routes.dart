import 'package:get/get.dart';

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

import '../views/properties_table_view.dart';
import '../views/media_assets_table_view.dart';
import '../controllers/properties_controller.dart';
import '../controllers/media_assets_controller.dart';
import '../views/settings/column_settings_view.dart';
import 'preferences/column_preferences.dart';


class AppRoutes {
  static const splash = '/';
  static const login = '/login';
  static const home = '/home';
  static const unauthorized = '/unauthorized';
  static const forbidden = '/forbidden';
  static const columnSettings = '/settings/columns';


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
      middlewares: [AuthMiddleware(requireAuth: true)],
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

    GetPage(
      name: columnSettings,
      page: () => const ColumnSettingsView(),
      binding: BindingsBuilder(() {
        _ensureCore();
        if (!Get.isRegistered<ColumnPreferencesService>()) Get.put(ColumnPreferencesService(), permanent: true);
      }),
      middlewares: [AuthMiddleware(requireAuth: true)],
    ),

    GetPage(
      name: '/properties',
      page: () => const PropertiesTableView(),
      binding: BindingsBuilder(() {
        _ensureCore();
        if (!Get.isRegistered<PropertiesController>()) Get.put(PropertiesController());
      }),
      middlewares: [AuthMiddleware(requireAuth: true)],
    ),
    GetPage(
      name: '/media-assets',
      page: () => const MediaAssetsTableView(),
      binding: BindingsBuilder(() {
        _ensureCore();
        if (!Get.isRegistered<MediaAssetsController>()) Get.put(MediaAssetsController());
      }),
      middlewares: [AuthMiddleware(requireAuth: true)],
    ),
  ];
}

/// Ensure core singletons are registered once.
/// Works for both Keycloak and JHipster JWT since they plug through AuthService/ApiClient.
void _ensureCore() {
  if (!Get.isRegistered<ApiClient>()) Get.put(ApiClient(), permanent: true);
  if (!Get.isRegistered<AuthService>()) Get.put(AuthService(), permanent: true);
}
