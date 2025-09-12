// generators/env_generator.js
// Emits lib/core/env/env.dart
// - Bakes CLI-provided defaults into Env.initGenerated()
// - Supports dual auth providers: Keycloak OIDC or JHipster JWT
// - Gateway-aware URL helpers
// - Plural overrides support

function esc(str = '') {
  // Escape for single-quoted Dart strings inside JS template literal
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function toDartBool(v) { return v ? 'true' : 'false'; }

function toDartEnum_AuthProvider(p) {
  const k = (p || 'keycloak').toLowerCase();
  return k === 'jhipsterjwt' || k === 'jhipster_jwt'
    ? 'AuthProvider.jhipsterJwt'
    : 'AuthProvider.keycloak';
}

function mapToDartLiteral(mapObj = {}) {
  const lines = Object.entries(mapObj).map(([k, v]) => `      '${esc(k)}': '${esc(v)}',`);
  return lines.length ? `{\n${lines.join('\n')}\n    }` : '{}';
}

/**
 * Generate env.dart with baked defaults.
 * @param {Object} opts
 * @param {string} opts.apiHost
 * @param {boolean} opts.useGateway
 * @param {string|null} opts.gatewayServiceName
 * @param {Object} opts.pluralOverrides
 * @param {('keycloak'|'jhipsterJwt')} opts.authProvider
 * @param {string} opts.jwtAuthEndpoint
 * @param {string} opts.accountEndpoint
 */
function generateEnvTemplate(opts = {}) {
  const {
    apiHost = 'http://localhost:8080',
    useGateway = false,
    gatewayServiceName = null,
    pluralOverrides = {},
    authProvider = 'keycloak',
    jwtAuthEndpoint = '/api/authenticate',
    accountEndpoint = '/api/account',
  } = opts;

  const gw = gatewayServiceName ? `'${esc(gatewayServiceName)}'` : 'null';
  const pluralOverridesLiteral = mapToDartLiteral(pluralOverrides);

  return `// lib/core/env/env.dart
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
  final String appName;
  final String envName;

  final String apiHost;
  final bool useGateway;
  final String? gatewayServiceName;

  final AuthProvider authProvider;

  // Keycloak / OIDC
  final String tokenEndpoint;
  final String logoutEndpoint;
  final String authorizeEndpoint;
  final String userinfoEndpoint;

  final String keycloakClientId;
  final String? keycloakClientSecret;
  final List<String> keycloakScopes;

  // JHipster JWT
  final String jwtAuthEndpoint; // /api/authenticate
  final String accountEndpoint; // /api/account
  final bool allowCredentialCacheForJwt;

  // Paging / sorting
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
    this.appName = 'FHipster',
    this.envName = 'dev',

    this.apiHost = 'http://localhost:8080',
    this.useGateway = false,
    this.gatewayServiceName,

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

  static void initGenerated() {
    if (_i != null) return;
    _i = Env._(EnvConfig(
      appName: 'FHipster',
      envName: 'dev',

      apiHost: '${esc(apiHost)}',
      useGateway: ${toDartBool(useGateway)},
      gatewayServiceName: ${gw},

      authProvider: ${toDartEnum_AuthProvider(authProvider)},

      // Keycloak placeholders — override via Env.init at runtime if you use Keycloak
      tokenEndpoint: 'CHANGE_ME_TOKEN_ENDPOINT',
      logoutEndpoint: 'CHANGE_ME_LOGOUT_ENDPOINT',
      authorizeEndpoint: 'CHANGE_ME_AUTHORIZE_ENDPOINT',
      userinfoEndpoint: 'CHANGE_ME_USERINFO_ENDPOINT',
      keycloakClientId: 'CHANGE_ME_CLIENT_ID',
      keycloakClientSecret: null,
      keycloakScopes: const ['openid', 'profile', 'email', 'offline_access'],

      // JWT baked defaults (used if authProvider == jhipsterJwt)
      jwtAuthEndpoint: '${esc(jwtAuthEndpoint)}',
      accountEndpoint: '${esc(accountEndpoint)}',
      allowCredentialCacheForJwt: false,

      defaultPageSize: 20,
      pageSizeOptions: const [10, 20, 50, 100],
      defaultSort: const ['id,desc'],
      defaultSearchSort: const ['_score,desc'],
      distinctByDefault: false,

      totalCountHeaderName: 'X-Total-Count',

      storageKeyAccessToken: 'fh_access_token',
      storageKeyAccessExpiry: 'fh_access_expiry',
      storageKeyRefreshToken: 'fh_refresh_token',
      storageKeyRefreshExpiry: 'fh_refresh_expiry',
      storageKeyRememberedUsername: 'fh_remembered_username',

      relationshipPayloadMode: RelationshipPayloadMode.idOnly,

      pluralOverrides: ${pluralOverridesLiteral},
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

  Map<String, String> get pluralOverrides => Map<String, String>.unmodifiable(_c.pluralOverrides);

  // Helpers
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
    if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z') || lower.endsWith('ch') || lower.endsWith('sh')) {
      return s + 'es';
    }
    return s + 's';
  }

  String entityBasePath(String plural, {String? microserviceOverride}) {
    final p = _slug(plural);
    final path = useGateway
        ? '/services/${microserviceOverride ?? (gatewayServiceName ?? '')}/api/$p'
        : '/api/$p';
    return _url(path);
  }

  String searchBasePath(String plural, {String? microserviceOverride}) {
    final p = _slug(plural);
    final path = useGateway
        ? '/services/${microserviceOverride ?? (gatewayServiceName ?? '')}/api/_search/$p'
        : '/api/_search/$p';
    return _url(path);
  }

  String _url(String path) {
    final host = apiHost.endsWith('/') ? apiHost.substring(0, apiHost.length - 1) : apiHost;
    final p = path.startsWith('/') ? path : '/$path';
    return host + p;
  }

  String _slug(String s) {
    final trimmed = s.trim();
    final hyphened = trimmed.replaceAll(RegExp(r'\\s+'), '-');
    return hyphened.replaceAll(RegExp(r'[^A-Za-z0-9_\\-]'), '').toLowerCase();
  }

  bool _isVowel(String ch) => 'aeiou'.contains(ch.toLowerCase());
}

`;
}

module.exports = { generateEnvTemplate };
