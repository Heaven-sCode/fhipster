// generators/auth_middleware_generator.js
// Emits lib/core/auth/auth_middleware.dart
// - GetX middleware that enforces authentication
// - If `requireAuth` is true and the user is not authenticated, redirects to /login
// - Safe to use even if core singletons (ApiClient/AuthService) aren't registered yet

function generateAuthMiddlewareTemplate() {
  return `import 'package:flutter/widgets.dart';
import 'package:get/get.dart';
import '../api_client.dart';
import 'auth_service.dart';

/// Route guard to ensure the user is authenticated before accessing a page.
///
/// Usage in routes:
///   GetPage(
///     name: '/orders',
///     page: () => const OrdersTableView(),
///     binding: ...,
///     middlewares: [AuthMiddleware(requireAuth: true)],
///   )
class AuthMiddleware extends GetMiddleware {
  final bool requireAuth;
  final String loginRoute;

  AuthMiddleware({
    this.requireAuth = true,
    this.loginRoute = '/login',
    int? priority,
  }) : super(priority: priority ?? 1);

  @override
  RouteSettings? redirect(String? route) {
    _ensureCore();

    if (!requireAuth) return null;

    final auth = Get.find<AuthService>();
    if (auth.isAuthenticated) {
      return null;
    }

    if (route != null && route.isNotEmpty && route != loginRoute) {
      auth.setPendingRoute(route);
    }

    return RouteSettings(name: loginRoute);
  }

  void _ensureCore() {
    if (!Get.isRegistered<ApiClient>()) {
      Get.put(ApiClient(), permanent: true);
    }
    if (!Get.isRegistered<AuthService>()) {
      Get.put(AuthService(), permanent: true);
    }
  }
}
`;
}

module.exports = { generateAuthMiddlewareTemplate };
