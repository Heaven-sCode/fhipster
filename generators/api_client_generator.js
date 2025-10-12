// generators/api_client_generator.js

function generateApiClientTemplate(isModule = false) {
  const authImport = isModule ? "import 'module_bridge.dart';" : "import 'auth/auth_service.dart';";

  return `import 'dart:async';
import 'dart:io';
import 'package:get/get.dart';
import 'package:get/get_connect/http/src/request/request.dart' as get_http;
import 'package:crypto/crypto.dart';

import 'env/env.dart';
${authImport}

${isModule ? '/// ModuleApiClient wraps GetConnect for module mode' : '/// ApiClient wraps GetConnect and:'}
/// - injects Authorization header
/// - enforces HTTPS when httpStrict=true
/// - optional certificate pinning (SHA256 fingerprints)
${isModule ? '/// - uses ModuleBridge for auth tokens from parent app' : '/// - supports both full app (AuthService) and module (ModuleBridge) modes'}
class ${isModule ? 'ModuleApiClient' : 'ApiClient'} extends GetConnect {
  late final EnvConfig _cfg;
  ${isModule ? 'ModuleBridge? _authService;' : 'late final dynamic _authService; // AuthService or ModuleBridge'}
  ${isModule ? '' : 'final bool _isModule;'}

  ${isModule ? 'ModuleApiClient()' : 'ApiClient({bool isModule = false}) : _isModule = isModule;'}

  @override
  void onInit() {
    super.onInit();
    _cfg = Env.get();
    ${isModule ? '' : `// Initialize auth service - prefer ModuleBridge if available (module mode), otherwise AuthService
    if (Get.isRegistered<ModuleBridge>()) {
      _authService = Get.find<ModuleBridge>();
      _isModule = true;
    } else {
      _authService = Get.find<AuthService>();
    }`}

    httpClient.baseUrl = _cfg.apiHost;

    // HTTPS-only enforcement
    if (_cfg.httpStrict && !(httpClient.baseUrl ?? '').toLowerCase().startsWith('https://')) {
      throw Exception('Env.httpStrict=true but apiHost is not HTTPS: \${httpClient.baseUrl}');
    }

    // Default headers (Authorization etc.)
    httpClient.addRequestModifier<void>((request) async {
      final headers = await _headers();
      request.headers.addAll(headers);
      return request;
    });

    ${isModule ? '' : `// Auto-refresh on 401 then retry once (only for full app mode)
    if (!_isModule) {
      httpClient.addResponseModifier((get_http.Request request, response) async {
        if (response.statusCode == 401) {
          final ok = await _authService.tryRefreshToken();
          if (ok) {
            final headers = await _headers(forceFresh: true);
            final mergedHeaders = Map<String, String>.from(request.headers)..addAll(headers);

            List<int>? body;
            final stream = request.bodyBytes;
            if (stream != null) {
              final buffer = <int>[];
              await for (final chunk in stream) {
                buffer.addAll(chunk);
              }
              if (buffer.isNotEmpty) {
                body = buffer;
              }
            }

            return httpClient.request(
              request.url.toString(),
              request.method,
              body: body,
              headers: mergedHeaders,
              query: request.url.queryParameters,
            );
          }
        }
        return response;
      });
    }`}

    // Optional: certificate pinning
    if (_cfg.pinnedSha256Certs.isNotEmpty) {
      HttpOverrides.global = _PinningHttpOverrides(_cfg.pinnedSha256Certs);
    }
  }

  ${isModule ? `/// Set auth tokens (used by ModuleBridge in module mode)
  void setAuthTokens({
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiry,
    DateTime? refreshTokenExpiry,
  }) {
    if (_authService == null) {
      _authService = Get.find<ModuleBridge>();
    }
    _authService!.setAuthTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      accessTokenExpiry: accessTokenExpiry,
      refreshTokenExpiry: refreshTokenExpiry,
    );
  }

  /// Clear auth tokens (used by ModuleBridge in module mode)
  void clearAuthTokens() {
    if (_authService == null) {
      _authService = Get.find<ModuleBridge>();
    }
    _authService!.clearAuthTokens();
  }` : `/// Set auth tokens (used by ModuleBridge in module mode)
  void setAuthTokens({
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiry,
    DateTime? refreshTokenExpiry,
  }) {
    if (!_isModule) return; // Only applicable in module mode

    _authService.setAuthTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      accessTokenExpiry: accessTokenExpiry,
      refreshTokenExpiry: refreshTokenExpiry,
    );
  }

  /// Clear auth tokens (used by ModuleBridge in module mode)
  void clearAuthTokens() {
    if (!_isModule) return; // Only applicable in module mode

    _authService.clearAuthTokens();
  }`}

  Future<Map<String, String>> _headers({bool forceFresh = false}) async {
    final h = <String, String>{
      'Accept': 'application/json',
    };

    String? token;
    ${isModule ? `if (_authService == null) {
      _authService = Get.find<ModuleBridge>();
    }
    token = _authService!.accessToken;` : `if (_isModule) {
      token = _authService.accessToken;
    } else {
      token = await _authService.getAccessToken(forceFresh: forceFresh);
    }`}

    if (token != null && token.isNotEmpty) {
      h['Authorization'] = 'Bearer \$token';
    }
    return h;
  }
}

class _PinningHttpOverrides extends HttpOverrides {
  final Set<String> _pins;
  _PinningHttpOverrides(List<String> pins)
      : _pins = pins.map((e) => e.toLowerCase()).toSet();

  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final client = super.createHttpClient(context);
    client.badCertificateCallback = (X509Certificate cert, String host, int port) {
      try {
        final bytes = cert.der;
        final digest = sha256.convert(bytes).bytes;
        final hex = _toHex(digest);
        return _pins.contains(hex);
      } catch (_) {
        return false;
      }
    };
    return client;
  }

  String _toHex(List<int> bytes) {
    final sb = StringBuffer();
    for (final b in bytes) {
      sb.write(b.toRadixString(16).padLeft(2, '0'));
    }
    return sb.toString();
  }
}

/// Exception thrown when an API request fails.
class ApiRequestException implements Exception {
  final int statusCode;
  final String message;
  final Response response;

  ApiRequestException(this.statusCode, this.message, this.response);

  bool get isNetworkError => statusCode == 0;

  @override
  String toString() => 'ApiRequestException(statusCode: ' + statusCode.toString() + ', message: ' + message + ')';
}
`;
}

module.exports = { generateApiClientTemplate };
