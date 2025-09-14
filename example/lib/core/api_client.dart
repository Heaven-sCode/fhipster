import 'dart:async';
import 'dart:convert';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

import 'env/env.dart';
import 'auth/token_decoder.dart';

class ApiClient extends GetConnect {
  final GetStorage _box = GetStorage();

  ApiClient() {
    final env = Env.get();
    httpClient.baseUrl = env.apiHost; // we still pass absolute URLs when needed
    httpClient.timeout = const Duration(seconds: 30);

    // Attach auth header automatically
    httpClient.addRequestModifier<dynamic>((request) async {
      await ensureFreshToken(); // refresh if needed (Keycloak)
      final at = _accessToken;
      if (at != null && at.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer ' + at;
      }
      // Default JSON
      request.headers.putIfAbsent('Content-Type', () => 'application/json');
      return request;
    });

    // Common response handling: bubble 401s for caller to redirect
    httpClient.addResponseModifier((request, response) {
      return response;
    });
  }

  // ===== Public API used by AuthService =====

  /// Try to restore a session and refresh tokens if needed.
  Future<bool> bootstrap() async {
    final env = Env.get();
    final at = _accessToken;

    if (env.isKeycloak) {
      // If we have a refresh token, try refresh when access missing/expired.
      if (at == null || _isAccessExpired) {
        final ok = await _refreshKeycloak();
        return ok;
      }
      return true;
    } else {
      // JWT: consider valid if token exists and not expired.
      if (at == null || _isAccessExpired) return false;
      // Optional validation call (commented to avoid extra RTT):
      // final r = await get(_resolve(env.accountEndpoint));
      // return r.isOk;
      return true;
    }
  }

  /// Username/password login.
  /// Keycloak: password grant
  /// JWT: POST /api/authenticate -> { id_token }
  Future<bool> loginWithPassword(String username, String password) async {
    final env = Env.get();
    if (env.isKeycloak) {
      final body = {
        'grant_type': 'password',
        'client_id': env.keycloakClientId,
        'username': username,
        'password': password,
      };
      if ((env.keycloakClientSecret ?? '').isNotEmpty) {
        body['client_secret'] = env.keycloakClientSecret!;
      }
      if (env.keycloakScopes.isNotEmpty) {
        body['scope'] = env.keycloakScopes.join(' ');
      }

      final res = await post(
        env.tokenEndpoint,
        FormData(body),
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      );

      if (!res.isOk) {
        throw Exception('Keycloak login failed: ' + (res.statusText ?? res.statusCode.toString()));
      }

      final data = _safeBodyMap(res.body);
      final access = (data['access_token'] ?? '') as String;
      final refresh = (data['refresh_token'] ?? '') as String?;
      final expSec = _asInt(data['expires_in']) ?? 0;
      final refreshExpSec = _asInt(data['refresh_expires_in']) ?? 0;
      final now = DateTime.now();

      final atExp = now.add(Duration(seconds: expSec > 5 ? expSec - 5 : expSec));
      final rtExp = refresh != null && refreshExpSec > 0
          ? now.add(Duration(seconds: refreshExpSec > 5 ? refreshExpSec - 5 : refreshExpSec))
          : null;

      _writeTokens(accessToken: access, accessExpiry: atExp, refreshToken: refresh, refreshExpiry: rtExp);
      return true;
    } else {
      // JHipster JWT
      final endpoint = _resolve(env.jwtAuthEndpoint);
      final res = await post(
        endpoint,
        jsonEncode({'username': username, 'password': password, 'rememberMe': true}),
        headers: {'Content-Type': 'application/json'},
      );

      if (!res.isOk) {
        throw Exception('JWT login failed: ' + (res.statusText ?? res.statusCode.toString()));
      }

      final data = _safeBodyMap(res.body);
      final token = (data['id_token'] ?? data['token'] ?? '') as String;
      if (token.isEmpty) throw Exception('JWT login: no token returned');

      // Derive expiry from token 'exp' if present.
      final claims = decodeJwtClaims(token);
      final atExp = claimsExpiry(claims) ?? DateTime.now().add(const Duration(hours: 2)); // fallback

      _writeTokens(accessToken: token, accessExpiry: atExp, refreshToken: null, refreshExpiry: null);
      return true;
    }
  }

  /// Ensure we have a non-expired access token.
  /// Returns true if usable, false if not.
  Future<bool> ensureFreshToken() async {
    final env = Env.get();

    // If no token at all, nothing to do.
    if (_accessToken == null) return false;

    // Still valid?
    if (!_isAccessExpired) return true;

    if (env.isKeycloak) {
      return await _refreshKeycloak();
    } else {
      // JWT: no refresh; consider invalid and let caller redirect to login.
      return false;
    }
  }

  /// Logout and clear local tokens.
  Future<void> logout() async {
    final env = Env.get();
    if (env.isKeycloak) {
      final rt = _refreshToken;
      if (rt != null && rt.isNotEmpty) {
        final body = {
          'client_id': env.keycloakClientId,
          'refresh_token': rt,
        };
        if ((env.keycloakClientSecret ?? '').isNotEmpty) {
          body['client_secret'] = env.keycloakClientSecret!;
        }
        // Ignore failures; we clear storage anyway
        await post(
          env.logoutEndpoint,
          FormData(body),
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        );
      }
    }
    _clearTokens();
  }

  // ===== Authenticated HTTP helpers for services =====

  Future<Response<dynamic>> getJson(String url, {Map<String, dynamic>? query, bool absolute = false}) async {
    await ensureFreshToken();
    final target = absolute ? url : _resolve(url);
    return get(target, query: query);
  }

  Future<Response<dynamic>> postJson(String url, dynamic body, {bool absolute = false, Map<String, String>? headers}) async {
    await ensureFreshToken();
    final target = absolute ? url : _resolve(url);
    return post(target, jsonEncode(body), headers: {
      'Content-Type': 'application/json',
      if (headers != null) ...headers,
    });
  }

  Future<Response<dynamic>> putJson(String url, dynamic body, {bool absolute = false}) async {
    await ensureFreshToken();
    final target = absolute ? url : _resolve(url);
    return put(target, jsonEncode(body), headers: {'Content-Type': 'application/json'});
  }

  Future<Response<dynamic>> patchJson(String url, dynamic body, {bool absolute = false, bool mergePatch = true}) async {
    await ensureFreshToken();
    final target = absolute ? url : _resolve(url);
    final contentType = mergePatch ? 'application/merge-patch+json' : 'application/json';
    return patch(target, jsonEncode(body), headers: {'Content-Type': contentType});
  }

  Future<Response<dynamic>> deleteJson(String url, {bool absolute = false}) async {
    await ensureFreshToken();
    final target = absolute ? url : _resolve(url);
    return delete(target);
  }

  // ===== Internals =====

  // Resolve relative path (e.g., '/api/users') against Env.apiHost; leave absolute URLs intact.
  String _resolve(String pathOrUrl) {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
    final env = Env.get();
    final host = env.apiHost.endsWith('/') ? env.apiHost.substring(0, env.apiHost.length - 1) : env.apiHost;
    final p = pathOrUrl.startsWith('/') ? pathOrUrl : '/$pathOrUrl';
    return host + p;
  }

  bool get _isAccessExpired {
    final expIso = _box.read<String>(Env.get().storageKeyAccessExpiry);
    if (expIso == null) {
      // Try decode from token as last resort
      final at = _accessToken;
      return isJwtExpired(at, leewaySeconds: 5);
    }
    final exp = DateTime.tryParse(expIso);
    if (exp == null) return true;
    return DateTime.now().isAfter(exp);
  }

  String? get _accessToken => _box.read<String>(Env.get().storageKeyAccessToken);
  String? get _refreshToken => _box.read<String>(Env.get().storageKeyRefreshToken);

  void _writeTokens({
    required String accessToken,
    required DateTime? accessExpiry,
    String? refreshToken,
    DateTime? refreshExpiry,
  }) {
    final env = Env.get();
    _box.write(env.storageKeyAccessToken, accessToken);
    if (accessExpiry != null) _box.write(env.storageKeyAccessExpiry, accessExpiry.toIso8601String());
    if (refreshToken != null && refreshToken.isNotEmpty) {
      _box.write(env.storageKeyRefreshToken, refreshToken);
      if (refreshExpiry != null) {
        _box.write(env.storageKeyRefreshExpiry, refreshExpiry.toIso8601String());
      }
    } else {
      _box.remove(env.storageKeyRefreshToken);
      _box.remove(env.storageKeyRefreshExpiry);
    }
  }

  void _clearTokens() {
    final env = Env.get();
    _box.remove(env.storageKeyAccessToken);
    _box.remove(env.storageKeyAccessExpiry);
    _box.remove(env.storageKeyRefreshToken);
    _box.remove(env.storageKeyRefreshExpiry);
  }

  Future<bool> _refreshKeycloak() async {
    final env = Env.get();
    final rt = _refreshToken;
    if (rt == null || rt.isEmpty) return false;

    final body = {
      'grant_type': 'refresh_token',
      'client_id': env.keycloakClientId,
      'refresh_token': rt,
    };
    if ((env.keycloakClientSecret ?? '').isNotEmpty) {
      body['client_secret'] = env.keycloakClientSecret!;
    }

    final res = await post(
      env.tokenEndpoint,
      FormData(body),
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    );

    if (!res.isOk) {
      // Refresh failed; clear and force re-login
      _clearTokens();
      return false;
    }

    final data = _safeBodyMap(res.body);
    final access = (data['access_token'] ?? '') as String;
    final refresh = (data['refresh_token'] ?? '') as String?;
    final expSec = _asInt(data['expires_in']) ?? 0;
    final refreshExpSec = _asInt(data['refresh_expires_in']) ?? 0;
    final now = DateTime.now();

    final atExp = now.add(Duration(seconds: expSec > 5 ? expSec - 5 : expSec));
    final rtExp = refresh != null && refreshExpSec > 0
        ? now.add(Duration(seconds: refreshExpSec > 5 ? refreshExpSec - 5 : refreshExpSec))
        : null;

    _writeTokens(accessToken: access, accessExpiry: atExp, refreshToken: refresh, refreshExpiry: rtExp);
    return true;
  }

  Map<String, dynamic> _safeBodyMap(dynamic body) {
    if (body is Map<String, dynamic>) return body;
    if (body is Map) return body.map((k, v) => MapEntry(k.toString(), v));
    if (body is String && body.isNotEmpty) {
      try {
        final m = jsonDecode(body);
        if (m is Map<String, dynamic>) return m;
      } catch (_) {}
    }
    return <String, dynamic>{};
  }

  int? _asInt(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }
}
