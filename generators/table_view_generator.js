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
const { toFileName } = require('../utils/naming');

function generateTableViewTemplate(entityName, fields, allEntities = {}, options = {}) {
  const className = `${entityName}TableView`;
  const controllerClass = `${entityName}Controller`;
  const modelClass = `${entityName}Model`;
  const instance = lcFirst(entityName);
  const enableSQLite = !!options.enableSQLite;

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

  const childControllerImports = Array.from(new Set(childRelInfos.map((info) => `import '../controllers/${toFileName(info.childEntity)}_controller.dart';`))).join('\n');
  const childFormImports = Array.from(new Set(childRelInfos.map((info) => `import '../forms/${toFileName(info.childEntity)}_form.dart';`))).join('\n');

  // Build DataColumn list (headers)
  const dataColumns = fields.map(f => {
    const label = labelize(f.name);
    return `        const DataColumn(label: Text('${label}'))`;
  }).join(',\n');

  // Build cell renderers per field
  const cellExprs = fields.map(f => {
    const n = f.name;
    if (f.isRelationship) {
      const kind = (f.relationshipType || '').toLowerCase();
      if (kind === 'onetomany' || kind === 'manytomany') {
        return `Text(((m.${n}?.length) ?? 0).toString())`;
      }
      // single rel: show related id if present
      return `Text(m.${n}?.id?.toString() ?? '')`;
    } else {
      // primitive
      // DateTime-like
      // We cannot import type mapping here; rely on name heuristics & runtime type.
      // Safer: call .toString(), but prettify booleans and dates if possible.
      if (n.toLowerCase().includes('date') || n.toLowerCase().includes('time')) {
        return `Text(_formatTemporal(m.${n}))`;
      }
      return `Text(m.${n} == null ? '' : m.${n}.toString())`;
    }
  });

  const dataCells = cellExprs.map(expr => `          DataCell(${expr})`).join(',\n');

  // Details rows for "View" dialog
  const detailRows = fields.map(f => {
    const label = labelize(f.name);
    let valueExpr;
    if (f.isRelationship) {
      const kind = (f.relationshipType || '').toLowerCase();
      if (kind === 'onetomany' || kind === 'manytomany') {
        valueExpr = `((m.${f.name}?.length) ?? 0).toString()`;
        const childInfo = childRelMap[f.name];
        if (childInfo) {
          return `              _kvWithAction('${label}', ${valueExpr}, actionLabel: 'Create ${childInfo.childEntity}'.tr, onAction: () => _quickCreate${childInfo.childEntity}${cap(childInfo.fieldName)}(context, m)),`;
        }
      } else {
        valueExpr = `m.${f.name}?.id?.toString() ?? ''`;
      }
    } else if (f.name.toLowerCase().includes('date') || f.name.toLowerCase().includes('time')) {
    valueExpr = `_formatTemporal(m.${f.name})`;
    } else {
      valueExpr = `m.${f.name}?.toString() ?? ''`;
    }
    return `              _kv('${label}', ${valueExpr}),`;
  }).join('\n');

  const syncImport = enableSQLite ? "import '../core/sync/sync_service.dart';\n" : '';

  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/app_shell.dart';
import '../core/env/env.dart';
import '../controllers/${toFileName(entityName)}_controller.dart';
import '../models/${toFileName(entityName)}_model.dart';
import '../forms/${toFileName(entityName)}_form.dart';
import '../widgets/common/confirm_dialog.dart';
${childControllerImports ? childControllerImports + '\n' : ''}${childFormImports ? childFormImports + '\n' : ''}${syncImport}

class ${className} extends GetView<${controllerClass}> {
  const ${className}({super.key});

  String get _title => '${entityName}';

  @override
  Widget build(BuildContext context) {
    final env = Env.get();

    return AppShell(
      title: _title,
      body: Obx(() {
        final items = controller.items;
        final isLoading = controller.isLoading.value;
        final total = controller.total.value;
        final page = controller.page.value;
        final size = controller.size.value;

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
                  onPressed: () {
                    controller.beginCreate();
                    _openFormDialog(context, title: 'Create ${entityName}');
                  },
                  icon: const Icon(Icons.add),
                  label: Text('New'.tr),
                ),
                OutlinedButton.icon(
                  onPressed: isLoading ? null : () => controller.loadPage(page),
                  icon: const Icon(Icons.refresh),
                  label: Text('Refresh'.tr),
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
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Obx(() {
                          final rows = controller.items;
                          return DataTable(
                            headingRowHeight: 42,
                            dataRowMinHeight: 40,
                            dataRowMaxHeight: 56,
                            columns: const [
${dataColumns},
                              DataColumn(label: Text('Actions')),
                            ],
                            rows: rows.map((m) => DataRow(
                              cells: [
${dataCells},
                                DataCell(Row(
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
                                      onPressed: () {
                                        controller.beginEdit(m);
                                        _openFormDialog(context, title: 'Edit ${entityName}');
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
                                )),
                              ],
                            )).toList(),
                          );
                        }),
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

  void _openFormDialog(BuildContext context, {required String title}) {
    _showFormDialog(context, title: title, body: ${entityName}Form());
  }

  void _openChildFormDialog(BuildContext context, {required String title, required Widget body}) {
    _showFormDialog(context, title: title, body: body);
  }

  void _showFormDialog(BuildContext context, {required String title, required Widget body}) {
    Get.dialog(
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
                  onPressed: () => Get.back(),
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
${childRelInfos.map(info => `
  void _quickCreate${info.childEntity}${cap(info.fieldName)}(BuildContext context, ${modelClass} parent) {
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
      return;
    }
    if (!Get.isRegistered<${info.childController}>()) Get.put(${info.childController}());
    final ctrl = Get.find<${info.childController}>();
    ctrl.beginCreate();
    final existingIndex = ctrl.${info.childField}Options.indexWhere((e) => e.id == parent.id);
    if (existingIndex == -1) {
      ctrl.${info.childField}Options.add(parent);
      ctrl.${info.childField}.value = parent;
    } else {
      ctrl.${info.childField}.value = ctrl.${info.childField}Options[existingIndex];
    }
    Get.back();
    _openChildFormDialog(
      context,
      title: 'Create ${info.childEntity}'.tr,
      body: ${info.childForm}(),
    );
  }
`).join('\n')}
}

// Simple key-value row for view dialog
Widget _kv(String key, String value) {
  return _kvWithAction(key, value);
}

Widget _kvWithAction(String key, String value, {String? actionLabel, VoidCallback? onAction}) {
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
      ],
    ),
  );
}

String _formatTemporal(dynamic value) {
  if (value == null) return '';
  if (value is DateTime) return value.toIso8601String();
  return value.toString();
}
`;
}

module.exports = { generateTableViewTemplate };
