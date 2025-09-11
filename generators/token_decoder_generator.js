// generators/token_decoder_generator.js
// Emits lib/core/auth/token_decoder.dart
// - Tiny, dependency-free JWT decoder (header + claims)
// - Base64URL (no padding) safe decoding
// - Helper utilities: expiry/issued-at to DateTime, isJwtExpired with leeway
// - All functions are null-safe and exception-tolerant (return null on parse errors)

function generateTokenDecoderTemplate() {
  return `import 'dart:convert';

/// Decode a JWT's payload (claims) into a Map.
/// Returns null if the token is malformed or not decodable.
Map<String, dynamic>? decodeJwtClaims(String? token) {
  if (token == null || token.isEmpty) return null;
  final parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    final payload = _base64UrlSafeDecode(parts[1]);
    final map = json.decode(payload) as Map<String, dynamic>;
    return map;
  } catch (_) {
    return null;
  }
}

/// Decode a JWT's header into a Map.
/// Returns null if the token is malformed or not decodable.
Map<String, dynamic>? decodeJwtHeader(String? token) {
  if (token == null || token.isEmpty) return null;
  final parts = token.split('.');
  if (parts.length < 1) return null;
  try {
    final header = _base64UrlSafeDecode(parts[0]);
    final map = json.decode(header) as Map<String, dynamic>;
    return map;
  } catch (_) {
    return null;
  }
}

/// Convenience to decode both header and claims at once.
({Map<String, dynamic>? header, Map<String, dynamic>? claims}) decodeJwt(String? token) {
  return (header: decodeJwtHeader(token), claims: decodeJwtClaims(token));
}

/// Extract 'exp' (seconds since epoch) from claims and convert to DateTime (UTC).
DateTime? claimsExpiry(Map<String, dynamic>? claims) {
  if (claims == null) return null;
  final exp = _claimAsInt(claims['exp']);
  if (exp == null) return null;
  return DateTime.fromMillisecondsSinceEpoch(exp * 1000, isUtc: true).toLocal();
}

/// Extract 'iat' (seconds since epoch) from claims and convert to DateTime (UTC).
DateTime? claimsIssuedAt(Map<String, dynamic>? claims) {
  if (claims == null) return null;
  final iat = _claimAsInt(claims['iat']);
  if (iat == null) return null;
  return DateTime.fromMillisecondsSinceEpoch(iat * 1000, isUtc: true).toLocal();
}

/// Get the expiry DateTime directly from a JWT string.
/// Returns null if token or 'exp' is not available.
DateTime? jwtExpiry(String? token) => claimsExpiry(decodeJwtClaims(token));

/// Quick expiry check with optional leeway (seconds).
/// If token cannot be decoded, returns true (treat as expired).
bool isJwtExpired(String? token, {int leewaySeconds = 0}) {
  final exp = jwtExpiry(token);
  if (exp == null) return true;
  final now = DateTime.now();
  // Consider token expired if now is after (exp - leeway)
  return now.isAfter(exp.subtract(Duration(seconds: leewaySeconds)));
}

// ------------------ internals ------------------

String _base64UrlSafeDecode(String input) {
  // Handle missing padding and url-safe alphabet
  String normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  final mod = normalized.length % 4;
  if (mod == 2) {
    normalized += '==';
  } else if (mod == 3) {
    normalized += '=';
  } else if (mod == 1) {
    // Invalid length for base64url; still attempt decode (may throw)
  }
  final bytes = base64Decode(normalized);
  return utf8.decode(bytes);
}

int? _claimAsInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) {
    final n = int.tryParse(v);
    if (n != null) return n;
    // Some providers might send float-like strings
    final d = double.tryParse(v);
    return d?.toInt();
  }
  return null;
}
`;
}

module.exports = { generateTokenDecoderTemplate };
