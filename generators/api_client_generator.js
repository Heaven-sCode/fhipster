// generators/api_client_generator.js
// Emits lib/core/api_client.dart
// - Central GetConnect client
// - Keycloak token + refresh (password grant) using Env.get() settings
// - Auto attaches Authorization header
// - Single-flight refresh; retries once on 401
// - Stores tokens/expiries in GetStorage using keys from Env

function generateApiClientTemplate() {
  return `import 'dart:async';
import 'dart:convert';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'core/env/env.dart';

class ApiClient extends GetConnect {
  final _box = GetStorage();

  ApiClient() {
    final env = Env.get();
    httpClient.baseUrl = env.apiHost;
    httpClient.timeout = Duration(seconds: env.requestTimeoutSeconds);
    httpClient.maxAuthRetries = env.maxAuthRetries;

    // Attach Authorization and common headers
    httpClient.addRequestModifier<dynamic>((request) async {
      if (_isAuthUrl(request.url.toString())) return request;

      if (env.enableAutoRefresh) {
        await ensureFreshToken();
      }
      final token = accessToken;
      if (token != null && token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer ' + token;
      }
      request.headers['Accept'] = 'application/json';
      // Let services override Content-Type (e.g., merge-patch); otherwise default for bodies
      if ((request.method == 'POST' || request.method == 'PUT' || request.method == 'PATCH') &&
          !request.headers.containsKey('Content-Type')) {
        request.headers['Content-Type'] = 'application/json';
      }

      if (env.enableApiLogging) {
        // minimal request log
        // ignore logging credentials (auth endpoints handled separately)
        print('[ApiClient] -> ' + request.method + ' ' + request.url.toString());
      }
      return request;
    });

    // On 401, try refresh once and retry
    httpClient.addAuthenticator<dynamic>((request) async {
      if (_isAuthUrl(request.url.toString())) return request;
      final ok = await _refreshAccessToken();
      if (ok) {
        final t = accessToken;
        if (t != null && t.isNotEmpty) {
          request.headers['Authorization'] = 'Bearer ' + t;
        }
      }
      return request;
    });

    httpClient.addResponseModifier((request, response) {
      if (Env.get().enableApiLogging) {
        print('[ApiClient] <- ' + response.statusCode.toString() + ' ' + request.url.toString());
      }
      return response;
    });
  }

  // ====== Storage keys from Env ======
  String get _kAT => Env.get().storageKeyAccessToken;
  String get _kRT => Env.get().storageKeyRefreshToken;
  String get _kATExp => Env.get().storageKeyAccessExpiry;
  String get _kRTExp => Env.get().storageKeyRefreshExpiry;

  // ====== Token getters/setters ======
  String? get accessToken => _box.read<String>(_kAT);
  String? get refreshToken => _box.read<String>(_kRT);

  DateTime? get _accessExp => _readDT(_kATExp);
  DateTime? get _refreshExp => _readDT(_kRTExp);

  bool get _isAccessExpired => _isExpired(_accessExp);
  bool get _isRefreshExpired => _isExpired(_refreshExp);

  // ====== Public auth APIs ======

  /// Resource Owner Password flow against Keycloak.
  /// Make sure your client allows Direct Access Grants and scopes include offline_access.
  Future<bool> loginWithPassword(String username, String password) async {
    final env = Env.get();
    final url = env.tokenEndpoint;

    final body = {
      'grant_type': 'password',
      'client_id': env.keycloakClientId,
      if (env.keycloakClientSecret.isNotEmpty) 'client_secret': env.keycloakClientSecret,
      'username': username,
      'password': password,
      'scope': env.keycloakScopes.join(' ')
    };

    final res = await post(
      url,
      _encodeForm(body),
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    );

    if (res.isOk && res.body is Map) {
      _persistTokens(Map<String, dynamic>.from(res.body));
      return true;
    }
    return false;
  }

  /// Try to get into a valid authenticated state at app start.
  Future<bool> bootstrap() async {
    if (accessToken == null) return false;
    if (_isAccessExpired) {
      return await _refreshAccessToken();
    }
    return true;
  }

  /// Ensure an access token is valid before an API call.
  Future<void> ensureFreshToken() async {
    if (accessToken == null) return;
    if (_isAccessExpired) {
      await _refreshAccessToken();
    }
  }

  /// Logout from Keycloak (optional remote call) and clear local tokens.
  Future<void> logout() async {
    try {
      final env = Env.get();
      final rt = refreshToken;
      if (rt != null && rt.isNotEmpty) {
        final body = {
          'client_id': env.keycloakClientId,
          if (env.keycloakClientSecret.isNotEmpty)
            'client_secret': env.keycloakClientSecret,
          'refresh_token': rt,
        };
        await post(env.logoutEndpoint, _encodeForm(body),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'});
      }
    } finally {
      clearTokens();
    }
  }

  void clearTokens() {
    _box.remove(_kAT);
    _box.remove(_kRT);
    _box.remove(_kATExp);
    _box.remove(_kRTExp);
  }

  // ====== Refresh (single-flight) ======
  Future<void>? _refreshing;

  Future<bool> _refreshAccessToken() async {
    if (accessToken == null) return false;
    if (_isRefreshExpired) {
      clearTokens();
      return false;
    }

    // Coalesce concurrent refreshes
    if (_refreshing != null) {
      try {
        await _refreshing;
        return !_isAccessExpired;
      } catch (_) {
        return false;
      }
    }

    final c = Completer<void>();
    _refreshing = c.future;

    try {
      final env = Env.get();
      final rt = refreshToken;
      if (rt == null || rt.isEmpty) {
        clearTokens();
        c.complete();
        _refreshing = null;
        return false;
      }

      final body = {
        'grant_type': 'refresh_token',
        'client_id': env.keycloakClientId,
        if (env.keycloakClientSecret.isNotEmpty) 'client_secret': env.keycloakClientSecret,
        'refresh_token': rt,
      };

      final res = await post(
        env.tokenEndpoint,
        _encodeForm(body),
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      );

      if (res.isOk && res.body is Map) {
        _persistTokens(Map<String, dynamic>.from(res.body));
        c.complete();
        _refreshing = null;
        return true;
      } else {
        clearTokens();
        c.complete();
        _refreshing = null;
        return false;
      }
    } catch (_) {
      clearTokens();
      if (!c.isCompleted) c.complete();
      _refreshing = null;
      return false;
    }
  }

  // ====== Internals ======

  bool _isAuthUrl(String url) {
    final env = Env.get();
    return url.startsWith(env.tokenEndpoint) || url.startsWith(env.logoutEndpoint) ||
           url.startsWith(env.authorizeEndpoint) || url.startsWith(env.userinfoEndpoint);
  }

  DateTime? _readDT(String key) {
    final v = _box.read<String>(key);
    if (v == null || v.isEmpty) return null;
    return DateTime.tryParse(v);
  }

  bool _isExpired(DateTime? exp) => exp == null || DateTime.now().isAfter(exp);

  void _persistTokens(Map body) {
    final env = Env.get();
    final at = body['access_token']?.toString();
    final rt = body['refresh_token']?.toString();

    // Keycloak: expires_in & refresh_expires_in are seconds from now
    final ei = int.tryParse(body['expires_in']?.toString() ?? '') ?? 300;
    final rei = int.tryParse(body['refresh_expires_in']?.toString() ?? '') ?? 1800;

    final skewA = env.accessTokenSkewSeconds;
    final skewR = env.refreshTokenSkewSeconds;

    final now = DateTime.now();
    final atExp = now.add(Duration(seconds: (ei - skewA).clamp(5, ei)));
    final rtExp = now.add(Duration(seconds: (rei - skewR).clamp(5, rei)));

    if (at != null) _box.write(_kAT, at);
    if (rt != null) _box.write(_kRT, rt);
    _box.write(_kATExp, atExp.toIso8601String());
    _box.write(_kRTExp, rtExp.toIso8601String());
  }

  String _encodeForm(Map<String, String> map) =>
      map.entries
          .map((e) => '\${Uri.encodeQueryComponent(e.key)}=\${Uri.encodeQueryComponent(e.value)}')
          .join('&');
}
`;
}

module.exports = { generateApiClientTemplate };
