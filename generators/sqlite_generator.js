const path = require('path');
const { toFileName } = require('../utils/naming');

const CORE_LOCAL_DAO_DIR = 'core/local/dao';

function tableName(entityName) {
  return toFileName(entityName);
}

function generateLocalDatabaseTemplate(entityNames = []) {
  const statements = entityNames.map(name => {
    const table = tableName(name);
    return `      '''CREATE TABLE IF NOT EXISTS ${table} (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        remote_id TEXT UNIQUE,\n        payload TEXT NOT NULL,\n        server_updated_at TEXT,\n        local_updated_at TEXT,\n        dirty INTEGER NOT NULL DEFAULT 0\n      )'''`;
  }).join(',\n');

  const createLoop = entityNames.length
    ? `    for (final stmt in _createStatements) {\n      await db.execute(stmt);\n    }`
    : "    // No entities defined; nothing to create.";

  return `// Requires sqflite and path_provider packages in pubspec.yaml.

import 'dart:io';

import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

/// Lightweight SQLite bootstrap used by the generated DAOs.
class LocalDatabase {
  LocalDatabase._();
  static final LocalDatabase instance = LocalDatabase._();

  Database? _database;

  Future<Database> get database async {
    final existing = _database;
    if (existing != null) return existing;
    _database = await _open();
    return _database!;
  }

  Future<Database> _open() async {
    final directory = await getApplicationDocumentsDirectory();
    final dbPath = join(directory.path, 'fhipster_cache.db');
    return openDatabase(
      dbPath,
      version: 1,
      onConfigure: (db) async {
        await db.execute('PRAGMA foreign_keys = ON');
      },
      onCreate: (db, version) async {
        await _createTables(db);
      },
    );
  }

  Future<void> _createTables(Database db) async {
${createLoop}
  }

  Future<void> close() async {
    final db = _database;
    if (db != null) {
      await db.close();
      _database = null;
    }
  }

  static const List<String> _createStatements = [
${statements}
  ];
}
`;
}

function generateDaoTemplate(entityName, { modelImportPath } = {}) {
  const className = `${entityName}Dao`;
  const modelClass = `${entityName}Model`;
  const table = tableName(entityName);
  const fileName = toFileName(entityName);

  const defaultModelsImportPath = path.posix.join('models', `${fileName}_model.dart`);
  const relativeModelImport = (modelImportPath
    ? modelImportPath
    : path.posix.relative(CORE_LOCAL_DAO_DIR, defaultModelsImportPath)
  ).replace(/\\/g, '/');

  return `import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../local_database.dart';
import '${relativeModelImport}';

/// Basic DAO for ${entityName}. Persists serialized payloads locally for offline caching.
class ${className} {
  ${className}({LocalDatabase? database}) : _database = database ?? LocalDatabase.instance;

  final LocalDatabase _database;
  static const _table = '${table}';

  Future<Database> get _db async => _database.database;

  Future<List<${modelClass}>> getAll() async {
    final rows = await (await _db).query(_table, orderBy: 'id DESC');
    return rows.map((row) => _decode(row)).whereType<${modelClass}>().toList();
  }

  Future<${modelClass}?> getByRemoteId(dynamic remoteId) async {
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

  Future<int> upsert(${modelClass} model, {String? remoteId, String? serverUpdatedAt, String? localUpdatedAt, bool markDirty = false}) async {
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

  Future<List<${modelClass}>> getDirty() async {
    final rows = await (await _db).query(
      _table,
      where: 'dirty = ?',
      whereArgs: [1],
    );
    return rows.map((row) => _decode(row)).whereType<${modelClass}>().toList();
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

  ${modelClass}? _decode(Map<String, Object?> row) {
    final payload = row['payload'];
    if (payload is! String) return null;
    try {
      final map = jsonDecode(payload) as Map<String, dynamic>;
      return ${modelClass}.fromJson(map);
    } catch (_) {
      return null;
    }
  }
}
`;
}

module.exports = { generateLocalDatabaseTemplate, generateDaoTemplate };
