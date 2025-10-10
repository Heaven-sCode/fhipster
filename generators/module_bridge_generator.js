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
  final ApiClient _api = Get.find<ApiClient>();

  String? _accessToken;
  String? _refreshToken;
  DateTime? _accessTokenExpiry;
  DateTime? _refreshTokenExpiry;

  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  DateTime? get accessTokenExpiry => _accessTokenExpiry;
  DateTime? get refreshTokenExpiry => _refreshTokenExpiry;

  /// Set auth tokens provided by parent app
  void setAuthTokens({
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiry,
    DateTime? refreshTokenExpiry,
  }) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    _accessTokenExpiry = accessTokenExpiry;
    _refreshTokenExpiry = refreshTokenExpiry;

    // Update API client with new tokens
    _api.setAuthTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      accessTokenExpiry: accessTokenExpiry,
      refreshTokenExpiry: refreshTokenExpiry,
    );
  }

  /// Clear auth tokens (logout)
  void clearAuthTokens() {
    _accessToken = null;
    _refreshToken = null;
    _accessTokenExpiry = null;
    _refreshTokenExpiry = null;

    _api.clearAuthTokens();
  }

  /// Check if tokens are available and valid
  bool get hasValidTokens {
    if (_accessToken == null || _accessToken!.isEmpty) return false;
    if (_accessTokenExpiry == null) return true;
    return DateTime.now().isBefore(_accessTokenExpiry!.subtract(const Duration(seconds: 30)));
  }
}
`;
}

module.exports = { generateModuleBridgeTemplate };