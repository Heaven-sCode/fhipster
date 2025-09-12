// generators/auth_service_generator.js
// Emits lib/core/auth/auth_service.dart
// - Dual auth aware (Keycloak OIDC or JHipster JWT via Env.authProvider)
// - Central auth state with GetX observables
// - Parses JWT claims for username/displayName/authorities
// - (JWT) Optionally enriches from /api/account if claims lack authorities
// - Exposes helpers: bootstrap, loginWithPassword, refreshNow, logout, hasAny/AllAuthority

function generateAuthServiceTemplate() {
  return `import 'dart:async';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

import '../env/env.dart';
import '../api_client.dart';
import 'token_decoder.dart';

class AuthService extends GetxService {
  final _box = GetStorage();

  // ===== Observables =====
  final RxBool _authenticated = false.obs;
  final RxnString _username = RxnString();
  final RxnString _displayName = RxnString();
  final RxList<String> _authorities = <String>[].obs;

  final Rxn<DateTime> _accessExp = Rxn<DateTime>();
  final Rxn<DateTime> _refreshExp = Rxn<DateTime>();

  Timer? _ticker;

  // Public getters
  bool get isAuthenticated => _authenticated.value;
  String? get username => _username.value;
  String? get displayName => _displayName.value;
  List<String> get authorities => _authorities;

  DateTime? get accessTokenExpiry => _accessExp.value;
  DateTime? get refreshTokenExpiry => _refreshExp.value;

  ApiClient get _api {
    if (!Get.isRegistered<ApiClient>()) Get.put(ApiClient(), permanent: true);
    return Get.find<ApiClient>();
  }

  @override
  void onInit() {
    super.onInit();
    _loadFromStorage();
    _watchStorageKeys();
    _startTicker();
  }

  @override
  void onClose() {
    _ticker?.cancel();
    super.onClose();
  }

  // ===== Public API =====

  /// Attempt to restore session and refresh tokens if needed.
  /// (Keycloak) refresh via RT; (JWT) validate token presence/expiry; optionally fetch /account.
  Future<bool> bootstrap() async {
    final ok = await _api.bootstrap();
    _loadFromStorage();

    final env = Env.get();
    if (ok && env.isJwt) {
      // If authorities missing, try to enrich from /account.
      if (_authorities.isEmpty) {
        await _enrichFromAccount();
      }
    }
    return ok;
  }

  /// Login with username/password via ApiClient (provider-aware).
  Future<bool> loginWithPassword(String username, String password) async {
    final ok = await _api.loginWithPassword(username, password);
    _loadFromStorage();

    final env = Env.get();
    if (ok && env.isJwt) {
      // In JWT mode, some backends omit authorities in token; enrich.
      await _enrichFromAccount();
    }
    return ok;
  }

  /// Try to refresh access token if provider supports it.
  Future<void> refreshNow() async {
    final env = Env.get();
    if (env.isKeycloak) {
      await _api.ensureFreshToken();
      _loadFromStorage();
    } else {
      // JWT: no refresh; caller should handle re-login when 401 happens.
      _loadFromStorage();
    }
  }

  /// Logout and clear local tokens.
  Future<void> logout() async {
    await _api.logout();
    _loadFromStorage();
  }

  /// Convenience role checks
  bool hasAnyAuthority(Iterable<String> req) {
    if (!isAuthenticated) return false;
    final have = authorities.map((e) => e.toUpperCase()).toSet();
    return req.any((r) => have.contains(r.toUpperCase()));
  }

  bool hasAllAuthorities(Iterable<String> req) {
    if (!isAuthenticated) return false;
    final have = authorities.map((e) => e.toUpperCase()).toSet();
    return req.every((r) => have.contains(r.toUpperCase()));
  }

  // ===== Internals =====

  void _watchStorageKeys() {
    final env = Env.get();
    try {
      _box.listenKey(env.storageKeyAccessToken, (_) => _loadFromStorage());
      _box.listenKey(env.storageKeyAccessExpiry, (_) => _loadFromStorage());
      _box.listenKey(env.storageKeyRefreshToken, (_) => _loadFromStorage());
      _box.listenKey(env.storageKeyRefreshExpiry, (_) => _loadFromStorage());
    } catch (_) {
      // Some runtimes may not support listenKey; ticker keeps us fresh.
    }
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 15), (_) {
      _loadFromStorage();
    });
  }

  void _loadFromStorage() {
    final env = Env.get();

    final at = _box.read<String>(env.storageKeyAccessToken);
    final rt = _box.read<String>(env.storageKeyRefreshToken);

    final atExpStr = _box.read<String>(env.storageKeyAccessExpiry);
    final rtExpStr = _box.read<String>(env.storageKeyRefreshExpiry);
    final atExp = atExpStr != null ? DateTime.tryParse(atExpStr) : null;
    final rtExp = rtExpStr != null ? DateTime.tryParse(rtExpStr) : null;

    _accessExp.value = atExp;
    _refreshExp.value = rtExp;

    if (at == null || at.isEmpty) {
      _authenticated.value = false;
      _username.value = null;
      _displayName.value = null;
      _authorities.assignAll(const []);
      return;
    }

    final claims = decodeJwtClaims(at) ?? const {};
    _username.value = _extractUsername(claims);
    _displayName.value = _extractDisplayName(claims, _username.value);
    _authorities.assignAll(_extractAuthorities(claims));

    // Authenticated if access token not expired (or expiry unknown but token present).
    _authenticated.value = !_isExpired(atExp) && at.isNotEmpty;
  }

  String? _extractUsername(Map<String, dynamic> claims) {
    // Keycloak prefers 'preferred_username'; JHipster often uses 'sub' or 'user_name' or 'login'
    return (claims['preferred_username'] ??
            claims['user_name'] ??
            claims['login'] ??
            claims['email'] ??
            claims['sub'])
        ?.toString();
  }

  String? _extractDisplayName(Map<String, dynamic> claims, String? fallback) {
    final name = claims['name']?.toString();
    if (name != null && name.trim().isNotEmpty) return name.trim();

    final given = claims['given_name']?.toString();
    final family = claims['family_name']?.toString();
    final combined = [given, family].whereType<String>().where((e) => e.isNotEmpty).join(' ').trim();
    if (combined.isNotEmpty) return combined;

    return fallback;
  }

  List<String> _extractAuthorities(Map<String, dynamic> claims) {
    final out = <String>{};

    // JHipster JWT: 'authorities' OR 'auth'
    final authorities = claims['authorities'];
    if (authorities is List) {
      for (final a in authorities) {
        if (a is String && a.isNotEmpty) out.add(a);
      }
    }
    final auth = claims['auth'];
    if (auth is List) {
      for (final a in auth) {
        if (a is String && a.isNotEmpty) out.add(a);
      }
    }

    // Keycloak realm roles
    final realm = claims['realm_access'];
    if (realm is Map && realm['roles'] is List) {
      for (final r in (realm['roles'] as List)) {
        if (r is String && r.isNotEmpty) out.add(_prefixRole(r));
      }
    }

    // Keycloak client roles
    final resource = claims['resource_access'];
    if (resource is Map) {
      final clientId = Env.get().keycloakClientId;
      if (resource[clientId] is Map && resource[clientId]['roles'] is List) {
        for (final r in (resource[clientId]['roles'] as List)) {
          if (r is String && r.isNotEmpty) out.add(_prefixRole(r));
        }
      } else {
        for (final entry in resource.entries) {
          final roles = entry.value is Map ? (entry.value['roles']) : null;
          if (roles is List) {
            for (final r in roles) {
              if (r is String && r.isNotEmpty) out.add(_prefixRole(r));
            }
          }
        }
      }
    }

    // Normalize
    return out.map((e) => e.toUpperCase()).toList()..sort();
  }

  String _prefixRole(String r) {
    final up = r.toUpperCase();
    return up.startsWith('ROLE_') ? up : 'ROLE_' + up;
  }

  bool _isExpired(DateTime? exp) => exp == null ? false : DateTime.now().isAfter(exp);

  /// For JWT apps, fetch /api/account to enrich authorities/name if not present in claims.
  Future<void> _enrichFromAccount() async {
    final env = Env.get();
    if (!env.isJwt) return;
    try {
      final res = await _api.getJson(env.accountEndpoint);
      if (!res.isOk) return;
      final body = res.body;
      if (body is Map) {
        // JHipster default payload keys:
        final login = body['login']?.toString();
        final first = body['firstName']?.toString();
        final last = body['lastName']?.toString();
        final auths = body['authorities'];

        if ((first ?? '').isNotEmpty || (last ?? '').isNotEmpty) {
          final name = [first, last].whereType<String>().where((e) => e.isNotEmpty).join(' ').trim();
          if (name.isNotEmpty) _displayName.value = name;
        }
        if ((login ?? '').isNotEmpty) {
          _username.value = login;
        }
        if (auths is List) {
          final set = <String>{};
          for (final a in auths) {
            if (a is String && a.isNotEmpty) set.add(a.toUpperCase());
          }
          if (set.isNotEmpty) _authorities.assignAll(set.toList()..sort());
        }
      }
    } catch (_) {
      // ignore enrichment errors
    }
  }
}
`;
}

module.exports = { generateAuthServiceTemplate };
