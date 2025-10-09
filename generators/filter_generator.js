// generators/filter_generator.js
// Emits lib/widgets/<entity>_filter_drawer.dart
// - Drawer widget for JPA-style filters
// - Supports operations: equals, notEquals, greaterThan, lessThan, contains, etc.
// - Fields for primitives, dates, enums
// - Apply/Clear buttons

const { jdlToDartType, isBooleanType, isEnumType, isDateType, isNumericType, normalizeJdlType } = require('../parser/type_mapping');
const { toFileName } = require('../utils/naming');

function lcFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function labelize(fieldName) {
  return String(fieldName)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase());
}

function generateFilterDrawerTemplate(entityName, fields, parsedEnums = {}) {
  const className = `${entityName}FilterDrawer`;
  const modelClass = `${entityName}Model`;
  const instance = lcFirst(entityName);

  const enumTypesUsed = Array.from(new Set(fields.filter(f => !f.isRelationship && parsedEnums?.[f.type]).map(f => f.type)));
  const enumImports = enumTypesUsed.map(e => `import '../enums/${toFileName(e)}_enum.dart';`).join('\n');

  const filterableFields = fields.filter(f => !f.isRelationship && !f.isAudit && f.name !== 'id');

  const operations = [
    'equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanOrEqualTo', 'lessThanOrEqualTo',
    'contains', 'notContains', 'startsWith', 'endsWith', 'isNull', 'isNotNull'
  ];

  const operationLabels = {
    equals: 'Equals',
    notEquals: 'Not Equals',
    greaterThan: 'Greater Than',
    lessThan: 'Less Than',
    greaterThanOrEqualTo: 'Greater or Equal',
    lessThanOrEqualTo: 'Less or Equal',
    contains: 'Contains',
    notContains: 'Not Contains',
    startsWith: 'Starts With',
    endsWith: 'Ends With',
    isNull: 'Is Null',
    isNotNull: 'Is Not Null'
  };

  const criteriaList = filterableFields.map(f => {
    const n = f.name;
    const label = labelize(n);
    const cat = categorizeField(f, parsedEnums);
    let valueInput = '';
    if (cat === 'bool') {
      valueInput = `
                DropdownButtonFormField<bool>(
                  value: criterion.value as bool?,
                  items: const [
                    DropdownMenuItem(value: true, child: Text('True')),
                    DropdownMenuItem(value: false, child: Text('False')),
                  ],
                  onChanged: (v) => setState(() => criterion.value = v),
                  decoration: InputDecoration(labelText: 'Value'),
                )`;
    } else if (cat === 'enum') {
      valueInput = `
                DropdownButtonFormField<${f.type}>(
                  value: criterion.value as ${f.type}?,
                  items: ${f.type}.values.map((e) => DropdownMenuItem<${f.type}>(
                    value: e,
                    child: Text(e.toString().split('.').last),
                  )).toList(),
                  onChanged: (v) => setState(() => criterion.value = v),
                  decoration: InputDecoration(labelText: 'Value'),
                )`;
    } else if (cat === 'date' || cat === 'datetime') {
      valueInput = `
                TextFormField(
                  controller: criterion.controller,
                  decoration: InputDecoration(
                    labelText: 'Value (YYYY-MM-DD${cat === 'datetime' ? 'THH:MM:SS' : ''})',
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.calendar_today),
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now(),
                          firstDate: DateTime(1900),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) {
                          ${cat === 'datetime' ? `
                          final time = await showTimePicker(
                            context: context,
                            initialTime: TimeOfDay.now(),
                          );
                          if (time != null) {
                            final dt = DateTime(picked.year, picked.month, picked.day, time.hour, time.minute);
                            criterion.controller.text = dt.toIso8601String();
                          }` : `criterion.controller.text = picked.toIso8601String().split('T').first;`}
                        }
                      },
                    ),
                  ),
                  validator: (v) {
                    if (criterion.operation == 'isNull' || criterion.operation == 'isNotNull') return null;
                    if (v == null || v.isEmpty) return 'Required';
                    return null;
                  },
                )`;
    } else {
      valueInput = `
                TextFormField(
                  controller: criterion.controller,
                  decoration: InputDecoration(labelText: 'Value'),
                  validator: (v) {
                    if (criterion.operation == 'isNull' || criterion.operation == 'isNotNull') return null;
                    if (v == null || v.isEmpty) return 'Required';
                    return null;
                  },
                )`;
    }
    return `
            _FilterCriterion(
              field: '${n}',
              label: '${label}',
              operations: ${JSON.stringify(operations.filter(op => {
                if (cat === 'bool' && !['equals', 'notEquals', 'isNull', 'isNotNull'].includes(op)) return false;
                if ((cat === 'date' || cat === 'datetime') && ['contains', 'notContains', 'startsWith', 'endsWith'].includes(op)) return false;
                return true;
              }))},
              valueBuilder: (context, criterion, setState) => ${valueInput.trim()},
            ),`;
  }).join('\n');

  return `import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../models/${toFileName(entityName)}_model.dart';
${enumImports ? enumImports + '\n' : ''}

typedef FilterCallback = void Function(Map<String, Map<String, dynamic>> filters);

class ${className} extends StatefulWidget {
  final FilterCallback onApply;
  final Map<String, Map<String, dynamic>> initialFilters;

  const ${className}({
    super.key,
    required this.onApply,
    this.initialFilters = const {},
  });

  @override
  State<${className}> createState() => _${className}State();
}

class _${className}State extends State<${className}> {
  final List<_CriterionState> _criteria = [];

  @override
  void initState() {
    super.initState();
    // Load initial filters
    widget.initialFilters.forEach((field, ops) {
      ops.forEach((op, value) {
        _addCriterion(field: field, operation: op, value: value);
      });
    });
    if (_criteria.isEmpty) {
      _addCriterion();
    }
  }

  void _addCriterion({String? field, String? operation, dynamic value}) {
    setState(() {
      _criteria.add(_CriterionState(
        field: field ?? _availableFields.first,
        operation: operation ?? 'equals',
        value: value,
        controller: TextEditingController(text: value?.toString() ?? ''),
      ));
    });
  }

  void _removeCriterion(int index) {
    setState(() {
      _criteria[index].controller.dispose();
      _criteria.removeAt(index);
    });
  }

  void _applyFilters() {
    final filters = <String, Map<String, dynamic>>{};
    for (final crit in _criteria) {
      if (crit.operation == 'isNull' || crit.operation == 'isNotNull') {
        filters[crit.field] ??= {};
        filters[crit.field]![crit.operation] = true;
      } else if (crit.value != null || crit.controller.text.isNotEmpty) {
        final val = crit.value ?? crit.controller.text;
        filters[crit.field] ??= {};
        filters[crit.field]![crit.operation] = val;
      }
    }
    widget.onApply(filters);
    Navigator.of(context).pop();
  }

  void _clearFilters() {
    setState(() {
      for (final crit in _criteria) {
        crit.controller.clear();
        crit.value = null;
      }
      _criteria.clear();
      _addCriterion();
    });
    widget.onApply({});
  }

  List<String> get _availableFields => [${filterableFields.map(f => `'${f.name}'`).join(', ')}];

  @override
  Widget build(BuildContext context) {
    return Drawer(
      width: MediaQuery.of(context).size.width * 0.8,
      child: Column(
        children: [
          AppBar(
            title: Text('Filters'.tr),
            automaticallyImplyLeading: false,
            actions: [
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ..._criteria.asMap().entries.map((entry) {
                  final index = entry.key;
                  final crit = entry.value;
                  return _buildCriterionCard(index, crit);
                }),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _addCriterion,
                  icon: const Icon(Icons.add),
                  label: Text('Add Filter'.tr),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _clearFilters,
                    child: Text('Clear'.tr),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: FilledButton(
                    onPressed: _applyFilters,
                    child: Text('Apply'.tr),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCriterionCard(int index, _CriterionState crit) {
    final fieldSpec = _fieldSpecs.firstWhere((spec) => spec.field == crit.field, orElse: () => _fieldSpecs.first);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: crit.field,
                    items: _availableFields.map((f) => DropdownMenuItem(
                      value: f,
                      child: Text(_fieldLabels[f] ?? f),
                    )).toList(),
                    onChanged: (v) => setState(() => crit.field = v!),
                    decoration: InputDecoration(labelText: 'Field'),
                  ),
                ),
                if (_criteria.length > 1)
                  IconButton(
                    icon: const Icon(Icons.remove),
                    onPressed: () => _removeCriterion(index),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: crit.operation,
              items: fieldSpec.operations.map((op) => DropdownMenuItem(
                value: op,
                child: Text(_operationLabels[op] ?? op),
              )).toList(),
              onChanged: (v) => setState(() => crit.operation = v!),
              decoration: InputDecoration(labelText: 'Operation'),
            ),
            const SizedBox(height: 8),
            if (crit.operation != 'isNull' && crit.operation != 'isNotNull')
              fieldSpec.valueBuilder(context, crit, setState),
          ],
        ),
      ),
    );
  }
}

class _CriterionState {
  String field;
  String operation;
  dynamic value;
  TextEditingController controller;

  _CriterionState({
    required this.field,
    required this.operation,
    this.value,
    required this.controller,
  });
}

class _FilterCriterion {
  final String field;
  final String label;
  final List<String> operations;
  final Widget Function(BuildContext, _CriterionState, StateSetter) valueBuilder;

  _FilterCriterion({
    required this.field,
    required this.label,
    required this.operations,
    required this.valueBuilder,
  });
}

const _fieldLabels = {
${filterableFields.map(f => `  '${f.name}': '${labelize(f.name)}',`).join('\n')}
};

const _operationLabels = {
${Object.entries(operationLabels).map(([k, v]) => `  '${k}': '${v}',`).join('\n')}
};

final _fieldSpecs = [
${criteriaList}
];
`;
}

// categorize field for filter input
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

module.exports = { generateFilterDrawerTemplate };