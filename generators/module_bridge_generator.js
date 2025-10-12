// generators/module_bridge_generator.js
// Emits lib/core/module_bridge.dart
// - Service for receiving auth tokens from parent app
// - Allows module to work independently once tokens are provided
//
// Usage in parent app:
//   final bridge = Get.find<ModuleBridge>();
//   bridge.setAuthTokens(accessToken: 'token', refreshToken: 'refresh');
//
// The module's ApiClient will use these tokens automatically.

function generateModuleBridgeTemplate() {
  return `import 'package:get/get.dart';
import 'api_client.dart';

/// Bridge service for module integration with parent app.
/// Allows parent app to provide auth tokens that the module will use.
class ModuleBridge extends GetxService {
  final Rx<String?> _accessToken = Rx<String?>(null);
  final Rx<String?> _refreshToken = Rx<String?>(null);
  final Rx<DateTime?> _accessTokenExpiry = Rx<DateTime?>(null);
  final Rx<DateTime?> _refreshTokenExpiry = Rx<DateTime?>(null);

  String? get accessToken => _accessToken.value;
  String? get refreshToken => _refreshToken.value;
  DateTime? get accessTokenExpiry => _accessTokenExpiry.value;
  DateTime? get refreshTokenExpiry => _refreshTokenExpiry.value;

  Rx<String?> get accessTokenRx => _accessToken;
  Rx<String?> get refreshTokenRx => _refreshToken;

  /// Set auth tokens provided by parent app
  void setAuthTokens({
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiry,
    DateTime? refreshTokenExpiry,
  }) {
    _accessToken.value = accessToken;
    _refreshToken.value = refreshToken;
    _accessTokenExpiry.value = accessTokenExpiry;
    _refreshTokenExpiry.value = refreshTokenExpiry;

    // ApiClient will get tokens from this ModuleBridge automatically
  }

  /// Clear auth tokens (logout)
  void clearAuthTokens() {
    _accessToken.value = null;
    _refreshToken.value = null;
    _accessTokenExpiry.value = null;
    _refreshTokenExpiry.value = null;

    // ApiClient will detect cleared tokens automatically
  }

  /// Check if tokens are available and valid
  bool get hasValidTokens {
    final token = _accessToken.value;
    if (token == null || token.isEmpty) return false;
    final expiry = _accessTokenExpiry.value;
    if (expiry == null) return true;
    return DateTime.now().isBefore(expiry.subtract(const Duration(seconds: 30)));
  }
}

/// Public API for parent apps to inject auth tokens into the module.
/// This allows parent apps to provide authentication without knowing internal module details.
class ModuleAuthInjector {
  static void setAuthTokens({
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiry,
    DateTime? refreshTokenExpiry,
  }) {
    if (Get.isRegistered<ModuleApiClient>()) {
      Get.find<ModuleApiClient>().setAuthTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
        accessTokenExpiry: accessTokenExpiry,
        refreshTokenExpiry: refreshTokenExpiry,
      );
    }
  }

  static void clearAuthTokens() {
    if (Get.isRegistered<ModuleApiClient>()) {
      Get.find<ModuleApiClient>().clearAuthTokens();
    }
  }

  static bool get hasValidTokens {
    if (Get.isRegistered<ModuleBridge>()) {
      return Get.find<ModuleBridge>().hasValidTokens;
    }
    return false;
  }
}
`;
}

module.exports = { generateModuleBridgeTemplate };