// utils/naming.js
// Consistent naming helpers for files, classes, routes, and identifiers.
// - Normalizes entity/enum names to Dart-friendly class names
// - Generates file names/paths for models/services/controllers/forms/views
// - Provides light pluralize/singularize with irregular overrides
// - Case helpers: lcFirst, ucFirst, pascalCase, camelCase, snakeCase, kebabCase, titleCase
//
// All functions are pure and side-effect free.

const IRREGULAR_PLURALS = {
  person: 'people',
  man: 'men',
  woman: 'women',
  child: 'children',
  mouse: 'mice',
  goose: 'geese',
  tooth: 'teeth',
  foot: 'feet',
  ox: 'oxen',
};

const IRREGULAR_SINGULARS = invert(IRREGULAR_PLURALS);

// -------------------- Basic string utils --------------------

function ucFirst(s = '') {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lcFirst(s = '') {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Split into words from camelCase, snake_case, kebab-case, and spaces */
function toWords(s = '') {
  return String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camel → space
    .replace(/[_\-]+/g, ' ')                // snake/kebab → space
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function pascalCase(s = '') {
  return toWords(s).map(w => ucFirst(w.toLowerCase())).join('');
}

function camelCase(s = '') {
  const p = pascalCase(s);
  return lcFirst(p);
}

function snakeCase(s = '') {
  return toWords(s).map(w => w.toLowerCase()).join('_');
}

function kebabCase(s = '') {
  return toWords(s).map(w => w.toLowerCase()).join('-');
}

function titleCase(s = '') {
  return toWords(s).map(w => ucFirst(w.toLowerCase())).join(' ');
}

/** Remove invalid identifier characters; keep letters/digits/_ */
function sanitizeIdentifier(s = '') {
  let out = String(s).replace(/[^A-Za-z0-9_]/g, '');
  if (!out) return '_';
  if (/^[0-9]/.test(out)) out = '_' + out;
  return out;
}

// -------------------- Pluralization --------------------

/**
 * Pluralize a noun with light English rules.
 * Accepts an optional overrides map (e.g., { Person: 'people' }).
 */
function pluralize(word = '', overrides = {}) {
  if (!word) return word;

  const w = word.toLowerCase();
  // Customized overrides (case-insensitive keys)
  const ov = lookupOverride(w, overrides);
  if (ov) return matchCase(word, ov);

  // Known irregulars
  if (IRREGULAR_PLURALS[w]) return matchCase(word, IRREGULAR_PLURALS[w]);

  // Already plural (basic guess)
  if (w.endsWith('s')) return word;

  // Words ending with 'y' -> 'ies' (consonant+y)
  if (/[bcdfghjklmnpqrstvwxyz]y$/.test(w)) {
    return word.slice(0, -1) + matchCaseSuffix(word, 'ies');
  }

  // Words ending with s/x/z/ch/sh -> add 'es'
  if (/(s|x|z|ch|sh)$/.test(w)) {
    return word + matchCaseSuffix(word, 'es');
  }

  // Words ending with 'f' or 'fe' -> 'ves' (knife -> knives), basic set
  if (/(?:[^f]fe|[lr]f)$/.test(w)) {
    if (w.endsWith('fe')) return word.slice(0, -2) + matchCaseSuffix(word, 'ves');
    return word.slice(0, -1) + matchCaseSuffix(word, 'ves');
  }

  // Words ending with 'o' sometimes 'es' (potato → potatoes); keep simple
  if (/[aeiou]o$/.test(w) === false && w.endsWith('o')) {
    return word + matchCaseSuffix(word, 'es');
  }

  // Default: add 's'
  return word + matchCaseSuffix(word, 's');
}

/**
 * Singularize a noun with light English rules.
 * Accepts optional overrides map (inverse of plural overrides).
 */
function singularize(word = '', overrides = {}) {
  if (!word) return word;

  const w = word.toLowerCase();
  const ov = lookupOverride(w, invert(overrides || {}));
  if (ov) return matchCase(word, ov);

  if (IRREGULAR_SINGULARS[w]) return matchCase(word, IRREGULAR_SINGULARS[w]);

  if (/(s|x|z|ch|sh)es$/.test(w)) {
    return word.slice(0, -2); // remove 'es'
  }

  if (/ies$/.test(w)) {
    return word.slice(0, -3) + matchCaseSuffix(word, 'y');
  }

  if (/ves$/.test(w)) {
    return word.slice(0, -3) + matchCaseSuffix(word, 'f');
  }

  if (/s$/.test(w) && !/ss$/.test(w)) {
    return word.slice(0, -1);
  }

  return word;
}

function invert(obj) {
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v != null) out[String(v).toLowerCase()] = String(k).toLowerCase();
  });
  return out;
}

function lookupOverride(keyLower, overrides) {
  if (!overrides) return null;
  const entries = Object.entries(overrides).map(([k, v]) => [k.toLowerCase(), String(v)]);
  const hit = entries.find(([k]) => k === keyLower);
  return hit ? hit[1] : null;
}

function matchCase(source, target) {
  // Preserve capitalization style of source on target.
  if (source.toUpperCase() === source) return target.toUpperCase();
  if (source.toLowerCase() === source) return target.toLowerCase();
  if (source[0] === source[0].toUpperCase()) return ucFirst(target);
  return target;
}

function matchCaseSuffix(source, suffix) {
  // Suffix matching tries to follow case of last char of source.
  const last = source.slice(-1);
  if (last === last.toUpperCase()) return suffix.toUpperCase();
  return suffix.toLowerCase();
}

// -------------------- Dart/Flutter naming --------------------

function entityClassName(entityName) {
  return `${pascalCase(entityName)}Model`;
}

function serviceClassName(entityName) {
  return `${pascalCase(entityName)}Service`;
}

function controllerClassName(entityName) {
  return `${pascalCase(entityName)}Controller`;
}

function formClassName(entityName) {
  return `${pascalCase(entityName)}Form`;
}

function tableViewClassName(entityName) {
  return `${pascalCase(entityName)}TableView`;
}

function enumDartType(enumName) {
  return pascalCase(enumName);
}

// -------------------- File names --------------------

function entityFileBase(entityName) {
  return `${camelCase(entityName)}`;
}

function modelFileName(entityName) {
  return `${entityFileBase(entityName)}_model.dart`;
}

function serviceFileName(entityName) {
  return `${entityFileBase(entityName)}_service.dart`;
}

function controllerFileName(entityName) {
  return `${entityFileBase(entityName)}_controller.dart`;
}

function formFileName(entityName) {
  return `${entityFileBase(entityName)}_form.dart`;
}

function tableViewFileName(entityName) {
  return `${entityFileBase(entityName)}_table_view.dart`;
}

function enumFileName(enumName) {
  return `${camelCase(enumName)}_enum.dart`;
}

// -------------------- Routes & paths --------------------

function routePathForEntity(entityName, overrides = {}) {
  const base = camelCase(entityName);
  return `/${base}`;
}

function modelImportPath(entityName) {
  return `../models/${modelFileName(entityName)}`;
}

function serviceImportPath(entityName) {
  return `../services/${serviceFileName(entityName)}`;
}

function controllerImportPath(entityName) {
  return `../controllers/${controllerFileName(entityName)}`;
}

function formImportPath(entityName) {
  return `../forms/${formFileName(entityName)}`;
}

function viewImportPath(entityName) {
  return `../views/${tableViewFileName(entityName)}`;
}

// -------------------- Entity plural path helper --------------------

/**
 * Resolve a plural resource path segment from an Entity name.
 * Uses overrides first, then irregular rules, then basic English rules.
 * Returns lowercase (API path friendly).
 */
function resourcePlural(entityName, overrides = {}) {
  const name = String(entityName || '');
  const lower = name.toLowerCase();
  const ov = lookupOverride(name, overrides) || lookupOverride(lower, overrides);
  if (ov) return ov.toLowerCase();
  return pluralize(lower);
}

module.exports = {
  // case utils
  ucFirst,
  lcFirst,
  toWords,
  pascalCase,
  camelCase,
  snakeCase,
  kebabCase,
  titleCase,
  sanitizeIdentifier,

  // pluralization
  pluralize,
  singularize,

  // dart names
  entityClassName,
  serviceClassName,
  controllerClassName,
  formClassName,
  tableViewClassName,
  enumDartType,

  // file names
  entityFileBase,
  modelFileName,
  serviceFileName,
  controllerFileName,
  formFileName,
  tableViewFileName,
  enumFileName,

  // imports
  modelImportPath,
  serviceImportPath,
  controllerImportPath,
  formImportPath,
  viewImportPath,

  // routes
  routePathForEntity,

  // resource plural path
  resourcePlural,
};
