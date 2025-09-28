// utils/naming.js
// Consistent naming helpers for files, classes, routes, and identifiers.
// - Keeps your existing API
// - Adds compatibility exports: toFileName, toClassName, toInstanceName, toPlural

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
function ucFirst(s = '') { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function lcFirst(s = '') { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

/** Split into words from camelCase, snake_case, kebab-case, and spaces */
function toWords(s = '') {
  return String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camel → space
    .replace(/[_\-]+/g, ' ')                // snake/kebab → space
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function pascalCase(s = '') { return toWords(s).map(w => ucFirst(w.toLowerCase())).join(''); }
function camelCase(s = '') { const p = pascalCase(s); return lcFirst(p); }
function snakeCase(s = '') { return toWords(s).map(w => w.toLowerCase()).join('_'); }
function kebabCase(s = '') { return toWords(s).map(w => w.toLowerCase()).join('-'); }
function titleCase(s = '') { return toWords(s).map(w => ucFirst(w.toLowerCase())).join(' '); }

/** Remove invalid identifier characters; keep letters/digits/_ */
function sanitizeIdentifier(s = '') {
  let out = String(s).replace(/[^A-Za-z0-9_]/g, '');
  if (!out) return '_';
  if (/^[0-9]/.test(out)) out = '_' + out;
  return out;
}

// -------------------- Pluralization --------------------
function pluralize(word = '', overrides = {}) {
  if (!word) return word;
  const w = word.toLowerCase();

  const ov = lookupOverride(w, overrides);
  if (ov) return matchCase(word, ov);

  if (IRREGULAR_PLURALS[w]) return matchCase(word, IRREGULAR_PLURALS[w]);
  if (w.endsWith('s')) return word;

  if (/[bcdfghjklmnpqrstvwxyz]y$/.test(w)) {
    return word.slice(0, -1) + matchCaseSuffix(word, 'ies');
  }
  if (/(s|x|z|ch|sh)$/.test(w)) {
    return word + matchCaseSuffix(word, 'es');
  }
  if (/(?:[^f]fe|[lr]f)$/.test(w)) {
    if (w.endsWith('fe')) return word.slice(0, -2) + matchCaseSuffix(word, 'ves');
    return word.slice(0, -1) + matchCaseSuffix(word, 'ves');
  }
  if (/[aeiou]o$/.test(w) === false && w.endsWith('o')) {
    return word + matchCaseSuffix(word, 'es');
  }
  return word + matchCaseSuffix(word, 's');
}

function singularize(word = '', overrides = {}) {
  if (!word) return word;
  const w = word.toLowerCase();
  const ov = lookupOverride(w, invert(overrides || {}));
  if (ov) return matchCase(word, ov);

  if (IRREGULAR_SINGULARS[w]) return matchCase(word, IRREGULAR_SINGULARS[w]);
  if (/(s|x|z|ch|sh)es$/.test(w)) return word.slice(0, -2);
  if (/ies$/.test(w)) return word.slice(0, -3) + matchCaseSuffix(word, 'y');
  if (/ves$/.test(w)) return word.slice(0, -3) + matchCaseSuffix(word, 'f');
  if (/s$/.test(w) && !/ss$/.test(w)) return word.slice(0, -1);
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
  if (source.toUpperCase() === source) return target.toUpperCase();
  if (source.toLowerCase() === source) return target.toLowerCase();
  if (source[0] === source[0].toUpperCase()) return ucFirst(target);
  return target;
}
function matchCaseSuffix(source, suffix) {
  const last = source.slice(-1);
  return last === last.toUpperCase() ? suffix.toUpperCase() : suffix.toLowerCase();
}

// -------------------- Dart/Flutter naming (your originals) --------------------
function entityClassName(entityName) { return `${pascalCase(entityName)}Model`; }
function serviceClassName(entityName) { return `${pascalCase(entityName)}Service`; }
function controllerClassName(entityName) { return `${pascalCase(entityName)}Controller`; }
function formClassName(entityName) { return `${pascalCase(entityName)}Form`; }
function tableViewClassName(entityName) { return `${pascalCase(entityName)}TableView`; }
function enumDartType(enumName) { return pascalCase(enumName); }

// -------------------- File names (your originals) --------------------
function entityFileBase(entityName) { return `${snakeCase(entityName)}`; }
function modelFileName(entityName) { return `${entityFileBase(entityName)}_model.dart`; }
function serviceFileName(entityName) { return `${entityFileBase(entityName)}_service.dart`; }
function controllerFileName(entityName) { return `${entityFileBase(entityName)}_controller.dart`; }
function formFileName(entityName) { return `${entityFileBase(entityName)}_form.dart`; }
function tableViewFileName(entityName) { return `${entityFileBase(entityName)}_table_view.dart`; }
function enumFileName(enumName) { return `${snakeCase(enumName)}_enum.dart`; }

// -------------------- Routes & paths (your originals) --------------------
function routePathForEntity(entityName) {
  const base = camelCase(entityName);
  return `/${base}`;
}
function modelImportPath(entityName) { return `../models/${modelFileName(entityName)}`; }
function serviceImportPath(entityName) { return `../services/${serviceFileName(entityName)}`; }
function controllerImportPath(entityName) { return `../controllers/${controllerFileName(entityName)}`; }
function formImportPath(entityName) { return `../forms/${formFileName(entityName)}`; }
function viewImportPath(entityName) { return `../views/${tableViewFileName(entityName)}`; }

// -------------------- Resource plural for API paths --------------------
function resourcePlural(entityName, overrides = {}) {
  const name = String(entityName || '');
  const lower = name.toLowerCase();
  const ov = lookupOverride(name, overrides) || lookupOverride(lower, overrides);
  if (ov) return ov.toLowerCase();
  return pluralize(lower);
}

// -------------------- Compatibility exports for the new CLI --------------------
// file base in snake_case for files
function toFileName(input) { return snakeCase(input); }
// PascalCase class name
function toClassName(input) { return pascalCase(input); }
// camelCase instance name
function toInstanceName(input) { return camelCase(input); }
// pluralize snake_case by applying pluralization to the last token
function toPlural(input) {
  const s = String(input || '');
  if (!s) return s;
  const parts = s.split('_');
  const last = parts.pop();
  parts.push(pluralize(last));
  return parts.join('_');
}

module.exports = {
  // case utils
  ucFirst, lcFirst, toWords, pascalCase, camelCase, snakeCase, kebabCase, titleCase, sanitizeIdentifier,

  // pluralization
  pluralize, singularize,

  // dart names (originals)
  entityClassName, serviceClassName, controllerClassName, formClassName, tableViewClassName, enumDartType,

  // file names (originals)
  entityFileBase, modelFileName, serviceFileName, controllerFileName, formFileName, tableViewFileName, enumFileName,

  // imports (originals)
  modelImportPath, serviceImportPath, controllerImportPath, formImportPath, viewImportPath,

  // routes (originals)
  routePathForEntity,

  // resource plural
  resourcePlural,

  // NEW compatibility API expected by bin/index.js
  toFileName, toClassName, toInstanceName, toPlural,
};
