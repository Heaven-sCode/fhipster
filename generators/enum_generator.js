// generators/enum_generator.js
// Emits lib/enums/<enum>_enum.dart
// - Simple Dart enum + (de)serialization helpers
// - Keeps original JDL enum value tokens (after sanitizing to valid identifiers)
// - Produces toJson()/fromJson-style top-level helpers
//
// Usage:
//   const dart = generateEnumTemplate('Status', ['NEW','ACTIVE','PAUSED']);
//   // writes to lib/enums/status_enum.dart

function sanitizeEnumMember(name) {
  // Dart identifier: letters, digits, underscore; cannot start with digit.
  let s = String(name || '').trim();
  if (!s) s = 'UNKNOWN';
  // Replace invalid chars with underscore
  s = s.replace(/[^A-Za-z0-9_]/g, '_');
  // If starts with digit, prefix underscore
  if (/^[0-9]/.test(s)) s = '_' + s;
  return s;
}

function generateEnumTemplate(enumName, values = []) {
  const enumId = String(enumName).trim();
  const fileHeader = `// ignore_for_file: constant_identifier_names

/// Generated enum for ${enumId} (from JDL).
/// Values are serialized as their enum token (e.g., 'ACTIVE').
`;

  const sanitized = values
    .map(v => sanitizeEnumMember(v))
    .filter((v, i, arr) => v && arr.indexOf(v) === i);

  const enumDecl = `enum ${enumId} {
  ${sanitized.join(',\n  ')}
}
`;

  // Helper functions use toString().split('.') to avoid depending on Dart's .name property.
  const helpers = `extension ${enumId}X on ${enumId} {
  /// 'Status.ACTIVE' -> 'ACTIVE'
  String get value => toString().split('.').last;
}

/// Try to parse any input to the enum; returns null if no match.
/// Accepts the raw token ('ACTIVE') or a full 'EnumName.TOKEN' string.
${enumId}? ${_lcFirst(enumId)}FromJson(Object? input) {
  if (input == null) return null;
  final s = input.toString();
  final token = s.contains('.') ? s.split('.').last : s;
  for (final e in ${enumId}.values) {
    if (e.toString().split('.').last == token) return e;
  }
  return null;
}

/// Serialize enum to its token (e.g., 'ACTIVE'), or null.
Object? ${_lcFirst(enumId)}ToJson(${enumId}? e) => e?.toString().split('.').last;
`;

  return fileHeader + enumDecl + helpers;
}

function _lcFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

module.exports = { generateEnumTemplate };
