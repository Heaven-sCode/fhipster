import 'package:get/get.dart';
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
  final RxMap<String, List<String>> _orders = <String, List<String>>{}.obs;
  final RxMap<String, String> _layouts = <String, String>{}.obs;

  Future<ColumnPreferencesService> init() async {
    final raw = _storage.read(_storageKey);
    if (raw is Map) {
      raw.forEach((key, value) {
        if (value is List) {
          _hidden[key] = value.map((e) => e.toString()).toList();
        } else if (value is Map) {
          final hidden = value['hidden'];
          final order = value['order'];
          final layout = value['layout'];
          if (hidden is List) {
            _hidden[key] = hidden.map((e) => e.toString()).toList();
          }
          if (order is List) {
            _orders[key] = order.map((e) => e.toString()).toList();
          }
          if (layout is String && layout.isNotEmpty) {
            _layouts[key] = layout;
          }
        }
      });
    }
    return this;
  }

  RxMap<String, List<TableColumnDefinition>> get registry => _registry;
  RxMap<String, List<String>> get hidden => _hidden;
  RxMap<String, List<String>> get orders => _orders;
  RxMap<String, String> get layouts => _layouts;

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

      final existingOrder = List<String>.from(_orders[tableKey] ?? const []);
      final ordered = <String>[];
      for (final field in existingOrder) {
        if (validFields.contains(field)) {
          ordered.add(field);
        }
      }
      for (final def in newDefs) {
        if (!ordered.contains(def.field)) {
          ordered.add(def.field);
        }
      }
      _orders[tableKey] = ordered;
      _orders.refresh();

      _persist();
    } else {
      if (!_orders.containsKey(tableKey)) {
        _orders[tableKey] = newDefs.map((d) => d.field).toList();
        _orders.refresh();
      }
      if (!_layouts.containsKey(tableKey)) {
        _layouts[tableKey] = _defaultLayout;
        _layouts.refresh();
      }
      _persist();
    }
  }

  List<TableColumnDefinition> definitions(String tableKey) {
    return List<TableColumnDefinition>.from(_registry[tableKey] ?? const []);
  }

  List<TableColumnDefinition> orderedDefinitions(String tableKey) {
    final defs = definitions(tableKey);
    final order = _orders[tableKey];
    if (order == null || order.isEmpty) {
      return defs;
    }
    final lookup = <String, TableColumnDefinition>{for (final def in defs) def.field: def};
    final ordered = <TableColumnDefinition>[];
    for (final field in order) {
      final def = lookup[field];
      if (def != null) ordered.add(def);
    }
    for (final def in defs) {
      if (!order.contains(def.field)) {
        ordered.add(def);
      }
    }
    return ordered;
  }

  List<TableColumnDefinition> visibleDefinitions(String tableKey) {
    final defs = orderedDefinitions(tableKey);
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

  void setColumnOrder(String tableKey, List<String> orderedFields) {
    final defs = definitions(tableKey);
    final valid = defs.map((d) => d.field).toSet();
    final sanitized = orderedFields.where((field) => valid.contains(field)).toList();
    for (final def in defs) {
      if (!sanitized.contains(def.field)) {
        sanitized.add(def.field);
      }
    }
    _orders[tableKey] = sanitized;
    _orders.refresh();
    _persist();
  }

  static const String _defaultLayout = 'table';

  String layoutMode(String tableKey) {
    return _layouts[tableKey] ?? _defaultLayout;
  }

  void setLayoutMode(String tableKey, String mode) {
    final normalized = (mode == 'cards') ? 'cards' : _defaultLayout;
    if (_layouts[tableKey] == normalized) return;
    _layouts[tableKey] = normalized;
    _layouts.refresh();
    _persist();
  }

  void reset(String tableKey) {
    if (_hidden.containsKey(tableKey)) {
      _hidden.remove(tableKey);
      _hidden.refresh();
    }
    if (_orders.containsKey(tableKey)) {
      _orders.remove(tableKey);
      _orders.refresh();
    }
    if (_layouts.containsKey(tableKey)) {
      _layouts.remove(tableKey);
      _layouts.refresh();
    }
    _persist();
  }

  void _persist() {
    final keys = <String>{
      ..._hidden.keys,
      ..._orders.keys,
      ..._layouts.keys,
    };
    final raw = <String, Map<String, dynamic>>{};
    for (final key in keys) {
      raw[key] = {
        'hidden': List<String>.from(_hidden[key] ?? const []),
        'order': List<String>.from(_orders[key] ?? const []),
        'layout': _layouts[key] ?? _defaultLayout,
      };
    }
    _storage.write(_storageKey, raw);
  }
}
