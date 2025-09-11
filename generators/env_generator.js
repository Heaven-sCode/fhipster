// generators/env_generator.js
// Emits lib/core/env/env.dart
// - Self-contained environment with runtime initialization
// - Keycloak endpoints & client info
// - Paging/sorting defaults, storage keys, header names
// - URL helpers for entity & search paths (gateway/direct aware)
// - RelationshipPayloadMode used by models/services

function generateEnvTemplate() {
  return `// GENERATED: core/env/env.dart

enum RelationshipPayloadMode { idOnly, fullObject }

class EnvConfig {
  // App metadata
  final String appName;
  final String envName;

  // API host & gateway
  final String apiHost; // e.g., https://api.example.com
  final bool useGateway; // true if routing through /services/<name>/api
  final String? gatewayServiceName; // required if useGateway = true (unless provided per-service)

  // Keycloak / OIDC endpoints
  final String tokenEndpoint;
  final String logoutEndpoint;
  final String authorizeEndpoint;
  final String userinfoEndpoint;

  // Keycloak client info
  final String keycloakClientId;
  final String? keycloakClientSecret;
  final List<String> keycloakScopes;

  // Paging & sorting defaults
  final int defaultPageSize;
  final List<int> pageSizeOptions;
  final List<String> defaultSort;        // e.g., ['id,desc']
  final List<String> defaultSearchSort;  // e.g., ['_score,desc']
  final bool distinctByDefault;

  // HTTP header for total count (JHipster uses X-Total-Count)
  final String totalCountHeaderName;

  // Storage keys (GetStorage)
  final String storageKeyAccessToken;
  final String storageKeyAccessExpiry;
  final String storageKeyRefreshToken;
  final String storageKeyRefreshExpiry;
  final String storageKeyRememberedUsername;

  // Relationship serialization preference
  final RelationshipPayloadMode relationshipPayloadMode;

  const EnvConfig({
    this.appName = 'FHipster',
    this.envName = 'dev',
    this.apiHost = 'http://localhost:8080',
    this.useGateway = false,
    this.gatewayServiceName,

    // OIDC endpoints (required)
    required this.tokenEndpoint,
    required this.logoutEndpoint,
    required this.authorizeEndpoint,
    required this.userinfoEndpoint,

    // Keycloak client
    required this.keycloakClientId,
    this.keycloakClientSecret,
    this.keycloakScopes = const ['openid', 'profile', 'email', 'offline_access'],

    // Defaults
    this.defaultPageSize = 20,
    this.pageSizeOptions = const [10, 20, 50, 100],
    this.defaultSort = const ['id,desc'],
    this.defaultSearchSort = const ['_score,desc'],
    this.distinctByDefault = false,
    this.totalCountHeaderName = 'X-Total-Count',

    // Storage keys
    this.storageKeyAccessToken = 'fh_access_token',
    this.storageKeyAccessExpiry = 'fh_access_expiry',
    this.storageKeyRefreshToken = 'fh_refresh_token',
    this.storageKeyRefreshExpiry = 'fh_refresh_expiry',
    this.storageKeyRememberedUsername = 'fh_remembered_username',

    this.relationshipPayloadMode = RelationshipPayloadMode.idOnly,
  });
}

class Env {
  final EnvConfig _c;
  Env._(this._c);

  static Env? _i;

  /// Initialize once at app startup
  static void init(EnvConfig config) {
    _i = Env._(config);
  }

  /// Access current environment (throws if not initialized)
  static Env get() {
    final i = _i;
    if (i == null) {
      throw StateError('Env.init(...) must be called before use.');
    }
    return i;
  }

  // ====== Expose config fields as getters ======
  String get appName => _c.appName;
  String get envName => _c.envName;

  String get apiHost => _c.apiHost;
  bool get useGateway => _c.useGateway;
  String? get gatewayServiceName => _c.gatewayServiceName;

  String get tokenEndpoint => _c.tokenEndpoint;
  String get logoutEndpoint => _c.logoutEndpoint;
  String get authorizeEndpoint => _c.authorizeEndpoint;
  String get userinfoEndpoint => _c.userinfoEndpoint;

  String get keycloakClientId => _c.keycloakClientId;
  String? get keycloakClientSecret => _c.keycloakClientSecret;
  List<String> get keycloakScopes => _c.keycloakScopes;

  int get defaultPageSize => _c.defaultPageSize;
  List<int> get pageSizeOptions => _c.pageSizeOptions;
  List<String> get defaultSort => _c.defaultSort;
  List<String> get defaultSearchSort => _c.defaultSearchSort;
  bool get distinctByDefault => _c.distinctByDefault;

  String get totalCountHeaderName => _c.totalCountHeaderName;

  String get storageKeyAccessToken => _c.storageKeyAccessToken;
  String get storageKeyAccessExpiry => _c.storageKeyAccessExpiry;
  String get storageKeyRefreshToken => _c.storageKeyRefreshToken;
  String get storageKeyRefreshExpiry => _c.storageKeyRefreshExpiry;
  String get storageKeyRememberedUsername => _c.storageKeyRememberedUsername;

  RelationshipPayloadMode get relationshipPayloadMode => _c.relationshipPayloadMode;

  // ====== Helpers ======

  /// Very small pluralization helper; adjust if your API uses different plural forms.
  String pluralFor(String singular) {
    final s = singular.trim();
    if (s.isEmpty) return s;
    final lower = s.toLowerCase();
    if (lower.endsWith('y') && !_isVowel(lower[lower.length - 2])) {
      return s.substring(0, s.length - 1) + 'ies';
    }
    if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z') || lower.endsWith('ch') || lower.endsWith('sh')) {
      return s + 'es';
    }
    return s + 's';
  }

  /// Base path for an entity collection, including host.
  /// When using a gateway: /services/<svc>/api/<plural>
  /// Otherwise: /api/<plural>
  String entityBasePath(String plural, {String? microserviceOverride}) {
    final base = useGateway
        ? '/services/' + (microserviceOverride ?? (gatewayServiceName ?? '')) + '/api/' + _slug(plural)
        : '/api/' + _slug(plural);
    return _url(base);
  }

  /// Base path for Elasticsearch search endpoint.
  /// When using a gateway: /services/<svc>/api/_search/<plural>
  /// Otherwise: /api/_search/<plural>
  String searchBasePath(String plural, {String? microserviceOverride}) {
    final base = useGateway
        ? '/services/' + (microserviceOverride ?? (gatewayServiceName ?? '')) + '/api/_search/' + _slug(plural)
        : '/api/_search/' + _slug(plural);
    return _url(base);
  }

  // ====== Internals ======

  String _url(String path) {
    final host = apiHost.endsWith('/') ? apiHost.substring(0, apiHost.length - 1) : apiHost;
    final p = path.startsWith('/') ? path : '/$path';
    return host + p;
  }

  bool _isVowel(String ch) => 'aeiou'.contains(ch);

  String _slug(String s) {
    // Keep it simple: lower-case + strip spaces/specials (typical JHipster endpoints are already plural tokens)
    return s
        .trim()
        .replaceAll(RegExp(r'\\s+'), '-')
        .replaceAll(RegExp(r'[^A-Za-z0-9_\\-]'), '')
        .toLowerCase();
  }
}
`;
}

module.exports = { generateEnvTemplate };
