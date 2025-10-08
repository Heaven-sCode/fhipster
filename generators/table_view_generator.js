// generators/table_view_generator.js
// Emits lib/views/<entity>_table_view.dart
// - Web/mobile friendly table page inside AppShell
// - Search input (debounced via controller), refresh, create
// - Horizontal scrolling DataTable
// - Pagination controls (prev/next + page size)
// - View / Edit / Delete dialogs
//
// Usage:
//   writeFile(..., generateTableViewTemplate('Order', fields, allEntities), ...)

function lcFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function labelize(fieldName) {
  return String(fieldName)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
function sanitizeEnumMember(name) {
  let s = String(name || '').trim();
  if (!s) s = 'UNKNOWN';
  s = s.replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(s)) s = '_' + s;
  return s;
}
function enumTokenLabel(token) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  const spaced = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ');
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
function escapeDartString(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
const { toFileName } = require('../utils/naming');
const { navDestinationsString } = require('./helpers/nav_destinations');
const { jdlToDartType } = require('../parser/type_mapping');

function generateTableViewTemplate(entityName, fields, allEntities = {}, options = {}) {
  const className = `${entityName}TableView`;
  const controllerClass = `${entityName}Controller`;
  const modelClass = `${entityName}Model`;
  const instance = lcFirst(entityName);
  const enableSQLite = !!options.enableSQLite;
  const parsedEnums = options.enums || {};
  const fieldTypes = fields.map((f) => ({
    field: f,
    dartType: jdlToDartType(f.type, parsedEnums),
    isEnum: !!parsedEnums[f.type],
  }));
  const enumTypesUsed = Array.from(new Set(fieldTypes.filter(info => info.isEnum).map(info => info.field.type)));
  const usesTemporalField = fieldTypes.some((info) => info.dartType === 'DateTime');

  // Determine child creation shortcuts for one-to-many relationships
  const childRelInfos = (fields || [])
    .filter((f) => f && f.isRelationship && String(f.relationshipType || '').toLowerCase() === 'onetomany')
    .map((f) => {
      const childEntity = f.targetEntity;
      if (!childEntity) return null;
      const childFields = allEntities?.[childEntity] || [];
      const backRef = childFields.find((cf) => cf && cf.isRelationship && String(cf.relationshipType || '').toLowerCase() === 'manytoone' && cf.targetEntity === entityName);
      if (!backRef) return null;
      return {
        fieldName: f.name,
        label: labelize(f.name),
        childEntity,
        childField: backRef.name,
        childController: `${childEntity}Controller`,
        childForm: `${childEntity}Form`,
      };
    })
    .filter(Boolean);
  const childRelMap = {};
  childRelInfos.forEach((info) => { childRelMap[info.fieldName] = info; });

  const baseFieldNames = new Set((fields || []).map((f) => f.name));
  const auditFieldNames = ['id', 'createdBy', 'createdDate', 'createdAt', 'createdOn', 'updatedBy', 'updatedDate', 'updatedAt', 'updatedOn', 'lastModifiedBy', 'lastModifiedDate'];
  auditFieldNames.forEach((name) => baseFieldNames.add(name));

  const fieldLabelEntries = Array.from(baseFieldNames).sort()
    .map((name) => `    '${name}': '${escapeDartString(labelize(name))}',`)
    .join('\n');


  // Helper list (per relationship) for injecting parent option into child controller caches
  const ensureHelperInfos = childRelInfos;

  const childShowInfos = (fields || [])
    .filter((f) => f && f.isRelationship)
    .map((f) => {
      if (!f.targetEntity) return null;
      const relationshipType = String(f.relationshipType || '').toLowerCase();
      return {
        fieldName: f.name,
        childEntity: f.targetEntity,
        label: labelize(f.name),
        relationshipType,
      };
    })
    .filter((info) => info && ['onetomany', 'manytomany', 'onetoone'].includes(info.relationshipType));

  const childFieldLabelInfos = Array.from(new Set(childShowInfos.map((info) => info.childEntity).filter(Boolean)))
    .map((childEntity) => {
      const childFields = allEntities?.[childEntity] || [];
      const fieldNames = new Set((childFields || []).map((f) => f.name));
      auditFieldNames.forEach((name) => fieldNames.add(name));
      const entries = Array.from(fieldNames).sort()
        .map((name) => `    '${name}': '${escapeDartString(labelize(name))}',`)
        .join('\n');
      const mapName = `_${lcFirst(childEntity)}FieldLabels`;
      return {
        entity: childEntity,
        mapName,
        mapString: `  static const Map<String, String> ${mapName} = {\n${entries}\n  };`,
      };
    });
  const childFieldLabelMapByEntity = {};
  childFieldLabelInfos.forEach((info) => {
    childFieldLabelMapByEntity[info.entity] = info.mapName;
  });

  const childControllerImports = Array.from(new Set(childRelInfos.map((info) => `import '../controllers/${toFileName(info.childEntity)}_controller.dart';`))).join('\n');
  const childFormImports = Array.from(new Set(childRelInfos.map((info) => `import '../forms/${toFileName(info.childEntity)}_form.dart';`))).join('\n');
  const childServiceImports = Array.from(new Set(childRelInfos.map((info) => `import '../services/${toFileName(info.childEntity)}_service.dart';`))).join('\n');
  const childModelImports = Array.from(new Set(childRelInfos.map((info) => `import '../models/${toFileName(info.childEntity)}_model.dart';`))).join('\n');

  // Build DataColumn list (headers)
  const displayFieldInfos = fieldTypes.filter((info) => {
    const f = info.field;
    if (f.isRelationship) {
      const kind = (f.relationshipType || '').toLowerCase();
      if (kind === 'onetomany' || kind === 'manytomany') {
        return false;
      }
    }
    return true;
  });

  const fieldDefinitionEntries = displayFieldInfos.map((info) => {
    const label = escapeDartString(labelize(info.field.name));
    const isAudit = info.field.isAudit ? 'true' : 'false';
    return `    TableColumnDefinition(field: '${info.field.name}', label: '${label}', isAudit: ${isAudit})`;
  }).join(',\n');

  const childDefinitionEntries = childShowInfos.map((info) => {
    const label = escapeDartString(info.label);
    return `    TableColumnDefinition(field: '${info.fieldName}Actions', label: 'Show ${label}')`;
  }).join(',\n');

  const definitionEntries = [fieldDefinitionEntries, childDefinitionEntries]
    .filter((s) => s && s.length > 0)
    .join(',\n');

  const columnDefinitionList = definitionEntries;

  const fieldSpecEntries = displayFieldInfos.map((info) => {
    const f = info.field;
    const n = f.name;
    const isAudit = f.isAudit ? 'true' : 'false';
    const label = escapeDartString(labelize(n));
    let cellExpr;
    if (f.isRelationship) {
      const kind = (f.relationshipType || '').toLowerCase();
      if (kind === 'onetomany' || kind === 'manytomany') {
        cellExpr = `Text(((m.${n}?.length) ?? 0).toString())`;
      } else {
        cellExpr = `Text(m.${n}?.id?.toString() ?? '')`;
      }
    } else if (info.isEnum) {
      cellExpr = `Text(_enumLabel(m.${n}))`;
    } else if (info.dartType === 'DateTime') {
      cellExpr = `Text(_formatTemporal(m.${n}))`;
    } else {
      cellExpr = `Text(m.${n} == null ? '' : m.${n}.toString())`;
    }
    return `    _ColumnSpec<${modelClass}>(\n      field: '${n}',\n      label: '${label}',\n      isAudit: ${isAudit},\n      cellBuilder: (context, m) => DataCell(${cellExpr}),\n    )`;
  }).join(',\n');

  const childSpecEntries = childShowInfos.map((info) => {
    const childLabel = escapeDartString(info.label);
    const dialogTitle = escapeDartString(labelize(info.childEntity || info.label));
    const quickInfo = info.relationshipType === 'onetomany' ? childRelMap[info.fieldName] : null;
    const itemsExpr = info.relationshipType === 'onetoone'
      ? `(m.${info.fieldName} == null ? const [] : [m.${info.fieldName}])`
      : `(m.${info.fieldName} ?? const [])`;
    const childFieldLabelsMap = childFieldLabelMapByEntity[info.childEntity] || '_fieldLabels';
    const viewHandler = quickInfo
      ? `_handleShow${quickInfo.childEntity}${cap(quickInfo.fieldName)}(context, m)`
      : `_openChildListDialog(context, title: '${dialogTitle}'.tr, items: ${itemsExpr}, fieldLabels: ${childFieldLabelsMap})`;
    const addButton = quickInfo
      ? `          const SizedBox(width: 8),\n          FilledButton.icon(\n            onPressed: () => _quickCreate${quickInfo.childEntity}${cap(quickInfo.fieldName)}(context, m),\n            icon: const Icon(Icons.add),\n            label: Text('Add ${escapeDartString(labelize(quickInfo.childEntity))}'.tr),\n          ),\n`
      : '';
    return `    _ColumnSpec<${modelClass}>(\n      field: '${info.fieldName}Actions',\n      label: 'Show ${childLabel}',\n      cellBuilder: (context, m) => DataCell(Row(\n        mainAxisSize: MainAxisSize.min,\n        children: [\n          FilledButton.icon(\n            onPressed: () => ${viewHandler},\n            icon: const Icon(Icons.visibility),\n            label: Text('Show ${childLabel}'.tr),\n          ),\n${addButton}        ],\n      )),\n    )`;
  }).join(',\n');

  const columnSpecEntries = [fieldSpecEntries, childSpecEntries]
    .filter((s) => s && s.length > 0)
    .join(',\n');

  const detailRows = fieldTypes.map((info) => {
    const f = info.field;
    const label = labelize(f.name);
    let valueExpr;
    if (f.isRelationship) {
      const kind = (f.relationshipType || '').toLowerCase();
      if (kind === 'onetomany' || kind === 'manytomany') {
        valueExpr = `((m.${f.name}?.length) ?? 0).toString()`;
        const childInfo = childRelMap[f.name];
        if (childInfo) {
          return `              _kvWithAction('${label}', ${valueExpr}, actionLabel: 'Create ${childInfo.childEntity}'.tr, onAction: () => _quickCreate${childInfo.childEntity}${cap(childInfo.fieldName)}(context, m), secondaryActionLabel: 'View ${childInfo.childEntity}'.tr, onSecondaryAction: () => _openChildListDialog(\n                context,\n                title: '${childInfo.childEntity}'.tr,\n                items: m.${f.name},\n                fieldLabels: ${childFieldLabelMapByEntity[childInfo.childEntity] || '_fieldLabels'},\n                onRefresh: () => _fetch${childInfo.childEntity}${cap(childInfo.fieldName)}(m),\n                onEdit: (item) async {\n                  if (item is ${childInfo.childEntity}Model) {\n                    return await _editChild${childInfo.childEntity}${cap(childInfo.fieldName)}(context, m, item);\n                  }\n                  return false;\n                },\n                onDelete: (item) async {\n                  if (item is ${childInfo.childEntity}Model) {\n                    return await _deleteChild${childInfo.childEntity}${cap(childInfo.fieldName)}(context, m, item);\n                  }\n                  return false;\n                },\n              )),`;
        }
      } else {
        valueExpr = `m.${f.name}?.id?.toString() ?? ''`;
      }
    } else if (info.isEnum) {
      valueExpr = `_enumLabel(m.${f.name})`;
    } else if (info.dartType === 'DateTime') {
      valueExpr = `_formatTemporal(m.${f.name})`;
    } else {
      valueExpr = `m.${f.name}?.toString() ?? ''`;
    }
    return `              _kv('${label}', ${valueExpr}),`;
  }).join('\n');

  const syncImport = enableSQLite ? "import '../core/sync/sync_service.dart';\n" : '';
  const intlImport = usesTemporalField ? "import 'package:intl/intl.dart';\n" : '';

  const enumImports = enumTypesUsed
    .map(e => `import '../enums/${toFileName(e)}_enum.dart';`)
    .join('\n');

  const enumLabelMaps = enumTypesUsed.map((enumName) => {
    const values = parsedEnums[enumName] || [];
    const seen = new Set();
    const entries = values
      .map((original) => {
        const sanitized = sanitizeEnumMember(original);
        if (seen.has(sanitized)) return null;
        seen.add(sanitized);
        const label = enumTokenLabel(original).replace(/'/g, "\\'");
        return `    ${enumName}.${sanitized}: '${label}',`;
      })
      .filter(Boolean)
      .join('\n');
    return `const Map<${enumName}, String> _${lcFirst(enumName)}Labels = {\n${entries}\n  };`;
  }).join('\n\n');

  const enumTokenLabelEntries = [];
  enumTypesUsed.forEach((enumName) => {
    (parsedEnums[enumName] || []).forEach((token) => {
      const key = token;
      const label = enumTokenLabel(token).replace(/'/g, "\\'");
      enumTokenLabelEntries.push(`  '${key}': '${label}',`);
    });
  });
  const enumTokenLabelMap = enumTokenLabelEntries.length
    ? `const Map<String, String> _enumTokenLabels = {\n${Array.from(new Set(enumTokenLabelEntries)).join('\n')}\n};`
    : 'const Map<String, String> _enumTokenLabels = {};';

 const childFetchHelpers = childRelInfos.map((info) => {
    const childLabel = labelize(info.childEntity).replace(/'/g, "\\'");
    return `  Future<List<${info.childEntity}Model>> _fetch${info.childEntity}${cap(info.fieldName)}(${modelClass} parent) async {
    final id = parent.id;
    if (id == null) return parent.${info.fieldName} ?? const [];
    if (!Get.isRegistered<${info.childEntity}Service>()) Get.put(${info.childEntity}Service());
    final svc = Get.find<${info.childEntity}Service>();
    try {
      return await svc.list(filters: {'${info.childField}Id': {'equals': id}});
    } catch (e) {
      if (!Get.isSnackbarOpen) {
        Get.snackbar('Error'.tr, 'Failed to load ${childLabel}'.tr);
      }
      return parent.${info.fieldName} ?? const [];
    }
  }

  Future<void> _handleShow${info.childEntity}${cap(info.fieldName)}(BuildContext context, ${modelClass} parent) async {
    final fetched = await _fetch${info.childEntity}${cap(info.fieldName)}(parent);
    await _openChildListDialog(
      context,
      title: '${childLabel}'.tr,
      items: fetched,
      fieldLabels: ${childFieldLabelMapByEntity[info.childEntity] || '_fieldLabels'},
      onRefresh: () => _fetch${info.childEntity}${cap(info.fieldName)}(parent),
      onEdit: (item) async {
        if (item is ${info.childEntity}Model) {
          return await _editChild${info.childEntity}${cap(info.fieldName)}(context, parent, item);
        }
        return false;
      },
      onDelete: (item) async {
        if (item is ${info.childEntity}Model) {
          return await _deleteChild${info.childEntity}${cap(info.fieldName)}(context, parent, item);
        }
        return false;
      },
    );
  }`;
  }).join('\n\n');

  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
${intlImport}
import '../core/app_shell.dart';
import '../core/env/env.dart';
import '../core/routes.dart';
import '../core/preferences/column_preferences.dart';
import '../controllers/${toFileName(entityName)}_controller.dart';
import '../models/${toFileName(entityName)}_model.dart';
import '../forms/${toFileName(entityName)}_form.dart';
import '../widgets/common/confirm_dialog.dart';
${enumImports ? enumImports + '\n' : ''}
${childControllerImports ? childControllerImports + '\n' : ''}${childFormImports ? childFormImports + '\n' : ''}${childServiceImports ? childServiceImports + '\n' : ''}${childModelImports ? childModelImports + '\n' : ''}${syncImport}

class ${className} extends GetView<${controllerClass}> {
  const ${className}({super.key});

  static const String _tableKey = '${toFileName(entityName)}';
  static const String _tableLabel = '${escapeDartString(labelize(entityName))}';
  static final List<TableColumnDefinition> _columnDefinitions = [
${columnDefinitionList}
  ];
  static const Map<String, String> _fieldLabels = {
${fieldLabelEntries}
  };
${childFieldLabelInfos.length ? childFieldLabelInfos.map((info) => info.mapString).join('\n') : ''}
  static bool _columnsRegistered = false;

  List<_ColumnSpec<${modelClass}>> _buildAllColumnSpecs() {
    return [
${columnSpecEntries}
    ];
  }

  _ColumnSpec<${modelClass}>? _findSpec(String field, List<_ColumnSpec<${modelClass}>> specs) {
    for (final spec in specs) {
      if (spec.field == field) return spec;
    }
    return null;
  }

  static void registerColumns(ColumnPreferencesService prefs, {bool force = false}) {
    if (!force && _columnsRegistered) return;
    prefs.register(_tableKey, _tableLabel, _columnDefinitions);
    _columnsRegistered = true;
  }

  String get _title => '${entityName}';

  @override
  Widget build(BuildContext context) {
    final env = Env.get();
    final prefs = Get.find<ColumnPreferencesService>();
    if (!_columnsRegistered) {
      if (prefs.registry.containsKey(_tableKey)) {
        _columnsRegistered = true;
      } else {
        final binding = WidgetsBinding.instance;
        if (binding != null) {
          binding.addPostFrameCallback((_) => registerColumns(prefs));
        } else {
          registerColumns(prefs);
        }
      }
    }

    return AppShell(
      title: _title,
      body: Obx(() {
        final items = controller.items;
        final isLoading = controller.isLoading.value;
        final total = controller.total.value;
        final page = controller.page.value;
        final size = controller.size.value;
        prefs.layouts[_tableKey];
        final layoutMode = prefs.layoutMode(_tableKey);
        prefs.hidden[_tableKey];
        var visibleDefs = prefs.visibleDefinitions(_tableKey);
        if (visibleDefs.isEmpty) {
          visibleDefs = _columnDefinitions;
        }
        final allSpecs = _buildAllColumnSpecs();
        var specs = visibleDefs
            .map((def) => _findSpec(def.field, allSpecs))
            .whereType<_ColumnSpec<${modelClass}>>()
            .toList();
        if (specs.isEmpty) {
          specs = List<_ColumnSpec<${modelClass}>>.from(allSpecs);
        }

        final sortEntries = controller.sort;
        String? activeSortField;
        bool isSortDescending = false;
        if (sortEntries.isNotEmpty) {
          final parts = sortEntries.first.split(',');
          if (parts.isNotEmpty) {
            activeSortField = parts.first;
          }
          if (parts.length > 1) {
            isSortDescending = parts[1].toLowerCase() == 'desc';
          }
        }

        int? sortColumnIndex;
        bool sortAscending = !isSortDescending;
        if (activeSortField != null) {
          final index = specs.indexWhere((spec) => spec.field == activeSortField);
          if (index != -1) {
            sortColumnIndex = index;
          }
        }

        return Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
            // Toolbar: search + actions
            Wrap(
              spacing: 12,
              runSpacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                // Search box
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: TextField(
                    onChanged: controller.applySearch,
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search),
                      hintText: 'Search'.tr,
                      isDense: true,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                ),
                FilledButton.icon(
                  onPressed: () async {
                    controller.beginCreate();
                    await _openFormDialog(context, title: 'Create ${entityName}');
                  },
                  icon: const Icon(Icons.add),
                  label: Text('New'.tr),
                ),
                OutlinedButton.icon(
                  onPressed: isLoading ? null : () => controller.loadPage(page),
                  icon: const Icon(Icons.refresh),
                  label: Text('Refresh'.tr),
                ),
                ToggleButtons(
                  borderRadius: const BorderRadius.all(Radius.circular(8)),
                  constraints: const BoxConstraints(minHeight: 36, minWidth: 40),
                  isSelected: [
                    layoutMode == 'table',
                    layoutMode == 'cards',
                  ],
                  onPressed: (index) {
                    prefs.setLayoutMode(_tableKey, index == 0 ? 'table' : 'cards');
                  },
                  children: const [
                    Icon(Icons.table_chart),
                    Icon(Icons.view_agenda_outlined),
                  ],
                ),
                if (isLoading) const Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Table
            Expanded(
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    Expanded(
                      child: layoutMode == 'table'
                          ? SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                          child: DataTable(
                                sortColumnIndex: sortColumnIndex,
                                sortAscending: sortAscending,
                                headingRowHeight: 42,
                                dataRowMinHeight: 40,
                                dataRowMaxHeight: 56,
                                columns: [
                                  for (var i = 0; i < specs.length; i++)
                                    DataColumn(
                                      label: _buildSortLabel(context, controller, specs[i].field, specs[i].label, activeSortField, isSortDescending),
                                      onSort: (_, __) => _toggleSort(controller, specs[i].field),
                                    ),
                                  DataColumn(label: Text('Actions'.tr)),
                                ],
                                rows: items.asMap().entries.map((entry) {
                                  final index = entry.key;
                                  final m = entry.value;
                                  final cells = specs
                                      .map((spec) => spec.cellBuilder(context, m))
                                      .toList();
                                  cells.add(DataCell(_buildRowActions(context, m)));
                                  return DataRow(
                                    color: index.isEven
                                        ? MaterialStateProperty.all(Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.2))
                                        : null,
                                    cells: cells,
                                  );
                                }).toList(),
                              ),
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: items.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final model = items[index];
                                final detailTiles = <Widget>[];
                                for (final spec in specs) {
                                  final cell = spec.cellBuilder(context, model);
                                  final valueWidget = cell.child;
                                  if (_isValueWidgetEmpty(valueWidget)) continue;
                                  detailTiles.add(
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 12),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          SizedBox(
                                            width: 160,
                                            child: Text(
                                              spec.label,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .bodyMedium
                                                  ?.copyWith(fontWeight: FontWeight.w600),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(child: valueWidget),
                                        ],
                                      ),
                                    ),
                                  );
                                }
                                return Card(
                                  elevation: 0,
                                  clipBehavior: Clip.antiAlias,
                                  color: Theme.of(context).colorScheme.secondaryContainer.withOpacity(
                                        Theme.of(context).brightness == Brightness.dark ? 0.3 : 0.7,
                                      ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        ...detailTiles,
                                        const SizedBox(height: 8),
                                        Align(
                                          alignment: Alignment.centerRight,
                                          child: _buildRowActions(context, model),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),

// Pagination bar
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.4),
                        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
                      ),
                      child: Row(
                        children: [
                          Text('Rows per page:'.tr),
                          const SizedBox(width: 8),
                          DropdownButton<int>(
                            value: size,
                            items: env.pageSizeOptions
                                .map((e) => DropdownMenuItem<int>(value: e, child: Text(e.toString())))
                                .toList(),
                            onChanged: (v) {
                              if (v != null) controller.changePageSize(v);
                            },
                          ),
                          const Spacer(),
                          Obx(() {
                            final p = controller.page.value;
                            final s = controller.size.value;
                            final t = controller.total.value;
                            final start = t == 0 ? 0 : (p * s) + 1;
                            final end = ((p + 1) * s).clamp(0, t);
                            return Text('\$start–\$end of \$t');
                          }),
                          IconButton(
                            tooltip: 'Previous'.tr,
                            icon: const Icon(Icons.chevron_left),
                            onPressed: page > 0 && !isLoading ? () => controller.loadPage(page - 1) : null,
                          ),
                          IconButton(
                            tooltip: 'Next'.tr,
                            icon: const Icon(Icons.chevron_right),
                            onPressed: ((page + 1) * size) < total && !isLoading
                                ? () => controller.loadPage(page + 1)
                                : null,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
              ],
            ),
          ],
        );
      }),
    );
  }

  // --------- dialogs ---------

  Widget _buildRowActions(BuildContext context, ${modelClass} m) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: 'View'.tr,
          icon: const Icon(Icons.visibility),
          onPressed: () => _openViewDialog(context, m),
        ),
        IconButton(
          tooltip: 'Edit'.tr,
          icon: const Icon(Icons.edit),
          onPressed: () async {
            controller.beginEdit(m);
            await _openFormDialog(context, title: 'Edit ${entityName}');
          },
        ),
        IconButton(
          tooltip: 'Delete'.tr,
          icon: const Icon(Icons.delete_outline),
          onPressed: () async {
            final ok = await showConfirmDialog(
              context,
              title: 'Delete',
              message: 'Are you sure?'.tr,
            );
            if (ok == true) {
              await controller.deleteOne(m);
            }
          },
        ),
      ],
    );
  }

  Widget _buildSortLabel(BuildContext context, ${controllerClass} controller, String field, String label, String? activeField, bool isDescending) {
    final isActive = activeField == field;
    final theme = Theme.of(context);
    final color = isActive ? theme.colorScheme.primary : null;
    IconData icon;
    if (!isActive) {
      icon = Icons.unfold_more;
    } else {
      icon = isDescending ? Icons.arrow_downward : Icons.arrow_upward;
    }
    return InkWell(
      borderRadius: const BorderRadius.all(Radius.circular(6)),
      onTap: () => _toggleSort(controller, field),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: isActive
                ? theme.textTheme.titleSmall?.copyWith(color: color, fontWeight: FontWeight.w600)
                : theme.textTheme.titleSmall,
          ),
          const SizedBox(width: 4),
          Icon(icon, size: 16, color: color ?? theme.iconTheme.color),
        ],
      ),
    );
  }

  void _toggleSort(${controllerClass} controller, String field) {
    final current = controller.sort.toList();
    final defaultSort = Env.get().defaultSort;
    if (current.isNotEmpty) {
      final first = current.first;
      final parts = first.split(',');
      final currentField = parts.isNotEmpty ? parts.first : '';
      final currentDir = parts.length > 1 ? parts[1].toLowerCase() : 'asc';

      if (currentField == field) {
        if (currentDir == 'asc') {
          controller.changeSort(['$field,desc']);
        } else {
          controller.changeSort(defaultSort.isNotEmpty ? List<String>.from(defaultSort) : <String>[]);
        }
        return;
      }
    }
    controller.changeSort(['$field,asc']);
  }

  Future<void> _openChildListDialog(
    BuildContext context, {
    required String title,
    Iterable<dynamic>? items,
    Map<String, String>? fieldLabels,
    Future<List<dynamic>> Function()? onRefresh,
    Future<bool> Function(dynamic item)? onEdit,
    Future<bool> Function(dynamic item)? onDelete,
  }) async {
    var childItems = (items ?? const <dynamic>[]).toList();
    final effectiveLabels = fieldLabels ?? _fieldLabels;

    Future<void> refreshItems(StateSetter setState) async {
      if (onRefresh == null) return;
      final updated = await onRefresh();
      if (updated != null) {
        setState(() {
          childItems = List<dynamic>.from(updated);
        });
      }
    }

    await Get.dialog(
      Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 920, maxHeight: 720),
          child: StatefulBuilder(
            builder: (context, setState) {
              final hasItems = childItems.isNotEmpty;
              return Scaffold(
                appBar: AppBar(
                  title: Text(title),
                  automaticallyImplyLeading: false,
                  actions: [
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Get.back<void>(),
                    ),
                  ],
                ),
                body: hasItems
                    ? ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        itemCount: childItems.length,
                        itemBuilder: (context, index) {
                          final item = childItems[index];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: _childItemCard(
                              item,
                              fieldLabels: effectiveLabels,
                              onEdit: onEdit == null
                                  ? null
                                  : (value) async {
                                      final changed = await onEdit(value);
                                      if (changed == true) {
                                        await refreshItems(setState);
                                      }
                                      return changed ?? false;
                                    },
                              onDelete: onDelete == null
                                  ? null
                                  : (value) async {
                                      final changed = await onDelete(value);
                                      if (changed == true) {
                                        await refreshItems(setState);
                                      }
                                      return changed ?? false;
                                    },
                            ),
                          );
                        },
                      )
                    : Center(child: Text('No records found'.tr)),
              );
            },
          ),
        ),
      ),
    );
  }

  Future<bool?> _openFormDialog(BuildContext context, {required String title}) {
    return _showFormDialog(context, title: title, body: ${entityName}Form());
  }

  Future<bool?> _openChildFormDialog(BuildContext context, {required String title, required Widget body}) {
    return _showFormDialog(context, title: title, body: body);
  }

  Future<bool?> _showFormDialog(BuildContext context, {required String title, required Widget body}) {
    return Get.dialog(
      Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900, maxHeight: 700),
          child: Scaffold(
            appBar: AppBar(
              title: Text(title),
              automaticallyImplyLeading: false,
              actions: [
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Get.back<void>(),
                )
              ],
            ),
            body: Padding(
              padding: const EdgeInsets.all(8.0),
              child: body,
            ),
          ),
        ),
      ),
      barrierDismissible: false,
    );
  }

  void _openViewDialog(BuildContext context, ${modelClass} m) {
${enableSQLite ? "    if (Get.isRegistered<SyncService>()) {\n      Get.find<SyncService>().syncNow().catchError((_) {});\n    }\n" : ''}
    Get.dialog(
      Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720, maxHeight: 640),
          child: Scaffold(
            appBar: AppBar(
              title: Text('View ${entityName}'),
              automaticallyImplyLeading: false,
              actions: [
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Get.back(),
                )
              ],
            ),
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
${detailRows}
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
${childFetchHelpers ? '\n' + childFetchHelpers + '\n' : ''}
${ensureHelperInfos.map(info => `
  ${modelClass} _ensure${info.childEntity}${cap(info.fieldName)}ParentOption(${info.childController} ctrl, ${modelClass} parent) {
    final index = ctrl.${info.childField}Options.indexWhere((e) => e.id == parent.id);
    if (index == -1) {
      ctrl.${info.childField}Options.add(parent);
      return parent;
    }
    return ctrl.${info.childField}Options[index];
  }
`).join('\n')}

${childRelInfos.map(info => `
  Future<bool> _editChild${info.childEntity}${cap(info.fieldName)}(BuildContext context, ${modelClass} parent, ${info.childEntity}Model child) async {
    if (!Get.isRegistered<${info.childController}>()) {
      Get.put(${info.childController}(), permanent: true);
    }
    final ctrl = Get.find<${info.childController}>();
    final parentOption = _ensure${info.childEntity}${cap(info.fieldName)}ParentOption(ctrl, parent);
    ctrl.beginEdit(child);
    ctrl.${info.childField}.value = parentOption;
    final saved = await _openChildFormDialog(
      context,
      title: 'Edit ${info.childEntity}'.tr,
      body: ${info.childForm}(),
    );
    if (saved == true) {
      await ctrl.loadPage(ctrl.page.value);
      await controller.loadPage(controller.page.value);
      return true;
    }
    return false;
  }

  Future<bool> _deleteChild${info.childEntity}${cap(info.fieldName)}(BuildContext context, ${modelClass} parent, ${info.childEntity}Model child) async {
    if ((child.id ?? null) == null) return false;
    final ok = await showConfirmDialog(
      context,
      title: 'Delete',
      message: 'Are you sure?'.tr,
    );
    if (ok != true) return false;
    if (!Get.isRegistered<${info.childController}>()) {
      Get.put(${info.childController}(), permanent: true);
    }
    final ctrl = Get.find<${info.childController}>();
    await ctrl.deleteOne(child);
    await ctrl.loadPage(ctrl.page.value);
    await controller.loadPage(controller.page.value);
    return true;
  }

  Future<bool> _quickCreate${info.childEntity}${cap(info.fieldName)}(BuildContext context, ${modelClass} parent) async {
    if ((parent.id ?? null) == null) {
      Get.snackbar(
        'Error'.tr,
        'error.saveParentFirst'.trParams({
          'parent': '${labelize(entityName)}',
          'child': '${labelize(info.childEntity)}',
        }),
        snackPosition: SnackPosition.BOTTOM,
        duration: const Duration(seconds: 3),
      );
      return false;
    }
    if (!Get.isRegistered<${info.childController}>()) {
      Get.put(${info.childController}(), permanent: true);
    }
    final ctrl = Get.find<${info.childController}>();
    ctrl.beginCreate();
    final parentOption = _ensure${info.childEntity}${cap(info.fieldName)}ParentOption(ctrl, parent);
    ctrl.${info.childField}.value = parentOption;
    final saved = await _openChildFormDialog(
      context,
      title: 'Create ${info.childEntity}'.tr,
      body: ${info.childForm}(),
    );
    if (saved == true) {
      await ctrl.loadPage(ctrl.page.value);
      await controller.loadPage(controller.page.value);
      return true;
    }
    return false;
  }
`).join('\n')}
}

String _humanizeKeyLabel(String key) {
  if (key.isEmpty) return '';
  if (key.toLowerCase() == 'id') return 'ID';
  var label = key
      .replaceAllMapped(RegExp(r'\$\{([^}]*)\}'), (match) => match.group(1) ?? '')
      .replaceAllMapped(RegExp(r'([A-Za-z])\$(\d+)([A-Za-z])'), (match) {
        final before = match.group(1) ?? '';
        final token = match.group(2);
        final after = match.group(3) ?? '';
        if (token == '1' || token == '2') {
          return before + 's' + after;
        }
        return before + after;
      })
      .replaceAllMapped(RegExp(r'\$([A-Za-z])'), (match) => match.group(1) ?? '')
      .replaceAllMapped(RegExp(r'\$([0-9]+)'), (match) {
        final token = match.group(1);
        if (token == '1' || token == '2') {
          return 's';
        }
        return '';
      })
      .replaceAll(RegExp(r'[{}]+'), '')
      .replaceAll(RegExp(r'[._]+'), ' ');
  label = label.replaceAllMapped(RegExp(r'([a-z0-9])([A-Z])'), (match) {
    final a = match.group(1) ?? '';
    final b = match.group(2) ?? '';
    return '$a $b';
  });
  label = label.replaceAllMapped(RegExp(r'([A-Za-z])([0-9])'), (match) {
    final a = match.group(1) ?? '';
    final b = match.group(2) ?? '';
    return '$a $b';
  });
  label = label.replaceAllMapped(RegExp(r'([0-9])([A-Za-z])'), (match) {
    final a = match.group(1) ?? '';
    final b = match.group(2) ?? '';
    return '$a $b';
  });
  label = label.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (label.isEmpty) return _humanizeEnumToken(key);
  return label
      .split(RegExp(r'\s+'))
      .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1).toLowerCase())
      .join(' ');
}

Widget _childItemCard(
  dynamic item, {
  required Map<String, String> fieldLabels,
  Future<bool> Function(dynamic item)? onEdit,
  Future<bool> Function(dynamic item)? onDelete,
}) {
  if (item == null) {
    return const SizedBox.shrink();
  }

  Map<String, dynamic>? data;
  if (item is Map<String, dynamic>) {
    data = Map<String, dynamic>.from(item);
  } else {
    try {
      final dynamic json = (item as dynamic).toJson?.call();
      if (json is Map<String, dynamic>) {
        data = Map<String, dynamic>.from(json);
      }
    } catch (_) {
      data = null;
    }
  }

  data ??= {'Value': item};

  final entries = data.entries
      .where((entry) {
        final value = entry.value;
        if (value == null) return false;
        if (value is Map || value is Iterable) return false;
        final str = value is DateTime ? _formatTemporal(value) : value.toString();
        return str.isNotEmpty;
      })
      .take(8)
      .toList();

  if (entries.isEmpty) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: SelectableText(item.toString()),
      ),
    );
  }

  final theme = Theme.of(Get.context!);
  final cardColor = theme.colorScheme.surfaceVariant.withOpacity(theme.brightness == Brightness.dark ? 0.25 : 0.7);
  final titleEntry = entries.firstWhere(
    (e) {
      final key = e.key.toLowerCase();
      return key == 'title' || key == 'name' || key == 'displayname';
    },
    orElse: () => MapEntry('', ''),
  );

  return Card(
    elevation: 3,
    color: cardColor,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (titleEntry.key.isNotEmpty) ...[
            Text(
              titleEntry.value is DateTime ? _formatTemporal(titleEntry.value) : titleEntry.value.toString(),
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
          ],
          ...entries.where((entry) => entry.key != titleEntry.key).map<Widget>((entry) {
            final value = entry.value is DateTime ? _formatTemporal(entry.value) : entry.value.toString();
            final label = fieldLabels[entry.key] ?? _humanizeKeyLabel(entry.key);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 160,
                    child: Text(
                      (label.isEmpty ? entry.key : label),
                      style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: SelectableText(
                      value,
                      style: theme.textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            );
          }),
          if (onEdit != null || onDelete != null) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              children: [
                if (onEdit != null)
                  FilledButton.tonalIcon(
                    onPressed: () async => await onEdit(item),
                    icon: const Icon(Icons.edit),
                    label: Text('Edit'.tr),
                  ),
                if (onDelete != null)
                  OutlinedButton.icon(
                    onPressed: () async => await onDelete(item),
                    icon: const Icon(Icons.delete_outline),
                    label: Text('Delete'.tr),
                  ),
              ],
            ),
          ],
        ],
      ),
    ),
  );
}

bool _isValueWidgetEmpty(Widget? widget) {
  if (widget == null) return true;

  if (widget is Text) {
    final data = widget.data;
    if (data != null && data.trim().isEmpty) return true;
  } else if (widget is SelectableText) {
    final data = widget.data;
    if (data != null && data.trim().isEmpty) return true;
  } else if (widget is SizedBox) {
    final child = widget.child;
    if (child != null) {
      return _isValueWidgetEmpty(child);
    }
    if ((widget.height ?? 0) == 0 && (widget.width ?? 0) == 0) {
      return true;
    }
  } else if (widget is Padding) {
    return _isValueWidgetEmpty(widget.child);
  }
  return false;
}

// Simple key-value row for view dialog
Widget _kv(String key, String value) {
  return _kvWithAction(key, value);
}

Widget _kvWithAction(
  String key,
  String value, {
  String? actionLabel,
  VoidCallback? onAction,
  String? secondaryActionLabel,
  VoidCallback? onSecondaryAction,
}) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 200,
          child: Text(key, style: Get.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: SelectableText(value),
        ),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(width: 16),
          FilledButton.icon(
            onPressed: onAction,
            icon: const Icon(Icons.add),
            label: Text(actionLabel),
          ),
        ],
        if (secondaryActionLabel != null && onSecondaryAction != null) ...[
          const SizedBox(width: 16),
          FilledButton.icon(
            onPressed: onSecondaryAction,
            icon: const Icon(Icons.visibility),
            label: Text(secondaryActionLabel),
          ),
        ],
      ],
    ),
  );
}

${usesTemporalField
    ? `String _formatTemporal(dynamic value) {
  if (value == null) return '';
  DateTime? parsed;
  if (value is DateTime) {
    parsed = value;
  } else if (value is String) {
    parsed = DateTime.tryParse(value);
  } else if (value is num) {
    if (value >= 1000000000000) {
      parsed = DateTime.fromMillisecondsSinceEpoch(value.toInt(), isUtc: true);
    } else if (value >= 1000000000) {
      parsed = DateTime.fromMillisecondsSinceEpoch((value * 1000).toInt(), isUtc: true);
    }
  }
  if (parsed != null) {
    final local = parsed.isUtc ? parsed.toLocal() : parsed;
    final hasTime = local.hour != 0 || local.minute != 0 || local.second != 0 || local.millisecond != 0 || local.microsecond != 0;
    final locale = Get.locale?.toString();
    final formatter = hasTime ? DateFormat.yMMMEd(locale).add_jm() : DateFormat.yMMMEd(locale);
    return formatter.format(local);
  }
  return value.toString();
}`
    : `String _formatTemporal(dynamic value) {
  if (value == null) return '';
  return value.toString();
}`}
${enumLabelMaps ? '\n' + enumLabelMaps + '\n' : ''}
${enumTokenLabelMap}\n
String _enumLabel(Object? value) {
  if (value == null) return '';
${enumTypesUsed.map(enumName => `  if (value is ${enumName}) {
    return _${lcFirst(enumName)}Labels[value] ?? _enumTokenLabels[value.toString().split('.').last] ?? _humanizeEnumToken(value.toString().split('.').last);
  }`).join('\n')}
  if (value is Enum) {
    final token = value.toString().split('.').last;
    return _enumTokenLabels[token] ?? _humanizeEnumToken(token);
  }
  final raw = value.toString();
  final token = raw.contains('.') ? raw.split('.').last : raw;
  return _enumTokenLabels[token] ?? _humanizeEnumToken(token);
}

class _ColumnSpec<T> {
  final String field;
  final String label;
  final bool isAudit;
  final DataCell Function(BuildContext context, T model) cellBuilder;

  _ColumnSpec({
    required this.field,
    required this.label,
    required this.cellBuilder,
    this.isAudit = false,
  });

  TableColumnDefinition get definition => TableColumnDefinition(
        field: field,
        label: label,
        isAudit: isAudit,
      );
}

String _humanizeEnumToken(String token) {
  if (token.isEmpty) return '';
  final spaced = token
      .replaceAll(RegExp(r'([a-z0-9])([A-Z])'), r'$1 $2')
      .replaceAll(RegExp(r'[_-]+'), ' ')
      .trim();
  if (spaced.isEmpty) return '';
  final parts = spaced.split(RegExp('\\\\s+'));
  return parts
      .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1).toLowerCase())
      .join(' ');
}
`;
}

module.exports = { generateTableViewTemplate };
