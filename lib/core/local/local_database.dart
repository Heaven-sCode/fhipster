// Requires sqflite (and sqflite_common_ffi_web for web builds).

import 'package:flutter/foundation.dart';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi_web/sqflite_ffi_web.dart';

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
    Future<void> configure(Database db) async {
      await db.execute('PRAGMA foreign_keys = ON');
    }

    Future<void> onCreate(Database db, int version) async {
      await _createTables(db);
    }

    if (kIsWeb) {
      final factory = databaseFactoryFfiWeb;
      return factory.openDatabase(
        'fhipster_cache.db',
        options: OpenDatabaseOptions(
          version: 1,
          onConfigure: configure,
          onCreate: onCreate,
        ),
      );
    }

    final dbDir = await getDatabasesPath();
    final dbPath = join(dbDir, 'fhipster_cache.db');
    return openDatabase(
      dbPath,
      version: 1,
      onConfigure: configure,
      onCreate: onCreate,
    );
  }

  Future<void> _createTables(Database db) async {
    for (final stmt in _createStatements) {
      await db.execute(stmt);
    }
  }

  Future<void> close() async {
    final db = _database;
    if (db != null) {
      await db.close();
      _database = null;
    }
  }

  static const List<String> _createStatements = [
      '''CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        remote_id TEXT UNIQUE,
        payload TEXT NOT NULL,
        server_updated_at TEXT,
        local_updated_at TEXT,
        dirty INTEGER NOT NULL DEFAULT 0
      )''',
      '''CREATE TABLE IF NOT EXISTS media_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        remote_id TEXT UNIQUE,
        payload TEXT NOT NULL,
        server_updated_at TEXT,
        local_updated_at TEXT,
        dirty INTEGER NOT NULL DEFAULT 0
      )'''
  ];
}
