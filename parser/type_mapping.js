// parser/type_mapping.js
// Maps JDL primitive types -> Dart types.
// Also respects Enums parsed from JDL (returns the Enum name as the Dart type).
//
// Usage:
//   const { jdlToDartType, isNumericType, isDateType, isBooleanType, isBlobType, isEnumType, jdlTypeCategory } = require('./type_mapping');
//   const dartType = jdlToDartType(field.type, enums);
//
// Notes:
// - JDL primitives reference (JHipster):
//   String, Integer, Long, Float, Double, BigDecimal,
//   LocalDate, Instant, ZonedDateTime, Duration,
//   UUID, Boolean,
//   (Blob types) Blob, AnyBlob, ImageBlob, TextBlob
// - Anything unrecognized defaults to 'String' (unless it is an enum).

/** Known JDL primitive mappings to Dart types. */
const PRIMITIVE_MAP = {
  // strings / id-like
  string: 'String',
  uuid: 'String',

  // booleans
  boolean: 'bool',

  // numbers
  integer: 'int',
  long: 'int',
  short: 'int',
  byte: 'int',

  float: 'double',
  double: 'double',
  bigdecimal: 'double',
  decimal: 'double', // alias

  // dates/times
  localdate: 'DateTime',
  instant: 'DateTime',
  zoneddatetime: 'DateTime',
  localdatetime: 'DateTime', // alias if used
  datetime: 'DateTime', // alias if used

  duration: 'Duration',

  // blobs
  blob: 'Uint8List',
  anyblob: 'Uint8List',
  imageblob: 'Uint8List',
  textblob: 'String', // JHipster treats as large text; map to String

  // json-ish (not standard JDL but often appears)
  json: 'Map<String, dynamic>',
  object: 'Map<String, dynamic>',
};

/** Normalize a JDL type token for lookup (lowercase, strip spaces). */
function normalizeJdlType(t) {
  return String(t || '').trim().toLowerCase();
}

/**
 * Returns the Dart type for a given JDL type.
 * - If the type is one of the parsed enums, returns the enum name (unchanged).
 * - Else, maps known primitives.
 * - Else, defaults to 'String'.
 *
 * @param {string} jdlType
 * @param {object} parsedEnums  // { EnumName: ['A','B'] }
 * @returns {string} Dart type
 */
function jdlToDartType(jdlType, parsedEnums = {}) {
  if (!jdlType) return 'String';

  // Enum?
  if (isEnumType(jdlType, parsedEnums)) {
    return jdlType; // keep exact enum name
  }

  const key = normalizeJdlType(jdlType);
  if (PRIMITIVE_MAP[key]) {
    return PRIMITIVE_MAP[key];
  }

  // Fallback to String
  return 'String';
}

/**
 * Whether this JDL type is an enum (based on parsedEnums keys).
 * @param {string} jdlType
 * @param {object} parsedEnums
 * @returns {boolean}
 */
function isEnumType(jdlType, parsedEnums = {}) {
  if (!jdlType) return false;
  return Object.prototype.hasOwnProperty.call(parsedEnums, jdlType);
}

/**
 * Whether the JDL type maps to a numeric Dart type (int/double).
 * @param {string} jdlType
 * @param {object} parsedEnums
 * @returns {boolean}
 */
function isNumericType(jdlType, parsedEnums = {}) {
  if (isEnumType(jdlType, parsedEnums)) return false;
  const t = normalizeJdlType(jdlType);
  return ['integer', 'long', 'short', 'byte', 'float', 'double', 'bigdecimal', 'decimal'].includes(t);
}

/**
 * Whether the JDL type maps to a DateTime Dart type.
 * @param {string} jdlType
 * @param {object} parsedEnums
 * @returns {boolean}
 */
function isDateType(jdlType, parsedEnums = {}) {
  if (isEnumType(jdlType, parsedEnums)) return false;
  const t = normalizeJdlType(jdlType);
  return ['localdate', 'instant', 'zoneddatetime', 'localdatetime', 'datetime'].includes(t);
}

/**
 * Whether the JDL type maps to a boolean Dart type.
 * @param {string} jdlType
 * @param {object} parsedEnums
 * @returns {boolean}
 */
function isBooleanType(jdlType, parsedEnums = {}) {
  if (isEnumType(jdlType, parsedEnums)) return false;
  return normalizeJdlType(jdlType) === 'boolean';
}

/**
 * Whether the JDL type maps to a blob/binary Dart type (Uint8List).
 * @param {string} jdlType
 * @param {object} parsedEnums
 * @returns {boolean}
 */
function isBlobType(jdlType, parsedEnums = {}) {
  if (isEnumType(jdlType, parsedEnums)) return false;
  const t = normalizeJdlType(jdlType);
  return ['blob', 'anyblob', 'imageblob'].includes(t);
}

/**
 * Categorize a JDL type into a coarse class to simplify template logic.
 * One of: 'enum' | 'bool' | 'number' | 'date' | 'duration' | 'blob' | 'json' | 'string'
 * @param {string} jdlType
 * @param {object} parsedEnums
 * @returns {string}
 */
function jdlTypeCategory(jdlType, parsedEnums = {}) {
  if (isEnumType(jdlType, parsedEnums)) return 'enum';

  const t = normalizeJdlType(jdlType);
  if (isBooleanType(jdlType, parsedEnums)) return 'bool';
  if (isNumericType(jdlType, parsedEnums)) return 'number';
  if (isDateType(jdlType, parsedEnums)) return 'date';
  if (t === 'duration') return 'duration';
  if (isBlobType(jdlType, parsedEnums)) return 'blob';
  if (PRIMITIVE_MAP[t] === 'Map<String, dynamic>') return 'json';

  // default to string-like (includes uuid/textblob/string/unrecognized)
  return 'string';
}

module.exports = {
  jdlToDartType,
  isEnumType,
  isNumericType,
  isDateType,
  isBooleanType,
  isBlobType,
  jdlTypeCategory,
  PRIMITIVE_MAP,
};
