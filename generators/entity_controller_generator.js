// generators/entity_controller_generator.js
// Emits lib/controllers/<entity>_controller.dart
// - GetxController per entity
// - List state: items, isLoading, page, size, total, sort, query (debounced)
// - CRUD via <Entity>Service
// - Search (Elasticsearch) when query is non-empty; otherwise criteria list
// - Relationship option loaders (single: Rxn<T>; multi: RxList<T>)
// - Form state owned by controller (Stateless GetView forms bind to this)
// - Helpers: beginCreate/beginEdit, submit (create/update), delete, refresh
//
// Usage:
//   writeFile(..., generateEntityControllerTemplate('Order', fields, enums), ...)
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function lcFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

const { jdlToDartType, isBooleanType, isEnumType, isDateType, isNumericType, normalizeJdlType } = require('../parser/type_mapping');
const { toFileName } = require('../utils/naming');

function lcFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

function generateEntityControllerTemplate(entityName, fields, parsedEnums = {}, options = {}) {
  const className = `${entityName}Controller`;
  const modelClass = `${entityName}Model`;
  const serviceClass = `${entityName}Service`;
  const instance = lcFirst(entityName);

  const tenantIsolation = options.tenantIsolation || {};
  const tenantEnabled = !!tenantIsolation.enabled && !!tenantIsolation.fieldName;
  const tenantFieldName = tenantIsolation.fieldName;
  const enableSQLite = !!options.enableSQLite;

  // Relationships
  const rels = fields.filter(f => f.isRelationship);
  const singleRels = rels.filter(f => {
    const t = (f.relationshipType || '').toLowerCase();
    return t === 'manytoone' || t === 'onetoone';
  });
  const multiRels = rels.filter(f => {
    const t = (f.relationshipType || '').toLowerCase();
    return t === 'onetomany' || t === 'manytomany';
  });

  const multiRelMeta = multiRels.map((r) => ({
    ...r,
    stateName: `selected${cap(r.name)}`,
  }));

  // Collect imports for related models & services
  const relModelImports = Array.from(new Set(rels.map(r => `import '../models/${toFileName(r.targetEntity)}_model.dart';`))).join('\n');
  const relServiceImports = Array.from(new Set(rels.map(r => `import '../services/${toFileName(r.targetEntity)}_service.dart';`))).join('\n');

  // Enums used by primitive fields
  const enumTypesUsed = Array.from(new Set(fields.filter(f => !f.isRelationship && parsedEnums?.[f.type]).map(f => f.type)));
  const enumImports = enumTypesUsed.map(e => `import '../enums/${toFileName(e)}_enum.dart';`).join('\n');

  // TextEditingControllers for primitive (non-rel) inputs
  const primFields = fields.filter(f => !f.isRelationship && f.name !== 'id' && !(tenantEnabled && f.name === tenantFieldName));
  const textCtlDecls = primFields.map(f => {
    const cat = categorizeField(f, parsedEnums);
    if (cat === 'bool') {
      return `  final RxBool ${f.name} = false.obs;`;
    }
    if (cat === 'enum') {
      return `  final Rx<${f.type}?> ${f.name} = Rx<${f.type}?>(null);`;
    }
    // For numbers, dates, strings, json -> use TextEditingController
    return `  final TextEditingController ${f.name}Ctrl = TextEditingController();`;
  }).join('\n');

  // Relationship state declarations
  const singleRelDecls = singleRels.map(r => {
    const tModel = `${r.targetEntity}Model`;
    const fname = r.name;
    return [
      `  final Rx<${tModel}?> ${fname} = Rx<${tModel}?>(null);`,
      `  final RxList<${tModel}> ${fname}Options = <${tModel}>[].obs;`,
      `  final RxBool ${fname}Loading = false.obs;`,
    ].join('\n');
  }).join('\n');

  const multiRelDecls = multiRelMeta.map(r => {
    const tModel = `${r.targetEntity}Model`;
    const fname = r.name;
    const stateName = r.stateName;
    return [
      `  final RxList<${tModel}> ${stateName} = <${tModel}>[].obs;`,
      `  final RxList<${tModel}> ${fname}Options = <${tModel}>[].obs;`,
      `  final RxBool ${fname}Loading = false.obs;`,
    ].join('\n');
  }).join('\n');

  // init form from model
  const fillFormLines = primFields.map(f => {
    const n = f.name;
    if (tenantEnabled && n === tenantFieldName) {
      return `      ${n}: _editing.value?.${n},`;
    }
    const cat = categorizeField(f, parsedEnums);
    if (cat === 'bool') return `    ${n}.value = m?.${n} ?? false;`;
    if (cat === 'enum') return `    ${n}.value = m?.${n};`;
    if (cat === 'date') return `    ${n}Ctrl.text = m?.${n}?.toIso8601String().split('T').first ?? '';`;
    if (cat === 'datetime') return `    ${n}Ctrl.text = m?.${n}?.toIso8601String() ?? '';`;
    return `    ${n}Ctrl.text = m?.${n}?.toString() ?? '';`;
  }).join('\n');

  const fillRelSingles = singleRels.map(r => `    ${r.name}.value = m?.${r.name};`).join('\n');
  const fillRelMultis = multiRelMeta.map(r => `    ${r.stateName}.assignAll(m?.${r.name} ?? const []);`).join('\n');

  // build model from form
  const buildModelLines = fields.map(f => {
    const n = f.name;
    if (tenantEnabled && n === tenantFieldName) return `      ${n}: _editing.value?.${n},`;
    if (n === 'id') return `      id: _editing.value?.id,`;
    if (f.isAudit) return `      ${n}: _editing.value?.${n},`;
    if (f.isRelationship) {
      const t = (f.relationshipType || '').toLowerCase();
      if (t === 'onetomany' || t === 'manytomany') {
        const relMeta = multiRelMeta.find((meta) => meta.name === n);
        const stateName = relMeta ? relMeta.stateName : n;
        return `      ${n}: ${stateName}.toList(),`;
      }
      return `      ${n}: ${n}.value,`;
    }
    const cat = categorizeField(f, parsedEnums);
    if (cat === 'bool') {
      return `      ${n}: ${n}.value,`;
    }
    if (cat === 'enum') {
      return `      ${n}: ${n}.value,`;
    }
    if (cat === 'date') {
      return `      ${n}: ${n}Ctrl.text.isEmpty ? null : DateTime.tryParse(${n}Ctrl.text!),`;
    }
    if (cat === 'number') {
      const dart = jdlToDartType(f.type, parsedEnums);
      if (dart === 'int') return `      ${n}: int.tryParse(${n}Ctrl.text),`;
      return `      ${n}: double.tryParse(${n}Ctrl.text),`;
    }
    if (cat === 'json') {
      return `      ${n}: ${n}Ctrl.text.isEmpty ? null : _tryParseJson(${n}Ctrl.text),`;
    }
    const dartType = jdlToDartType(f.type, parsedEnums);
    if (dartType === 'DateTime') {
      return `      ${n}: ${n}Ctrl.text.isEmpty ? null : DateTime.tryParse(${n}Ctrl.text!),`;
    }
    return `      ${n}: ${n}Ctrl.text.isEmpty ? null : ${n}Ctrl.text!,`;
  }).join('\n');

  // clear form
  const clearFormLines = primFields.map(f => {
    const n = f.name;
    const cat = categorizeField(f, parsedEnums);
    if (cat === 'bool') return `    ${n}.value = false;`;
    if (cat === 'enum') return `    ${n}.value = null;`;
    return `    ${n}Ctrl.clear();`;
  }).join('\n');
  const clearRelSingles = singleRels.map(r => `    ${r.name}.value = null;`).join('\n');
  const clearRelMultis = multiRelMeta.map(r => `    ${r.stateName}.clear();`).join('\n');

  // relation option loaders
  const singleLoaders = singleRels.map(r => {
    const service = `${r.targetEntity}Service`;
    const tModel = `${r.targetEntity}Model`;
    const fname = r.name;
    return `
  Future<void> load${cap(fname)}Options() async {
    if (!Get.isRegistered<${service}>()) Get.put(${service}());
    final svc = Get.find<${service}>();
    try {
      ${fname}Loading.value = true;
      final res = await svc.listPaged(page: 0, size: 1000, sort: ['id,asc']);
      ${fname}Options.assignAll(res.items);
      final current = ${fname}.value;
      final currentId = current?.id;
      if (currentId != null) {
        final idx = ${fname}Options.indexWhere((e) => e.id == currentId);
        if (idx != -1) {
          ${fname}.value = ${fname}Options[idx];
        }
      }
    } catch (e) {
      _error('Failed to load ${fname} options', e);
    } finally {
      ${fname}Loading.value = false;
    }
  }`;
  }).join('\n');

  const multiLoaders = multiRelMeta.map(r => {
    const service = `${r.targetEntity}Service`;
    const fname = r.name;
    return `
  Future<void> load${cap(fname)}Options() async {
    if (!Get.isRegistered<${service}>()) Get.put(${service}());
    final svc = Get.find<${service}>();
    try {
      ${fname}Loading.value = true;
      final res = await svc.listPaged(page: 0, size: 1000, sort: ['id,asc']);
      ${fname}Options.assignAll(res.items);
    } catch (e) {
      _error('Failed to load ${fname} options', e);
    } finally {
      ${fname}Loading.value = false;
    }
  }`;
  }).join('\n');

  // controller content
  const syncImport = enableSQLite ? "import '../core/sync/sync_service.dart';\n" : '';
  const syncInitCall = enableSQLite
    ? '    if (Get.isRegistered<SyncService>()) {\n      Get.find<SyncService>().syncNow().catchError((_) {});\n    }\n'
    : '';

  return `import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'dart:html' as html;
import '../core/env/env.dart';
${syncImport}import '../models/${toFileName(entityName)}_model.dart';
import '../services/${toFileName(entityName)}_service.dart';
${enumImports ? enumImports + '\n' : ''}${relModelImports ? relModelImports + '\n' : ''}${relServiceImports ? relServiceImports + '\n' : ''}

/// Controller for ${entityName} list & form state.
class ${className} extends GetxController {
  // ===== List state =====
  final RxList<${modelClass}> items = <${modelClass}>[].obs;
  final RxBool isLoading = false.obs;
  final RxBool isSaving = false.obs;
  static bool _searchSupported = true;

  final RxInt page = 0.obs;
  final RxInt size = 0.obs;
  final RxInt total = 0.obs;
  final RxList<String> sort = <String>[].obs;

  final RxString query = ''.obs;
  final RxMap<String, Map<String, dynamic>> filters = <String, Map<String, dynamic>>{}.obs;
  final Rx<String?> viewId = Rx<String?>(null);
  Worker? _searchDebounce;

  // ===== Form state =====
  final Rx<${modelClass}?> _editing = Rx<${modelClass}?>(null);

${textCtlDecls}

${singleRelDecls}
${multiRelDecls}

  ${serviceClass} get service {
    if (!Get.isRegistered<${serviceClass}>()) Get.put(${serviceClass}());
    return Get.find<${serviceClass}>();
  }

  @override
  void onInit() {
    super.onInit();
    size.value = Env.get().defaultPageSize;
    sort.assignAll(Env.get().defaultSort);

    // Parse filters from URL parameters
    final params = Get.parameters;
    final newFilters = <String, Map<String, dynamic>>{};
    params.forEach((key, value) {
      final parts = key.split('.');
      if (parts.length == 2) {
        final field = parts[0];
        final op = parts[1];
        newFilters[field] ??= {};
        newFilters[field]![op] = value;
      }
    });
    filters.assignAll(newFilters);

    // Set viewId if present in route params
    viewId.value = Get.parameters['id'];

    _searchDebounce = debounce(query, (_) {
      loadPage(0);
    }, time: const Duration(milliseconds: 350));

    // Eagerly load relation options (optional; comment out for lazy)
${singleRels.map(r => `    load${cap(r.name)}Options();`).join('\n')}
${multiRelMeta.map(r => `    load${cap(r.name)}Options();`).join('\n')}

    loadPage(0);
${syncInitCall}
  }

  @override
  void onClose() {
    _searchDebounce?.dispose();
${primFields.filter(f => !isEnumType(f.type, parsedEnums) && !isBooleanType(f.type, parsedEnums)).map(f => `    ${f.name}Ctrl.dispose();`).join('\n')}
    super.onClose();
  }

  // ===== List / Search =====

  Future<void> loadPage(int p) async {
    try {
      isLoading.value = true;
      page.value = p;

      var loadedViaSearch = false;
      final trimmedQuery = (query.value).trim();
      if (_searchSupported && trimmedQuery.isNotEmpty) {
        try {
          final wildcardQuery = _wildcardQuery(trimmedQuery);
          final res = await service.search(
            query: wildcardQuery,
            page: page.value,
            size: size.value,
            sort: sort.toList(),
            filters: filters.isNotEmpty ? filters : null,
          );
          items.assignAll(res.items);
          total.value = res.total ?? res.items.length;
          loadedViaSearch = true;
        } catch (e) {
          final message = e.toString().toLowerCase();
          final isNotFound = message.contains('http 404') || message.contains('not found');
          if (!isNotFound) {
            rethrow;
          }
          // mark search as unsupported so we stop hitting the missing endpoint
          _searchSupported = false;
          // fall through to standard list load when search endpoint is unavailable
        }
      }

      if (!loadedViaSearch) {
        final res = await service.listPaged(
          page: page.value,
          size: size.value,
          sort: sort.toList(),
          filters: filters.isNotEmpty ? filters : null,
        );
        items.assignAll(res.items);
        total.value = res.total ?? res.items.length;
      }
    } catch (e) {
      _error('Failed to load ${entityName} list', e);
    } finally {
      isLoading.value = false;
    }
  }

  void applySearch(String text) {
    query.value = text;
  }

  void applyFilters(Map<String, Map<String, dynamic>> newFilters) {
    filters.assignAll(newFilters);
    if (kIsWeb) {
      final query = <String, String>{};
      filters.forEach((field, ops) {
        ops.forEach((op, val) {
          query['\${field}.\${op}'] = val.toString();
        });
      });
      final queryString = query.isNotEmpty ? '?' + query.entries.map((e) => '\${Uri.encodeQueryComponent(e.key)}=\${Uri.encodeQueryComponent(e.value)}').join('&') : '';
      final currentUrl = html.window.location.href;
      final baseUrl = currentUrl.split('?')[0];
      html.window.history.replaceState(null, '', '\$baseUrl\$queryString');
    }
    loadPage(0);
  }

  void changePageSize(int newSize) {
    size.value = newSize;
    // If current page would be beyond available pages with new size, go to last available page
    final maxPage = total.value > 0 ? ((total.value - 1) ~/ newSize) : 0;
    final targetPage = page.value > maxPage ? maxPage : 0;
    loadPage(targetPage);
  }

  void changeSort(List<String> newSort) {
    sort.assignAll(newSort);
    loadPage(0);
  }

  String _wildcardQuery(String raw) {
    final term = raw.trim();
    if (term.isEmpty) return term;
    final normalized = term.replaceAll('*', '');
    if (normalized.isEmpty) return '*';
    return '*\$normalized*';
  }

  // ===== Form flow =====

  void beginCreate() {
    _editing.value = null;
    _clearForm();
  }

  void beginEdit(${modelClass} m) {
    _editing.value = m;
    _fillForm(m);
  }

  void duplicateFrom(${modelClass} source) {
    _editing.value = null;
    _clearForm();
    _fillForm(source.copyWith(id: null));
  }

  Future<bool> submitForm() async {
    final model = _buildModelFromForm();
    try {
      isSaving.value = true;
      if (_editing.value?.id == null) {
        final created = await service.create(model);
        _editing.value = created;
        _info('${entityName} created');
      } else {
        final updated = await service.update(model);
        _editing.value = updated;
        _info('${entityName} updated');
      }
      await loadPage(page.value);
      return true;
    } catch (e) {
      _error('Failed to save ${entityName}', e);
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  Future<void> deleteOne(${modelClass} m) async {
    try {
      isSaving.value = true;
      await service.delete(m.id);
      _info('${entityName} deleted');
      await loadPage(page.value);
    } catch (e) {
      _error('Failed to delete ${entityName}', e);
    } finally {
      isSaving.value = false;
    }
  }

  // ===== Relation options loaders =====
${singleLoaders}
${multiLoaders}

  // ===== Internals =====

  void _fillForm(${modelClass}? m) {
${fillFormLines}
${fillRelSingles}
${fillRelMultis}
  }

  void _clearForm() {
${clearFormLines}
${clearRelSingles}
${clearRelMultis}
  }

  ${modelClass} _buildModelFromForm() {
    return ${modelClass}(
${buildModelLines}
    );
  }

  Map<String, dynamic>? _tryParseJson(String s) {
    try { return json.decode(s) as Map<String, dynamic>; } catch (_) { return null; }
  }

  void _info(String msg) {
    if (!Get.isSnackbarOpen) {
      Get.snackbar('Success', msg, snackPosition: SnackPosition.BOTTOM, duration: const Duration(seconds: 2));
    }
  }

  void _error(String msg, Object e) {
    final detail = e.toString();
    if (!Get.isSnackbarOpen) {
      Get.snackbar('Error', '\$msg\\n\$detail', snackPosition: SnackPosition.BOTTOM, duration: const Duration(seconds: 4));
    }
  }
}

// ------- helpers -------
String cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
`;
}

// categorize field for controller form handling
function categorizeField(f, parsedEnums) {
  if (f.isRelationship) return 'rel';
  if (isEnumType(f.type, parsedEnums)) return 'enum';
  if (isBooleanType(f.type, parsedEnums)) return 'bool';
  if (isDateType(f.type, parsedEnums)) return normalizeJdlType(f.type) === 'localdate' ? 'date' : 'datetime';
  if (isNumericType(f.type, parsedEnums)) return 'number';
  const dart = jdlToDartType(f.type, parsedEnums);
  if (dart === 'Map<String, dynamic>') return 'json';
  return 'string';
}

module.exports = { generateEntityControllerTemplate };
