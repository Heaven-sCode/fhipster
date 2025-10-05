// generators/form_generator.js
// Emits lib/forms/<entity>_form.dart
// - Stateless GetView form widget (GetX best practices)
// - Uses ResponsiveGrid for web/mobile friendly layout
// - Binds to <Entity>Controller TextEditingControllers & Rx fields
// - Handles primitives, enums, dates, numbers, booleans
// - Handles relationships:
//     * ManyToOne / OneToOne -> Dropdown of related options
//     * OneToMany / ManyToMany -> Multi-select chips
// - Validates required fields
// - Calls controller.submitForm() on Save

const {
  jdlToDartType,
  isBooleanType,
  isEnumType,
  isDateType,
  isNumericType,
} = require('../parser/type_mapping');
const { toFileName } = require('../utils/naming');

function lcFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function labelize(fieldName) {
  return String(fieldName)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase());
}

function wrapInGridCol(widgetExpr) {
  return `
                ResponsiveGridCol(
                  lg: 4,
                  md: 6,
                  xs: 12,
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: ${widgetExpr.trim()},
                  ),
                )`;
}

function generateFormTemplate(entityName, fields, parsedEnums = {}, options = {}) {
  const className = `${entityName}Form`;
  const controllerClass = `${entityName}Controller`;
  const instance = lcFirst(entityName);

  const tenantIsolation = options.tenantIsolation || {};
  const tenantEnabled = !!tenantIsolation.enabled && !!tenantIsolation.fieldName;
  const tenantFieldName = tenantIsolation.fieldName;

  const thisFileBase = toFileName(entityName); // e.g., UserProfile -> user_profile

  // Collect enum imports used in primitive fields
  const enumTypesUsed = Array.from(
    new Set(fields.filter(f => !f.isRelationship && parsedEnums?.[f.type]).map(f => f.type))
  );
  const enumImports = enumTypesUsed
    .map(e => `import '../enums/${toFileName(e)}_enum.dart';`)
    .join('\n');

  // Collect relationship model imports (for type args)
  const relTargets = Array.from(new Set(fields.filter(f => f.isRelationship).map(f => f.targetEntity)));
  const relModelImports = relTargets
    .map(t => `import '../models/${toFileName(t)}_model.dart';`)
    .join('\n');

  // Prepare widget builders for each field (skip 'id' and tenant field when isolation active)
  const formFields = fields.filter(f =>
    f.name !== 'id' &&
    !(tenantEnabled && f.name === tenantFieldName) &&
    !f.isAudit
  );

  const gridCols = formFields.map(f => {
    const n = f.name;
    const label = labelize(n);

    // Category selection
    const cat =
      f.isRelationship ? 'rel'
      : isEnumType(f.type, parsedEnums) ? 'enum'
      : isBooleanType(f.type, parsedEnums) ? 'bool'
      : isDateType(f.type, parsedEnums) ? 'date'
      : isNumericType(f.type, parsedEnums) ? 'number'
      : (jdlToDartType(f.type, parsedEnums) === 'Map<String, dynamic>' ? 'json' : 'string');

    let widgetExpr = '';

    if (cat === 'bool') {
      widgetExpr = `
            Obx(() => CheckboxListTile(
              title: Text('${label}'.tr),
              value: controller.${n}.value,
              onChanged: (v) => controller.${n}.value = v ?? false,
              controlAffinity: ListTileControlAffinity.leading,
            ))`;
      return wrapInGridCol(widgetExpr);
    }

    if (cat === 'enum') {
      // Use EnumType.values as the items source
      widgetExpr = `
            Obx(() => DropdownButtonFormField<${f.type}>(
              value: controller.${n}.value,
              items: ${f.type}.values.map((e) => DropdownMenuItem<${f.type}>(
                value: e,
                child: Text(e.toString().split('.').last),
              )).toList(),
              onChanged: (v) => controller.${n}.value = v,
              decoration: InputDecoration(labelText: '${label}'.tr),
              validator: ${f.required ? `(v) => v == null ? 'Please select ${label.toLowerCase()}'.tr : null` : `null`},
            ))`;
      return wrapInGridCol(widgetExpr);
    }

    if (cat === 'date') {
      widgetExpr = `
            FHipsterInputField(
              controller: controller.${n}Ctrl,
              label: '${label}'.tr,
              hint: 'YYYY-MM-DDTHH:MM:SSZ'.tr,
              keyboardType: TextInputType.datetime,
              validator: (v) {
                ${f.required ? `if (v == null || v.isEmpty) return 'Please enter ${label.toLowerCase()}'.tr;` : ''}
                if (v != null && v.isNotEmpty) {
                  try { DateTime.parse(v); } catch (_) { return 'Invalid date format'.tr; }
                }
                return null;
              },
            )`;
      return wrapInGridCol(widgetExpr);
    }

    if (cat === 'number') {
      const isInt = jdlToDartType(f.type, parsedEnums) === 'int';
      widgetExpr = `
            FHipsterInputField(
              controller: controller.${n}Ctrl,
              label: '${label}'.tr,
              hint: 'Enter ${label}'.tr,
              keyboardType: TextInputType.number,
              validator: (v) {
                ${f.required ? `if (v == null || v.isEmpty) return 'Please enter ${label.toLowerCase()}'.tr;` : ''}
                if (v != null && v.isNotEmpty) {
                  if (${isInt ? 'int.tryParse(v) == null' : 'double.tryParse(v) == null'}) {
                    return 'Please enter a valid number'.tr;
                  }
                }
                return null;
              },
            )`;
      return wrapInGridCol(widgetExpr);
    }

    if (cat === 'json') {
      widgetExpr = `
            FHipsterInputField(
              controller: controller.${n}Ctrl,
              label: '${label}'.tr,
              hint: '{ "key": "value" }'.tr,
              keyboardType: TextInputType.multiline,
              validator: (v) {
                ${f.required ? `if (v == null || v.isEmpty) return 'Please enter ${label.toLowerCase()}'.tr;` : ''}
                if (v != null && v.isNotEmpty) {
                  try { jsonDecode(v); } catch (_) { return 'Invalid JSON'.tr; }
                }
                return null;
              },
            )`;
      return wrapInGridCol(widgetExpr);
    }

    if (cat === 'rel') {
      const kind = (f.relationshipType || '').toLowerCase();
      const tModel = `${f.targetEntity}Model`;

      if (kind === 'manytoone' || kind === 'onetoone') {
        // Single relation: dropdown fed from <name>Options
        widgetExpr = `
            Obx(() {
              final loading = controller.${n}Loading.value;
              final options = controller.${n}Options;
              return DropdownButtonFormField<${tModel}>(
                value: controller.${n}.value,
                items: options.map((e) => DropdownMenuItem<${tModel}>(
                  value: e,
                  child: Text((e.id ?? '').toString()),
                )).toList(),
                onChanged: loading ? null : (v) => controller.${n}.value = v,
                decoration: InputDecoration(
                  labelText: '${label}'.tr,
                  suffixIcon: loading ? const Padding(
                    padding: EdgeInsets.all(8.0),
                    child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  ) : IconButton(
                    tooltip: 'Reload'.tr,
                    icon: const Icon(Icons.refresh),
                    onPressed: () => controller.load${cap(n)}Options(),
                  ),
                ),
                validator: ${f.required ? `(v) => v == null ? 'Please select ${label.toLowerCase()}'.tr : null` : `null`},
              );
            })`;
        return wrapInGridCol(widgetExpr);
      } else {
        // Multi relation: creation dialog should not allow selecting child records
        widgetExpr = `
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${label}'.tr, style: Theme.of(Get.context!).textTheme.bodyMedium),
                const SizedBox(height: 4),
                Text(
                  'Linked records are managed from the ${label.toLowerCase()} view.',
                  style: Theme.of(Get.context!).textTheme.bodySmall,
                ),
              ],
            )`;
        return wrapInGridCol(widgetExpr);
      }
    }

    // default string
    widgetExpr = `
            FHipsterInputField(
              controller: controller.${n}Ctrl,
              label: '${label}'.tr,
              hint: 'Enter ${label}'.tr,
              validator: ${f.required ? `(v) => (v == null || v.isEmpty) ? 'Please enter ${label.toLowerCase()}'.tr : null` : `null`},
            )`;
    return wrapInGridCol(widgetExpr);
  }).join(',\n');

  return `import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:responsive_grid/responsive_grid.dart';
import '../widgets/fhipster_input_field.dart';
import '../controllers/${thisFileBase}_controller.dart';
import '../models/${thisFileBase}_model.dart';
${enumImports ? enumImports + '\n' : ''}${relModelImports ? relModelImports + '\n' : ''}

/// ${entityName} form widget. Stateless GetView bound to ${controllerClass}.
class ${className} extends GetView<${controllerClass}> {
  ${className}({super.key});

  final _formKey = GlobalKey<FormState>();

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ResponsiveGridRow(
              children: [
${gridCols}
              ],
            ),
            const SizedBox(height: 20),
            Obx(() {
              final saving = controller.isSaving.value;
              return Row(
                children: [
                  FilledButton.icon(
                    onPressed: saving
                        ? null
                        : () async {
                            if (_formKey.currentState?.validate() ?? false) {
                              final ok = await controller.submitForm();
                              if (ok && (Get.isDialogOpen ?? false)) {
                                Get.back<bool>(result: true);
                              }
                            }
                          },
                    icon: saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.save),
                    label: Text(saving ? 'Saving'.tr : 'Save'.tr),
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    onPressed: saving ? null : () => controller.beginCreate(),
                    icon: const Icon(Icons.refresh),
                    label: Text('Reset'.tr),
                  ),
                ],
              );
            }),
          ],
        ),
      ),
    );
  }
}
`;
}

module.exports = { generateFormTemplate };
