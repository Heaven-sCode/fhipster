// lib/core/env/env.dart
// -----------------------------------------------------------------------------
// FHipster Environment (self-contained) - GENERATED
// -----------------------------------------------------------------------------
// - Supports two auth providers: Keycloak OIDC or JHipster JWT
// - Initialize with:
//     Env.initGenerated();   // use baked defaults (below)
//   or
//     Env.init(EnvConfig(...)); // override programmatically
// -----------------------------------------------------------------------------

enum AuthProvider { keycloak, jhipsterJwt }
enum RelationshipPayloadMode { idOnly, fullObject }

class EnvConfig {
  // App
  final String appName;
  final String envName;

  // API host & gateway
  final String apiHost;
  final bool useGateway;
  final String? gatewayServiceName;

  // Auth mode
  final AuthProvider authProvider;

  // Keycloak / OIDC endpoints
  final String tokenEndpoint;
  final String logoutEndpoint;
  final String authorizeEndpoint;
  final String userinfoEndpoint;

  // Keycloak client info
  final String keycloakClientId;
  final String? keycloakClientSecret;
  final List<String> keycloakScopes;

  // JHipster JWT endpoints
  final String jwtAuthEndpoint; // /api/authenticate
  final String accountEndpoint; // /api/account
  final bool allowCredentialCacheForJwt;

  // Paging & sorting defaults
  final int defaultPageSize;
  final List<int> pageSizeOptions;
  final List<String> defaultSort;
  final List<String> defaultSearchSort;
  final bool distinctByDefault;

  // Headers
  final String totalCountHeaderName;

  // Storage keys
  final String storageKeyAccessToken;
  final String storageKeyAccessExpiry;
  final String storageKeyRefreshToken;
  final String storageKeyRefreshExpiry;
  final String storageKeyRememberedUsername;

  // Relationships
  final RelationshipPayloadMode relationshipPayloadMode;

  // Plural overrides
  final Map<String, String> pluralOverrides;

  const EnvConfig({
    // App
    this.appName = 'FHipster',
    this.envName = 'dev',

    // API
    this.apiHost = 'http://localhost:8080',
    this.useGateway = false,
    this.gatewayServiceName,

    // Auth
    this.authProvider = AuthProvider.keycloak,

    // Keycloak defaults (placeholders)
    this.tokenEndpoint = 'CHANGE_ME_TOKEN_ENDPOINT',
    this.logoutEndpoint = 'CHANGE_ME_LOGOUT_ENDPOINT',
    this.authorizeEndpoint = 'CHANGE_ME_AUTHORIZE_ENDPOINT',
    this.userinfoEndpoint = 'CHANGE_ME_USERINFO_ENDPOINT',
    this.keycloakClientId = 'CHANGE_ME_CLIENT_ID',
    this.keycloakClientSecret,
    this.keycloakScopes = const ['openid', 'profile', 'email', 'offline_access'],

    // JWT defaults
    this.jwtAuthEndpoint = '/api/authenticate',
    this.accountEndpoint = '/api/account',
    this.allowCredentialCacheForJwt = false,

    // Paging / sorting
    this.defaultPageSize = 20,
    this.pageSizeOptions = const [10, 20, 50, 100],
    this.defaultSort = const ['id,desc'],
    this.defaultSearchSort = const ['_score,desc'],
    this.distinctByDefault = false,

    // Headers
    this.totalCountHeaderName = 'X-Total-Count',

    // Storage keys
    this.storageKeyAccessToken = 'fh_access_token',
    this.storageKeyAccessExpiry = 'fh_access_expiry',
    this.storageKeyRefreshToken = 'fh_refresh_token',
    this.storageKeyRefreshExpiry = 'fh_refresh_expiry',
    this.storageKeyRememberedUsername = 'fh_remembered_username',

    // Relationships
    this.relationshipPayloadMode = RelationshipPayloadMode.idOnly,

    // Plural overrides
    this.pluralOverrides = const {},
  });
}

class Env {
  final EnvConfig _c;
  Env._(this._c);

  static Env? _i;

  static void init(EnvConfig config) {
    _i = Env._(config);
  }

  /// Initialize with the baked defaults from the generator.
  static void initGenerated() {
    if (_i != null) return;
    _i = Env._(EnvConfig(
      // App
      appName: 'FHipster',
      envName: 'dev',

      // API
      apiHost: 'http://34.50.81.155:8080',
      useGateway: true,
      gatewayServiceName: 'operationsModule',

      // Auth
      authProvider: AuthProvider.keycloak,

      // Keycloak baked values (still present even if you use JWT)
      tokenEndpoint: 'http://34.50.81.155:8080/realms/myrealm/protocol/openid-connect/token',
      logoutEndpoint: 'http://34.50.81.155:8080/realms/myrealm/protocol/openid-connect/logout',
      authorizeEndpoint: 'http://34.50.81.155:8080/realms/myrealm/protocol/openid-connect/auth',
      userinfoEndpoint: 'http://34.50.81.155:8080/realms/myrealm/protocol/openid-connect/userinfo',
      keycloakClientId: 'my-client',
      keycloakClientSecret: '',
      keycloakScopes: const ['openid', 'profile', 'email', 'offline_access'],

      // JWT baked values
      jwtAuthEndpoint: '/api/authenticate',
      accountEndpoint: '/api/account',
      allowCredentialCacheForJwt: false,

      // Paging / sorting
      defaultPageSize: 20,
      pageSizeOptions: const [10, 20, 50, 100],
      defaultSort: const ['id,desc'],
      defaultSearchSort: const ['_score,desc'],
      distinctByDefault: false,

      // Headers
      totalCountHeaderName: 'X-Total-Count',

      // Storage keys
      storageKeyAccessToken: 'fh_access_token',
      storageKeyAccessExpiry: 'fh_access_expiry',
      storageKeyRefreshToken: 'fh_refresh_token',
      storageKeyRefreshExpiry: 'fh_refresh_expiry',
      storageKeyRememberedUsername: 'fh_remembered_username',

      // Relationships
      relationshipPayloadMode: RelationshipPayloadMode.idOnly,

      // Plural overrides
      pluralOverrides: {
      'person': 'people',
      'address': 'addresses',
    },
    ));
  }

  static Env get() {
    final i = _i;
    if (i == null) {
      throw StateError('Env.init(...) or Env.initGenerated() must be called before use.');
    }
    return i;
  }

  // Shorthands
  bool get isKeycloak => authProvider == AuthProvider.keycloak;
  bool get isJwt => authProvider == AuthProvider.jhipsterJwt;

  // Getters
  String get appName => _c.appName;
  String get envName => _c.envName;

  String get apiHost => _c.apiHost;
  bool get useGateway => _c.useGateway;
  String? get gatewayServiceName => _c.gatewayServiceName;

  AuthProvider get authProvider => _c.authProvider;

  String get tokenEndpoint => _c.tokenEndpoint;
  String get logoutEndpoint => _c.logoutEndpoint;
  String get authorizeEndpoint => _c.authorizeEndpoint;
  String get userinfoEndpoint => _c.userinfoEndpoint;

  String get keycloakClientId => _c.keycloakClientId;
  String? get keycloakClientSecret => _c.keycloakClientSecret;
  List<String> get keycloakScopes => _c.keycloakScopes;

  String get jwtAuthEndpoint => _c.jwtAuthEndpoint;
  String get accountEndpoint => _c.accountEndpoint;
  bool get allowCredentialCacheForJwt => _c.allowCredentialCacheForJwt;

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

  Map<String, String> get pluralOverrides =>
      Map<String, String>.unmodifiable(_c.pluralOverrides);

  // ==== Helpers ====

  /// Pluralize an entity name to a collection path-friendly token.
  String pluralFor(String singular) {
    final s = singular.trim();
    if (s.isEmpty) return s;

    final ov = pluralOverrides[s] ??
        (s.isNotEmpty ? pluralOverrides[s[0].toUpperCase() + s.substring(1)] : null);
    if (ov != null && ov.isNotEmpty) return ov;

    final lower = s.toLowerCase();
    if (lower.endsWith('y') && s.length >= 2 && !_isVowel(lower[lower.length - 2])) {
      return s.substring(0, s.length - 1) + 'ies';
    }
    if (lower.endsWith('s') ||
        lower.endsWith('x') ||
        lower.endsWith('z') ||
        lower.endsWith('ch') ||
        lower.endsWith('sh')) {
      return s + 'es';
    }
    return s + 's';
  }

  /// Builds a fully-qualified entity collection URL.
  String entityBasePath(
    String plural, {
    String? microserviceOverride,
  }) {
    final p = _slug(plural);
    final path = useGateway
        ? '/services/\${microserviceOverride ?? (gatewayServiceName ?? '')}/api/\$p'
        : '/api/\$p';
    return _url(path);
  }

  /// Builds a fully-qualified Elasticsearch search URL for an entity.
  String searchBasePath(
    String plural, {
    String? microserviceOverride,
  }) {
    final p = _slug(plural);
    final path = useGateway
        ? '/services/\${microserviceOverride ?? (gatewayServiceName ?? '')}/api/_search/\$p'
        : '/api/_search/\$p';
    return _url(path);
  }

  /// Join [apiHost] with a path (handles slashes).
  String _url(String path) {
    final host = apiHost.endsWith('/') ? apiHost.substring(0, apiHost.length - 1) : apiHost;
    final p = path.startsWith('/') ? path : '/$path';
    return host + p;
  }

  /// Minimal slugifier for paths (lowercase, strip disallowed chars).
  String _slug(String s) {
    final trimmed = s.trim();
    final hyphened = trimmed.replaceAll(RegExp(r'\s+'), '-');
    return hyphened.replaceAll(RegExp(r'[^A-Za-z0-9_\-]'), '').toLowerCase();
  }

  bool _isVowel(String ch) => 'aeiou'.contains(ch.toLowerCase());
}

