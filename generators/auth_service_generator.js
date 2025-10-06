// generators/auth_service_generator.js

function generateAuthServiceTemplate() {
  return `import 'dart:convert';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get/get_connect/http/src/response/response.dart';

import '../env/env.dart';
import 'token_decoder.dart';

class AuthService extends GetxService {
  late final EnvConfig _cfg;
  GetStorage? _box;
  FlutterSecureStorage? _secure;
  final GetConnect _rest = GetConnect();

  final username = RxnString();
  final authorities = <String>[].obs;

  final RxnString _accessToken = RxnString();
  final Rxn<DateTime> _accessExpiry = Rxn<DateTime>();
  final RxnString _refreshToken = RxnString();
  final Rxn<DateTime> _refreshExpiry = Rxn<DateTime>();
  String? _rememberedUsername;
  String? _pendingRoute;
  bool _loaded = false;

  bool get isAuthenticated {
    final token = _accessToken.value;
    if (token == null || token.isEmpty) return false;
    final expiry = _accessExpiry.value;
    if (expiry == null) return true;
    // Allow a small leeway window so we don't thrash logins when the token is about to expire
    return DateTime.now().isBefore(expiry.subtract(const Duration(seconds: 5)));
  }

  String? get displayName => username.value;
  DateTime? get accessTokenExpiry => _accessExpiry.value;
  DateTime? get refreshTokenExpiry => _refreshExpiry.value;

  String? get rememberedUsername => _rememberedUsername;

  @override
  void onInit() {
    super.onInit();
    _cfg = Env.get();
    _rest.httpClient.baseUrl = _cfg.apiHost;
    _rest.httpClient.timeout = const Duration(seconds: 25);

    if (_cfg.storageMode == 'secure_storage') {
      _secure = const FlutterSecureStorage();
    } else {
      _box = GetStorage();
    }
  }

  Future<bool> bootstrap() async {
    await _ensureLoaded();
    if (isAuthenticated) return true;
    return await tryRefreshToken();
  }

  Future<bool> loginWithPassword(String username, String password) async {
    await _ensureLoaded();
    switch (_cfg.authProvider) {
      case AuthProvider.keycloak:
        return await _loginKeycloak(username, password);
      case AuthProvider.jhipsterJwt:
        return await _loginJwt(username, password);
    }
  }

  Future<bool> tryRefreshToken() async {
    await _ensureLoaded();
    if (_cfg.authProvider == AuthProvider.keycloak) {
      return await _refreshKeycloak();
    }
    return false;
  }

  Future<bool> refreshNow() async => await tryRefreshToken();

  Future<String?> getAccessToken({bool forceFresh = false}) async {
    await _ensureLoaded();
    if (forceFresh && !await tryRefreshToken()) {
      // fall through with current token
    }
    if (!isAuthenticated) {
      await tryRefreshToken();
    }
    return _accessToken.value;
  }

  Future<void> rememberUsername(String value) async {
    _rememberedUsername = value;
    await _write(_cfg.storageKeyRememberedUsername, value);
  }

  Future<void> forgetRememberedUsername() async {
    _rememberedUsername = null;
    await _delete(_cfg.storageKeyRememberedUsername);
  }

  Future<void> logout() async {
    await _delete(_cfg.storageKeyAccessToken);
    await _delete(_cfg.storageKeyAccessExpiry);
    await _delete(_cfg.storageKeyRefreshToken);
    await _delete(_cfg.storageKeyRefreshExpiry);
    _accessToken.value = null;
    _accessExpiry.value = null;
    _refreshToken.value = null;
    _refreshExpiry.value = null;
    username.value = null;
    authorities.clear();
    _pendingRoute = null;
  }

  Future<void> saveTokens({
    required String accessToken,
    required DateTime? accessExpiry,
    String? refreshToken,
    DateTime? refreshExpiry,
  }) async {
    await _persistSession(
      accessToken: accessToken,
      accessExpiry: accessExpiry,
      refreshToken: refreshToken,
      refreshExpiry: refreshExpiry,
    );
  }

  Future<void> _ensureLoaded() async {
    if (_loaded) return;
    String? remembered;
    String? access;
    String? accessExp;
    String? refresh;
    String? refreshExp;
    try {
      remembered = await _read(_cfg.storageKeyRememberedUsername);
      access = await _read(_cfg.storageKeyAccessToken);
      accessExp = await _read(_cfg.storageKeyAccessExpiry);
      refresh = await _read(_cfg.storageKeyRefreshToken);
      refreshExp = await _read(_cfg.storageKeyRefreshExpiry);
    } finally {
      _loaded = true;
    }

    _rememberedUsername = remembered;

    if (access != null && access.isNotEmpty) {
      final accessExpiry = _parseMillis(accessExp) ?? jwtExpiry(access);
      final refreshExpiry = _parseMillis(refreshExp);
      await _persistSession(
        accessToken: access,
        accessExpiry: accessExpiry,
        refreshToken: refresh,
        refreshExpiry: refreshExpiry,
        persist: false,
      );
    }
  }

  Future<bool> _loginKeycloak(String username, String password) async {
    final endpoint = _cfg.tokenEndpoint;
    if (endpoint == null || endpoint.isEmpty) {
      throw Exception('Keycloak tokenEndpoint not configured');
    }

    final scope = (_cfg.keycloakScopes).where((e) => e.trim().isNotEmpty).join(' ');
    final body = <String, String>{
      'grant_type': 'password',
      'username': username,
      'password': password,
      'client_id': _cfg.keycloakClientId ?? '',
    };
    if ((_cfg.keycloakClientSecret ?? '').isNotEmpty) {
      body['client_secret'] = _cfg.keycloakClientSecret!;
    }
    if (scope.isNotEmpty) {
      body['scope'] = scope;
    }

    final payload = _encodeForm(body);
    final res = await _rest.post(
      endpoint,
      payload,
      headers: const {'Content-Type': 'application/x-www-form-urlencoded'},
    );

    if (!res.isOk) {
      throw Exception('Keycloak authentication failed (\${res.statusCode})');
    }

    final data = _asJsonMap(res.body);
    final accessToken = data['access_token']?.toString();
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Keycloak response missing access_token');
    }
    final refreshToken = data['refresh_token']?.toString();
    final expiresIn = _asInt(data['expires_in']);
    final refreshIn = _asInt(data['refresh_expires_in']);
    final now = DateTime.now();
    final accessExpiry = expiresIn != null ? now.add(Duration(seconds: expiresIn)) : jwtExpiry(accessToken);
    final refreshExpiry = refreshIn != null ? now.add(Duration(seconds: refreshIn)) : null;

    await _persistSession(
      accessToken: accessToken,
      accessExpiry: accessExpiry,
      refreshToken: refreshToken,
      refreshExpiry: refreshExpiry,
    );
    _rememberedUsername = username;
    return true;
  }

  Future<bool> _refreshKeycloak() async {
    final endpoint = _cfg.tokenEndpoint;
    final refresh = _refreshToken.value;
    if (endpoint == null || endpoint.isEmpty || refresh == null || refresh.isEmpty) {
      return false;
    }

    final currentRefreshExpiry = _refreshExpiry.value;
    if (currentRefreshExpiry != null && DateTime.now().isAfter(currentRefreshExpiry)) {
      return false;
    }

    final body = <String, String>{
      'grant_type': 'refresh_token',
      'refresh_token': refresh,
      'client_id': _cfg.keycloakClientId ?? '',
    };
    if ((_cfg.keycloakClientSecret ?? '').isNotEmpty) {
      body['client_secret'] = _cfg.keycloakClientSecret!;
    }

    final payload = _encodeForm(body);
    final res = await _rest.post(
      endpoint,
      payload,
      headers: const {'Content-Type': 'application/x-www-form-urlencoded'},
    );

    if (!res.isOk) {
      if (_isNetworkFailure(res) && isAuthenticated) {
        return true;
      }
      return false;
    }

    final data = _asJsonMap(res.body);
    final accessToken = data['access_token']?.toString();
    if (accessToken == null || accessToken.isEmpty) {
      return false;
    }
    final newRefresh = data['refresh_token']?.toString() ?? refresh;
    final expiresIn = _asInt(data['expires_in']);
    final refreshIn = _asInt(data['refresh_expires_in']);
    final now = DateTime.now();
    final accessExpiry = expiresIn != null ? now.add(Duration(seconds: expiresIn)) : jwtExpiry(accessToken);
    final nextRefreshExpiry = refreshIn != null ? now.add(Duration(seconds: refreshIn)) : _refreshExpiry.value;

    await _persistSession(
      accessToken: accessToken,
      accessExpiry: accessExpiry,
      refreshToken: newRefresh,
      refreshExpiry: nextRefreshExpiry,
    );
    return true;
  }

  Future<bool> _loginJwt(String username, String password) async {
    final endpoint = _cfg.jwtAuthEndpoint;
    final res = await _rest.post(endpoint, {
      'username': username,
      'password': password,
      'rememberMe': _cfg.allowCredentialCacheForJwt,
    });

    if (!res.isOk) {
      throw Exception('Login failed (\${res.statusCode})');
    }

    final data = _asJsonMap(res.body);
    final token = data['id_token']?.toString() ?? data['access_token']?.toString();
    if (token == null || token.isEmpty) {
      throw Exception('JWT response missing token');
    }

    final expiry = jwtExpiry(token);
    await _persistSession(accessToken: token, accessExpiry: expiry);
    await _loadJwtAccount();
    return true;
  }

  Future<void> _loadJwtAccount() async {
    final endpoint = _cfg.accountEndpoint;
    if (endpoint.isEmpty) return;
    final res = await _rest.get(endpoint, headers: await _authHeaders());
    if (!res.isOk) return;
    final data = _asJsonMap(res.body);
    final roles = <String>[];
    final raw = data['authorities'];
    if (raw is List) {
      for (final value in raw) {
        final v = value?.toString();
        if (v != null && v.isNotEmpty) roles.add(v);
      }
    }
    if (roles.isNotEmpty) {
      authorities.assignAll(roles);
    }
    final uname = data['login']?.toString() ?? data['email']?.toString();
    if (uname != null && uname.isNotEmpty) {
      username.value = uname;
    }
  }

  Future<Map<String, String>> _authHeaders() async {
    final token = await getAccessToken();
    if (token == null || token.isEmpty) return const {};
    return {'Authorization': 'Bearer $token'};
  }

  Future<void> _persistSession({
    required String accessToken,
    DateTime? accessExpiry,
    String? refreshToken,
    DateTime? refreshExpiry,
    bool persist = true,
  }) async {
    _accessToken.value = accessToken;
    _accessExpiry.value = accessExpiry;
    _refreshToken.value = refreshToken;
    _refreshExpiry.value = refreshExpiry;

    if (persist) {
      await _write(_cfg.storageKeyAccessToken, accessToken);
      await _write(_cfg.storageKeyAccessExpiry, accessExpiry?.millisecondsSinceEpoch.toString());
      if (refreshToken != null) {
        await _write(_cfg.storageKeyRefreshToken, refreshToken);
      } else {
        await _delete(_cfg.storageKeyRefreshToken);
      }
      if (refreshExpiry != null) {
        await _write(_cfg.storageKeyRefreshExpiry, refreshExpiry.millisecondsSinceEpoch.toString());
      } else {
        await _delete(_cfg.storageKeyRefreshExpiry);
      }
    }

    final claims = decodeJwtClaims(accessToken);
    if (claims != null) {
      final roles = _claimsAuthorities(claims);
      if (roles.isNotEmpty) {
        authorities.assignAll(roles);
      }
      final preferred = claims['preferred_username']?.toString();
      final sub = claims['sub']?.toString();
      if (preferred != null && preferred.isNotEmpty) {
        username.value = preferred;
      } else if (sub != null && sub.isNotEmpty) {
        username.value = sub;
      }
    }
  }

  List<String> _claimsAuthorities(Map<String, dynamic> claims) {
    final roles = <String>[];
    for (final key in ['roles', 'authorities', 'realm_access', 'resource_access']) {
      if (!claims.containsKey(key)) continue;
      final value = claims[key];
      if (value is List) {
        for (final e in value) {
          final v = e?.toString();
          if (v != null && v.isNotEmpty) roles.add(v);
        }
      } else if (value is Map && key == 'realm_access') {
        final rolesList = value['roles'];
        if (rolesList is List) {
          for (final e in rolesList) {
            final v = e?.toString();
            if (v != null && v.isNotEmpty) roles.add(v);
          }
        }
      } else if (value is Map && key == 'resource_access') {
        for (final entry in value.values) {
          if (entry is Map && entry['roles'] is List) {
            for (final e in (entry['roles'] as List)) {
              final v = e?.toString();
              if (v != null && v.isNotEmpty) roles.add(v);
            }
          }
        }
      }
    }
    return roles.toSet().toList();
  }

  Map<String, dynamic> _asJsonMap(dynamic input) {
    if (input is Map<String, dynamic>) return input;
    if (input is Map) return Map<String, dynamic>.from(input);
    if (input is String && input.isNotEmpty) {
      final decoded = jsonDecode(input);
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded as Map);
      }
    }
    throw Exception('Unexpected response payload');
  }

  int? _asInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }

  DateTime? _parseMillis(String? value) {
    if (value == null || value.isEmpty) return null;
    final millis = int.tryParse(value);
    if (millis == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(millis, isUtc: true).toLocal();
  }

  String _encodeForm(Map<String, String> data) {
    return data.entries
        .map((e) => '\${Uri.encodeQueryComponent(e.key)}=\${Uri.encodeQueryComponent(e.value)}')
        .join('&');
  }

  Future<void> _write(String key, String? value) async {
    if (value == null) return;
    if (_secure != null) {
      await _secure!.write(key: key, value: value);
    } else {
      await _box!.write(key, value);
    }
  }

  Future<String?> _read(String key) async {
    String? value;
    if (_secure != null) {
      value = await _secure!.read(key: key);
    } else {
      final raw = _box!.read(key);
      if (raw is String?) {
        value = raw;
      } else if (raw != null) {
        value = raw.toString();
      }
    }
    if (value == null) return null;
    final trimmed = value.trim();
    if (trimmed.isEmpty || trimmed.toLowerCase() == 'null') return null;
    return trimmed;
  }

  Future<void> _delete(String key) async {
    if (_secure != null) {
      await _secure!.delete(key: key);
    } else {
      await _box!.remove(key);
    }
  }

  void setPendingRoute(String? route) {
    final normalized = (route == null || route.isEmpty) ? null : route;
    _pendingRoute = normalized;
  }

  String? consumePendingRoute() {
    final route = _pendingRoute;
    _pendingRoute = null;
    return route;
  }

  bool _isNetworkFailure(Response res) {
    final code = res.statusCode ?? 0;
    if (code == 0) return true;
    final status = res.statusText?.toLowerCase() ?? '';
    return code < 0 || status.contains('socket') || status.contains('network');
  }
}
`;
}

module.exports = { generateAuthServiceTemplate };
