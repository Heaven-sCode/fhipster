const { toFileName, lcFirst, ucFirst } = require('../utils/naming');

function generateSyncServiceTemplate(entityNames = []) {
  const safeEntities = Array.isArray(entityNames) ? entityNames : [];
  const hasEntities = safeEntities.length > 0;

  const serviceImports = hasEntities
    ? safeEntities.map(name => `import '../../services/${toFileName(name)}_service.dart';`).join('\n')
    : '';
  const daoImports = hasEntities
    ? safeEntities.map(name => `import '../local/dao/${toFileName(name)}_dao.dart';`).join('\n')
    : '';

  const daoFields = hasEntities
    ? safeEntities.map(name => `  ${name}Dao? _${lcFirst(name)}Dao;`).join('\n')
    : '';

  const syncCalls = hasEntities
    ? safeEntities.map(name => `    await _sync${ucFirst(name)}();`).join('\n')
    : '    // TODO: implement sync logic\n    return;';

  const syncMethods = hasEntities
    ? safeEntities
        .map(name => {
          const className = ucFirst(name);
          const field = lcFirst(name);
          return `  Future<void> _sync${className}() async {
    if (!Get.isRegistered<${className}Service>()) Get.put(${className}Service());
    final service = Get.find<${className}Service>();
    final dao = _${field}Dao ??= ${className}Dao();
    try {
      final dirtyItems = await dao.getDirty();
      for (final local in dirtyItems) {
        try {
          if (local.id != null) {
            final updated = await service.update(local);
            await dao.upsert(updated, remoteId: updated.id?.toString(), updatedAt: DateTime.now().toIso8601String(), markDirty: false);
          } else {
            final created = await service.create(local);
            await dao.upsert(created, remoteId: created.id?.toString(), updatedAt: DateTime.now().toIso8601String(), markDirty: false);
          }
        } catch (e, st) {
          // ignore: avoid_print
          print('Failed to push dirty ${className}: $e');
          // ignore: avoid_print
          print(st);
        }
      }

      final remoteItems = await service.list();
      for (final item in remoteItems) {
        await dao.upsert(item, remoteId: item.id?.toString(), updatedAt: DateTime.now().toIso8601String(), markDirty: false);
      }
    } catch (e, st) {
      // ignore: avoid_print
      print('Failed to sync ${className}: $e');
      // ignore: avoid_print
      print(st);
    }
  }`;
        })
        .join('\n\n')
    : '';

  return `import 'dart:async';

import 'package:get/get.dart';

import '../connectivity/connectivity_service.dart';
import '../env/env.dart';
${serviceImports ? serviceImports + '\n' : ''}${daoImports ? daoImports + '\n' : ''}

/// Periodically runs background sync tasks when the device is online.
/// Handles pushing local dirty records and refreshing the local cache.
class SyncService extends GetxService {
  SyncService({ConnectivityService? connectivity})
      : _connectivity = connectivity ?? Get.find<ConnectivityService>();

  final ConnectivityService _connectivity;
  Timer? _timer;
${daoFields ? '\n' + daoFields + '\n' : ''}
  Duration get _interval => Env.get().syncInterval;

  @override
  void onInit() {
    super.onInit();
    _schedule();
    ever<bool>(_connectivity.isOnline, (online) {
      if (online) {
        _performSync();
        _resetTimer();
      }
    });
  }

  void _schedule() {
    _timer?.cancel();
    _timer = Timer.periodic(_interval, (_) async {
      if (_connectivity.isOnline.value) {
        await _performSync();
      }
    });
  }

  void _resetTimer() {
    _timer?.cancel();
    _schedule();
  }

  Future<void> _performSync() async {
${syncCalls}
  }

${syncMethods ? '\n' + syncMethods + '\n' : ''}
  @override
  void onClose() {
    _timer?.cancel();
    super.onClose();
  }
}
`;
}

module.exports = { generateSyncServiceTemplate };
