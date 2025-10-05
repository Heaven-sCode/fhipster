function generateColumnPreferencesTemplate() {
  return `import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

class TableColumnDefinition {
  final String field;
  final String label;
  final bool isAudit;

  const TableColumnDefinition({
    required this.field,
    required this.label,
    this.isAudit = false,
  });
}

class ColumnPreferencesService extends GetxService {
  static const _storageKey = 'column_prefs';

  final GetStorage _storage = GetStorage();
  final RxMap<String, String> _tableLabels = <String, String>{}.obs;
  final RxMap<String, List<TableColumnDefinition>> _registry = <String, List<TableColumnDefinition>>{}.obs;
  final RxMap<String, List<String>> _hidden = <String, List<String>>{}.obs;

  Future<ColumnPreferencesService> init() async {
    final raw = _storage.read(_storageKey);
    if (raw is Map) {
      raw.forEach((key, value) {
        if (value is List) {
          _hidden[key] = value.map((e) => e.toString()).toList();
        }
      });
    }
    return this;
  }

  RxMap<String, List<TableColumnDefinition>> get registry => _registry;
  RxMap<String, List<String>> get hidden => _hidden;

  String tableLabel(String tableKey) => _tableLabels[tableKey] ?? tableKey;

  void register(String tableKey, String label, List<TableColumnDefinition> definitions) {
    _tableLabels[tableKey] = label;

    final newDefs = List<TableColumnDefinition>.from(definitions);
    final existing = _registry[tableKey];
    var definitionsChanged = true;
    if (existing != null && existing.length == newDefs.length) {
      definitionsChanged = false;
      for (var i = 0; i < existing.length; i++) {
        final oldDef = existing[i];
        final newDef = newDefs[i];
        if (oldDef.field != newDef.field ||
            oldDef.label != newDef.label ||
            oldDef.isAudit != newDef.isAudit) {
          definitionsChanged = true;
          break;
        }
      }
    }

    if (definitionsChanged) {
      _registry[tableKey] = newDefs;
      _registry.refresh();

      final currentHidden = List<String>.from(_hidden[tableKey] ?? const []);
      final validFields = newDefs.map((d) => d.field).toSet();
      currentHidden.removeWhere((field) => !validFields.contains(field));
      _hidden[tableKey] = currentHidden;
      _hidden.refresh();
      _persist();
    }
  }

  List<TableColumnDefinition> definitions(String tableKey) {
    return List<TableColumnDefinition>.from(_registry[tableKey] ?? const []);
  }

  List<TableColumnDefinition> visibleDefinitions(String tableKey) {
    final defs = definitions(tableKey);
    return defs.where((d) => isVisible(tableKey, d.field)).toList();
  }

  bool isVisible(String tableKey, String field) {
    final hiddenFields = _hidden[tableKey];
    if (hiddenFields == null) return true;
    return !hiddenFields.contains(field);
  }

  void setColumnVisible(String tableKey, String field, bool visible) {
    final current = List<String>.from(_hidden[tableKey] ?? const []);
    if (!visible) {
      if (!current.contains(field)) current.add(field);
    } else {
      current.remove(field);
    }
    _hidden[tableKey] = current;
    _hidden.refresh();
    _persist();
  }

  void reset(String tableKey) {
    if (_hidden.containsKey(tableKey)) {
      _hidden.remove(tableKey);
      _hidden.refresh();
      _persist();
    }
  }

  void _persist() {
    final raw = _hidden.map((key, value) => MapEntry(key, List<String>.from(value)));
    _storage.write(_storageKey, raw);
  }
}
`;
}

module.exports = { generateColumnPreferencesTemplate };
