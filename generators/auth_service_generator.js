// generators/auth_service_generator.js
// Emits lib/core/auth/auth_service.dart
// - Central auth state as a GetxService
// - Wraps ApiClient for Keycloak password grant + refresh + logout
// - Parses JWT (via token_decoder.dart) to expose username, displayName, authorities, expiries
// - Reacts to token changes in GetStorage and updates observables
// - Helpers: bootstrap(), loginWithPassword(), logout(), refreshNow(),
//            rememberUsername()/forgetRememberedUsername(), hasAny/AllAuthority

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

  // Public getters (reactive via Obx)
  bool get isAuthenticated => _authenticated.value;
  String? get username => _username.value;
  String? get displayName => _displayName.value;
  List<String> get authorities => _authorities;

  DateTime? get accessTokenExpiry => _accessExp.value;
  DateTime? get refreshTokenExpiry => _refreshExp.value;

  String? get rememberedUsername => _box.read<String>(Env.get().storageKeyRememberedUsername);

  ApiClient get _api {
    if (!Get.isRegistered<ApiClient>()) Get.put(ApiClient(), permanent: true);
    return Get.find<ApiClient>();
  }

  @override
  void onInit() {
    super.onInit();
    _loadFromStorage(); // initial snapshot
    _watchStorageKeys(); // react to future changes
    _startTicker();      // keep expiries current
  }

  @override
  void onClose() {
    _ticker?.cancel();
    super.onClose();
  }

  // ===== Public API =====

  /// Attempt to restore session and refresh tokens if needed.
  Future<bool> bootstrap() async {
    final ok = await _api.bootstrap();
    _loadFromStorage();
    return ok;
  }

  /// Login with Keycloak password grant (Direct Access Grants must be enabled).
  Future<bool> loginWithPassword(String username, String password) async {
    final ok = await _api.loginWithPassword(username, password);
    _loadFromStorage();
    return ok;
  }

  /// Explicitly try to refresh access token if expired (no-op if still valid).
  Future<void> refreshNow() async {
    await _api.ensureFreshToken();
    _loadFromStorage();
  }

  /// Logout from Keycloak (if refresh token present) and clear local tokens.
  Future<void> logout() async {
    await _api.logout();
    _loadFromStorage();
  }

  /// Remember/forget username locally for convenience on the login form.
  void rememberUsername(String username) {
    _box.write(Env.get().storageKeyRememberedUsername, username);
  }

  void forgetRememberedUsername() {
    _box.remove(Env.get().storageKeyRememberedUsername);
  }

  /// Role/authority helpers
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
    // GetStorage exposes listenKey; update if tokens change externally (e.g., ApiClient refresh).
    final kAT = Env.get().storageKeyAccessToken;
    final kATExp = Env.get().storageKeyAccessExpiry;
    final kRT = Env.get().storageKeyRefreshToken;
    final kRTExp = Env.get().storageKeyRefreshExpiry;

    try {
      _box.listenKey(kAT, (value) => _loadFromStorage());
      _box.listenKey(kATExp, (value) => _loadFromStorage());
      _box.listenKey(kRT, (value) => _loadFromStorage());
      _box.listenKey(kRTExp, (value) => _loadFromStorage());
    } catch (_) {
      // Some environments may not support listenKey; that's okay—ticker keeps state fresh.
    }
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 15), (_) {
      // Periodically re-evaluate auth/expiries.
      _loadFromStorage();
    });
  }

  void _loadFromStorage() {
    final env = Env.get();
    final at = _box.read<String>(env.storageKeyAccessToken);
    final rt = _box.read<String>(env.storageKeyRefreshToken);

    // Expiries (ISO strings written by ApiClient)
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

    // Consider authenticated if we have an access token that isn't already expired.
    _authenticated.value = !_isExpired(atExp);
  }

  String? _extractUsername(Map<String, dynamic> claims) {
    // Keycloak commonly uses 'preferred_username'. Fallbacks: 'sub', 'email', 'upn'
    return (claims['preferred_username'] ??
            claims['upn'] ??
            claims['email'] ??
            claims['sub'])
        ?.toString();
  }

  String? _extractDisplayName(Map<String, dynamic> claims, String? fallback) {
    final name = claims['name']?.toString();
    if (name != null && name.trim().isNotEmpty) return name.trim();

    final given = claims['given_name']?.toString();
    final family = claims['family_name']?.toString();
    final combined = [given, family].where((e) => e != null && e.toString().isNotEmpty).join(' ').trim();
    if (combined.isNotEmpty) return combined;

    return fallback;
  }

  List<String> _extractAuthorities(Map<String, dynamic> claims) {
    final out = <String>{};

    // Spring Security / JHipster often mints "authorities": ["ROLE_USER", ...]
    final authorities = claims['authorities'];
    if (authorities is List) {
      for (final a in authorities) {
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
      // If a specific clientId is configured, prefer that; otherwise add all client roles.
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

    // Normalize to upper-case unique list
    return out.map((e) => e.toUpperCase()).toList()..sort();
  }

  String _prefixRole(String r) {
    final up = r.toUpperCase();
    return up.startsWith('ROLE_') ? up : 'ROLE_' + up;
  }

  bool _isExpired(DateTime? exp) => exp == null || DateTime.now().isAfter(exp);
}
`;
}

module.exports = { generateAuthServiceTemplate };
