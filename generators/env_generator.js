// generators/env_generator.js
// Emits lib/core/env/env.dart
//
// - Two baked profiles (dev & prod) injected from generator
// - Env.initGenerated() registers both and defaults to 'dev'
// - Env.setProfile('dev'|'prod') or Env.use('dev'|'prod')
// - AuthProvider: keycloak | jhipsterJwt
// - Gateway-aware base path builder (JHipster API Gateway)
// - Shared defaults for paging/sorting, headers, storage keys
//
// Input:
//   generateEnvTemplate({ devProfile, prodProfile })
//
// Where each profile is a plain JS object with fields like:
//   {
//     appName, envName, apiHost, useGateway, gatewayServiceName,
//     authProvider, jwtAuthEndpoint, accountEndpoint, allowCredentialCacheForJwt,
//     keycloakTokenEndpoint, keycloakLogoutEndpoint, keycloakAuthorizeEndpoint, keycloakUserinfoEndpoint,
//     keycloakClientId, keycloakClientSecret, keycloakScopes (string[]),
//     defaultPageSize, pageSizeOptions (int[]), defaultSort (string[]), defaultSearchSort (string[]), distinctByDefault,
//     totalCountHeaderName,
//     storageKeyAccessToken, storageKeyAccessExpiry, storageKeyRefreshToken, storageKeyRefreshExpiry, storageKeyRememberedUsername,
//     relationshipPayloadMode,
//     pluralOverrides: { [k:string]: string }
//   }

function s(v) {
  if (v === null || v === undefined) return 'null';
  const str = String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${str}'`;
}
function b(v) {
  return v ? 'true' : 'false';
}
function listStr(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 'const <String>[]';
  return `const <String>[${arr.map(s).join(', ')}]`;
}
function listInt(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 'const <int>[]';
  return `const <int>[${arr.map((n) => Number(n)).join(', ')}]`;
}
function mapStr(map) {
  const obj = map || {};
  const entries = Object.entries(obj);
  if (entries.length === 0) return 'const <String, String>{}';
  const body = entries
    .map(([k, v]) => `${s(String(k))}: ${s(String(v))}`)
    .join(', ');
  return `const <String, String>{${body}}`;
}
function authEnum(provider) {
  return String(provider) === 'jhipsterJwt' ? 'AuthProvider.jhipsterJwt' : 'AuthProvider.keycloak';
}

function cfgToDart(profile, label = 'dev') {
  // Safeguard defaults
  const p = {
    appName: 'FHipster',
    envName: label,
    apiHost: 'http://localhost:8080',
    useGateway: false,
    gatewayServiceName: null,

    authProvider: 'keycloak',

    jwtAuthEndpoint: '/api/authenticate',
    accountEndpoint: '/api/account',
    allowCredentialCacheForJwt: false,

    keycloakTokenEndpoint: null,
    keycloakLogoutEndpoint: null,
    keycloakAuthorizeEndpoint: null,
    keycloakUserinfoEndpoint: null,
    keycloakClientId: null,
    keycloakClientSecret: null,
    keycloakScopes: ['openid', 'profile', 'email', 'offline_access'],

    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
    defaultSort: ['id,desc'],
    defaultSearchSort: ['_score,desc'],
    distinctByDefault: false,

    totalCountHeaderName: 'X-Total-Count',
    storageKeyAccessToken: 'fh_access_token',
    storageKeyAccessExpiry: 'fh_access_expiry',
    storageKeyRefreshToken: 'fh_refresh_token',
    storageKeyRefreshExpiry: 'fh_refresh_expiry',
    storageKeyRememberedUsername: 'fh_remembered_username',

    relationshipPayloadMode: 'idOnly',
    pluralOverrides: {},
    ...(profile || {}),
  };

  return `EnvConfig(
      // ---- Identity ----
      appName: ${s(p.appName)},
      envName: ${s(p.envName)},

      // ---- Networking ----
      apiHost: ${s(p.apiHost)},
      useGateway: ${b(!!p.useGateway)},
      gatewayServiceName: ${p.gatewayServiceName ? s(p.gatewayServiceName) : 'null'},

      // ---- Auth ----
      authProvider: ${authEnum(p.authProvider)},

      // JWT (JHipster)
      jwtAuthEndpoint: ${s(p.jwtAuthEndpoint)},
      accountEndpoint: ${s(p.accountEndpoint)},
      allowCredentialCacheForJwt: ${b(!!p.allowCredentialCacheForJwt)},

      // Keycloak (OIDC)
      tokenEndpoint: ${p.keycloakTokenEndpoint ? s(p.keycloakTokenEndpoint) : 'null'},
      logoutEndpoint: ${p.keycloakLogoutEndpoint ? s(p.keycloakLogoutEndpoint) : 'null'},
      authorizeEndpoint: ${p.keycloakAuthorizeEndpoint ? s(p.keycloakAuthorizeEndpoint) : 'null'},
      userinfoEndpoint: ${p.keycloakUserinfoEndpoint ? s(p.keycloakUserinfoEndpoint) : 'null'},
      keycloakClientId: ${p.keycloakClientId ? s(p.keycloakClientId) : 'null'},
      keycloakClientSecret: ${p.keycloakClientSecret ? s(p.keycloakClientSecret) : 'null'},
      keycloakScopes: ${listStr(p.keycloakScopes)},

      // ---- Paging / sorting ----
      defaultPageSize: ${Number(p.defaultPageSize)},
      pageSizeOptions: ${listInt(p.pageSizeOptions)},
      defaultSort: ${listStr(p.defaultSort)},
      defaultSearchSort: ${listStr(p.defaultSearchSort)},
      distinctByDefault: ${b(!!p.distinctByDefault)},

      // ---- Headers / storage ----
      totalCountHeaderName: ${s(p.totalCountHeaderName)},
      storageKeyAccessToken: ${s(p.storageKeyAccessToken)},
      storageKeyAccessExpiry: ${s(p.storageKeyAccessExpiry)},
      storageKeyRefreshToken: ${s(p.storageKeyRefreshToken)},
      storageKeyRefreshExpiry: ${s(p.storageKeyRefreshExpiry)},
      storageKeyRememberedUsername: ${s(p.storageKeyRememberedUsername)},

      // ---- Relationships ----
      relationshipPayloadMode: ${s(p.relationshipPayloadMode)},

      // ---- Plural overrides ----
      pluralOverrides: ${mapStr(p.pluralOverrides)},
    )`;
}

function generateEnvTemplate({ devProfile = {}, prodProfile = {} } = {}) {
  const devCfg = cfgToDart(devProfile, 'dev');
  const prodCfg = cfgToDart(prodProfile, 'prod');

  return `// GENERATED BY FHipster — do not edit by hand.
//
// Env & EnvConfig with baked profiles (dev, prod).
// Use Env.initGenerated(); Env.setProfile('dev'|'prod');
//
// If you need to override at runtime, you can still call:
//   Env.init(EnvConfig(...));   // single profile
//   Env.registerProfiles({...}); Env.use('prod'); // multi-profile
//
// Switching profiles at runtime:
//   Env.setProfile('prod');  // alias of Env.use('prod')
//
// Build-time switch via Dart define:
//   flutter run -t lib/main.dart --dart-define=ENV=prod

enum AuthProvider { keycloak, jhipsterJwt }

class EnvConfig {
  // ---- Identity ----
  final String appName;
  final String envName;

  // ---- Networking ----
  final String apiHost;                // e.g., http://localhost:8080
  final bool useGateway;               // /services/<svc>/api/**
  final String? gatewayServiceName;    // service segment when useGateway=true

  // ---- Auth ----
  final AuthProvider authProvider;     // keycloak | jhipsterJwt

  // JWT (JHipster)
  final String jwtAuthEndpoint;        // /api/authenticate
  final String accountEndpoint;        // /api/account
  final bool allowCredentialCacheForJwt;

  // Keycloak (OIDC)
  final String? tokenEndpoint;
  final String? logoutEndpoint;
  final String? authorizeEndpoint;
  final String? userinfoEndpoint;
  final String? keycloakClientId;
  final String? keycloakClientSecret;
  final List<String> keycloakScopes;

  // ---- Paging / sorting ----
  final int defaultPageSize;
  final List<int> pageSizeOptions;
  final List<String> defaultSort;
  final List<String> defaultSearchSort;
  final bool distinctByDefault;

  // ---- Headers / storage ----
  final String totalCountHeaderName;
  final String storageKeyAccessToken;
  final String storageKeyAccessExpiry;
  final String storageKeyRefreshToken;
  final String storageKeyRefreshExpiry;
  final String storageKeyRememberedUsername;

  // ---- Relationships ----
  final String relationshipPayloadMode; // 'idOnly' | 'fullObject'

  // ---- Plural overrides ----
  final Map<String, String> pluralOverrides;

  const EnvConfig({
    // Identity
    required this.appName,
    required this.envName,

    // Networking
    required this.apiHost,
    required this.useGateway,
    required this.gatewayServiceName,

    // Auth
    required this.authProvider,

    // JWT
    required this.jwtAuthEndpoint,
    required this.accountEndpoint,
    required this.allowCredentialCacheForJwt,

    // Keycloak
    required this.tokenEndpoint,
    required this.logoutEndpoint,
    required this.authorizeEndpoint,
    required this.userinfoEndpoint,
    required this.keycloakClientId,
    required this.keycloakClientSecret,
    required this.keycloakScopes,

    // Paging/sorting
    required this.defaultPageSize,
    required this.pageSizeOptions,
    required this.defaultSort,
    required this.defaultSearchSort,
    required this.distinctByDefault,

    // Headers/storage
    required this.totalCountHeaderName,
    required this.storageKeyAccessToken,
    required this.storageKeyAccessExpiry,
    required this.storageKeyRefreshToken,
    required this.storageKeyRefreshExpiry,
    required this.storageKeyRememberedUsername,

    // Relationships
    required this.relationshipPayloadMode,

    // Plurals
    required this.pluralOverrides,
  });

  EnvConfig copyWith({
    String? appName,
    String? envName,
    String? apiHost,
    bool? useGateway,
    String? gatewayServiceName,

    AuthProvider? authProvider,
    String? jwtAuthEndpoint,
    String? accountEndpoint,
    bool? allowCredentialCacheForJwt,

    String? tokenEndpoint,
    String? logoutEndpoint,
    String? authorizeEndpoint,
    String? userinfoEndpoint,
    String? keycloakClientId,
    String? keycloakClientSecret,
    List<String>? keycloakScopes,

    int? defaultPageSize,
    List<int>? pageSizeOptions,
    List<String>? defaultSort,
    List<String>? defaultSearchSort,
    bool? distinctByDefault,

    String? totalCountHeaderName,
    String? storageKeyAccessToken,
    String? storageKeyAccessExpiry,
    String? storageKeyRefreshToken,
    String? storageKeyRefreshExpiry,
    String? storageKeyRememberedUsername,

    String? relationshipPayloadMode,
    Map<String, String>? pluralOverrides,
  }) {
    return EnvConfig(
      appName: appName ?? this.appName,
      envName: envName ?? this.envName,
      apiHost: apiHost ?? this.apiHost,
      useGateway: useGateway ?? this.useGateway,
      gatewayServiceName: gatewayServiceName ?? this.gatewayServiceName,

      authProvider: authProvider ?? this.authProvider,
      jwtAuthEndpoint: jwtAuthEndpoint ?? this.jwtAuthEndpoint,
      accountEndpoint: accountEndpoint ?? this.accountEndpoint,
      allowCredentialCacheForJwt: allowCredentialCacheForJwt ?? this.allowCredentialCacheForJwt,

      tokenEndpoint: tokenEndpoint ?? this.tokenEndpoint,
      logoutEndpoint: logoutEndpoint ?? this.logoutEndpoint,
      authorizeEndpoint: authorizeEndpoint ?? this.authorizeEndpoint,
      userinfoEndpoint: userinfoEndpoint ?? this.userinfoEndpoint,
      keycloakClientId: keycloakClientId ?? this.keycloakClientId,
      keycloakClientSecret: keycloakClientSecret ?? this.keycloakClientSecret,
      keycloakScopes: keycloakScopes ?? this.keycloakScopes,

      defaultPageSize: defaultPageSize ?? this.defaultPageSize,
      pageSizeOptions: pageSizeOptions ?? this.pageSizeOptions,
      defaultSort: defaultSort ?? this.defaultSort,
      defaultSearchSort: defaultSearchSort ?? this.defaultSearchSort,
      distinctByDefault: distinctByDefault ?? this.distinctByDefault,

      totalCountHeaderName: totalCountHeaderName ?? this.totalCountHeaderName,
      storageKeyAccessToken: storageKeyAccessToken ?? this.storageKeyAccessToken,
      storageKeyAccessExpiry: storageKeyAccessExpiry ?? this.storageKeyAccessExpiry,
      storageKeyRefreshToken: storageKeyRefreshToken ?? this.storageKeyRefreshToken,
      storageKeyRefreshExpiry: storageKeyRefreshExpiry ?? this.storageKeyRefreshExpiry,
      storageKeyRememberedUsername: storageKeyRememberedUsername ?? this.storageKeyRememberedUsername,

      relationshipPayloadMode: relationshipPayloadMode ?? this.relationshipPayloadMode,
      pluralOverrides: pluralOverrides ?? this.pluralOverrides,
    );
  }

  bool get isKeycloak => authProvider == AuthProvider.keycloak;
  bool get isJwt => authProvider == AuthProvider.jhipsterJwt;
}

class Env {
  static EnvConfig? _cfg;
  static final Map<String, EnvConfig> _profiles = <String, EnvConfig>{};

  /// Initialize with a single config (no profiles).
  static void init(EnvConfig cfg) {
    _cfg = cfg;
  }

  /// Initialize baked profiles (dev & prod). Defaults to dev.
  static void initGenerated() {
    final dev = ${devCfg};
    final prod = ${prodCfg};
    registerProfiles(<String, EnvConfig>{'dev': dev, 'prod': prod});
    _cfg = dev;
  }

  /// Register multiple named profiles.
  static void registerProfiles(Map<String, EnvConfig> profiles) {
    _profiles
      ..clear()
      ..addAll(profiles);
  }

  /// Register/replace a single named profile.
  static void registerProfile(String name, EnvConfig cfg) {
    _profiles[name] = cfg;
  }

  /// Use a named profile (throws if not found).
  static void use(String name) {
    final cfg = _profiles[name];
    if (cfg == null) {
      throw ArgumentError("Unknown profile: $name. Available: \${_profiles.keys.toList()}");
    }
    _cfg = cfg;
  }

  /// Alias for [use].
  static void setProfile(String name) => use(name);

  /// Get current active config (throws if not initialized).
  static EnvConfig get() {
    final c = _cfg;
    if (c == null) {
      throw StateError('Env not initialized. Call Env.initGenerated() or Env.init(EnvConfig).');
    }
    return c;
  }

  /// Build the base API path considering gateway mode.
  /// Example (gateway ON):
  ///   apiBasePath(microservice: 'dms') => http://host/services/dms/api
  /// Example (gateway OFF):
  ///   apiBasePath() => http://host/api
  static String apiBasePath({String microservice = '', String prefix = 'api'}) {
    final cfg = get();
    final host = _trimTrailing(cfg.apiHost);
    if (cfg.useGateway) {
      final svc = (cfg.gatewayServiceName?.isNotEmpty ?? false)
          ? cfg.gatewayServiceName!
          : microservice;
      if (svc.isEmpty) {
        return '\$host/\$prefix';
      }
      return '\$host/services/\$svc/\$prefix';
    }
    return '\$host/\$prefix';
  }

  /// Convenience: build an absolute URL from a path segment
  ///   buildUrl('/health') -> http://host/health
  static String buildUrl(String path) {
    final base = _trimTrailing(get().apiHost);
    if (path.startsWith('/')) return '\$base\$path';
    return '\$base/\$path';
  }

  /// Default headers (JSON) with optional Bearer token.
  static Map<String, String> defaultHeaders({String? accessToken}) {
    final map = <String, String>{
      'Content-Type': 'application/json',
    };
    if (accessToken != null && accessToken.isNotEmpty) {
      map['Authorization'] = 'Bearer \$accessToken';
    }
    return map;
  }

  /// Merge-Patch headers.
  static Map<String, String> mergePatchHeaders({String? accessToken}) {
    final map = <String, String>{
      'Content-Type': 'application/merge-patch+json',
    };
    if (accessToken != null && accessToken.isNotEmpty) {
      map['Authorization'] = 'Bearer \$accessToken';
    }
    return map;
  }

  static String _trimTrailing(String s) {
    return s.replaceAll(RegExp(r'/+\$'), '');
  }
}
`;
}

module.exports = { generateEnvTemplate };
