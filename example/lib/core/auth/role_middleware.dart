import 'package:flutter/widgets.dart';
import 'package:get/get.dart';
import '../api_client.dart';
import 'auth_service.dart';

/// Middleware that checks user authorities (roles/claims) before entering a route.
class RoleMiddleware extends GetMiddleware {
  /// Authorities required to access this route, e.g. ['ROLE_ADMIN'].
  final List<String> requiredAuthorities;

  /// If true, the user must have *all* authorities; otherwise any one is sufficient.
  final bool requireAll;

  /// Where to redirect when the user is authenticated but lacks authority.
  final String forbiddenRoute;

  /// Where to redirect when the user is not authenticated.
  final String unauthorizedRoute;

  RoleMiddleware({
    required this.requiredAuthorities,
    this.requireAll = false,
    this.forbiddenRoute = '/forbidden',
    this.unauthorizedRoute = '/unauthorized',
    int? priority,
  }) : super(priority: priority ?? 2);

  @override
  RouteSettings? redirect(String? route) {
    _ensureCore();

    if (!Get.isRegistered<AuthService>()) {
      return RouteSettings(name: unauthorizedRoute);
    }
    final auth = Get.find<AuthService>();

    if (!auth.isAuthenticated) {
      return RouteSettings(name: unauthorizedRoute);
    }

    if (requiredAuthorities.isEmpty) {
      // No specific roles required -> allow.
      return null;
    }

    final userAuths = (auth.authorities ?? const <String>[])
        .map((e) => e.toUpperCase())
        .toSet();
    final req = requiredAuthorities.map((e) => e.toUpperCase()).toSet();

    final ok = requireAll
        ? req.every(userAuths.contains)
        : req.any(userAuths.contains);

    if (!ok) {
      return RouteSettings(name: forbiddenRoute);
    }

    return null; // allow
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
