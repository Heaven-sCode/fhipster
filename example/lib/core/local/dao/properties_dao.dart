import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../local_database.dart';
import '../../models/properties_model.dart';

/// Basic DAO for Properties. Persists serialized payloads locally for offline caching.
class PropertiesDao {
  PropertiesDao({LocalDatabase? database}) : _database = database ?? LocalDatabase.instance;

  final LocalDatabase _database;
  static const _table = 'properties';

  Future<Database> get _db async => _database.database;

  Future<List<PropertiesModel>> getAll() async {
    final rows = await (await _db).query(_table, orderBy: 'id DESC');
    return rows.map((row) => _decode(row)).whereType<PropertiesModel>().toList();
  }

  Future<PropertiesModel?> getByRemoteId(dynamic remoteId) async {
    final key = remoteId?.toString();
    final rows = await (await _db).query(
      _table,
      where: 'remote_id = ?',
      whereArgs: [key],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _decode(rows.first);
  }

  Future<int> upsert(PropertiesModel model, {String? remoteId, String? serverUpdatedAt, String? localUpdatedAt, bool markDirty = false}) async {
    final db = await _db;
    final id = remoteId ?? model.id?.toString();
    final payload = jsonEncode(model.toJson());
    final now = DateTime.now().toIso8601String();
    final data = <String, Object?>{
      'remote_id': id,
      'payload': payload,
      'server_updated_at': serverUpdatedAt ?? now,
      'dirty': markDirty ? 1 : 0,
    };
    if (markDirty) {
      data['local_updated_at'] = localUpdatedAt ?? now;
    } else if (localUpdatedAt != null) {
      data['local_updated_at'] = localUpdatedAt;
    }
    return db.insert(
      _table,
      data,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<int> deleteByRemoteId(dynamic remoteId) async {
    final key = remoteId?.toString();
    return (await _db).delete(
      _table,
      where: 'remote_id = ?',
      whereArgs: [key],
    );
  }

  Future<List<PropertiesModel>> getDirty() async {
    final rows = await (await _db).query(
      _table,
      where: 'dirty = ?',
      whereArgs: [1],
    );
    return rows.map((row) => _decode(row)).whereType<PropertiesModel>().toList();
  }

  Future<void> markCleanByRemoteId(dynamic remoteId, {String? serverUpdatedAt}) async {
    final key = remoteId?.toString();
    await (await _db).update(
      _table,
      {
        'dirty': 0,
        if (serverUpdatedAt != null) 'server_updated_at': serverUpdatedAt,
        'local_updated_at': null,
      },
      where: 'remote_id = ?',
      whereArgs: [key],
    );
  }

  PropertiesModel? _decode(Map<String, Object?> row) {
    final payload = row['payload'];
    if (payload is! String) return null;
    try {
      final map = jsonDecode(payload) as Map<String, dynamic>;
      return PropertiesModel.fromJson(map);
    } catch (_) {
      return null;
    }
  }
}
