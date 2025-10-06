const path = require('path');
const { toFileName, lcFirst, ucFirst } = require('../utils/naming');

const CORE_SYNC_DIR = 'core/sync';

function relativeImport(fromDir, target) {
  return path.posix.relative(fromDir, target).replace(/\\/g, '/');
}

function generateSyncServiceTemplate(entityNames = []) {
  const safeEntities = Array.isArray(entityNames) ? entityNames : [];
  const hasEntities = safeEntities.length > 0;

  const syncDir = CORE_SYNC_DIR;
  const servicesDir = 'services';
  const daoDir = 'core/local/dao';

  const serviceImports = hasEntities
    ? safeEntities
        .map(name => `import '${relativeImport(syncDir, path.posix.join(servicesDir, `${toFileName(name)}_service.dart`))}';`)
        .join('\n')
    : '';
  const daoImports = hasEntities
    ? safeEntities
        .map(name => `import '${relativeImport(syncDir, path.posix.join(daoDir, `${toFileName(name)}_dao.dart`))}';`)
        .join('\n')
    : '';
  const apiClientImport = hasEntities
    ? `import '${relativeImport(syncDir, 'core/api_client.dart')}';\n`
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
          return `  Future<void> _sync${className}() async {\n    if (!Get.isRegistered<${className}Service>()) Get.put(${className}Service());\n    final service = Get.find<${className}Service>();\n    final dao = _${field}Dao ??= ${className}Dao();\n    try {\n      final dirtyItems = await dao.getDirty();\n      for (final local in dirtyItems) {\n        final remoteKey = local.id?.toString();\n        try {\n          final response = local.id != null\n              ? await service.update(local)\n              : await service.create(local);\n          final serverNow = DateTime.now().toIso8601String();\n          await dao.upsert(response, remoteId: response.id?.toString(), serverUpdatedAt: serverNow, markDirty: false);\n          final responseId = response.id?.toString() ?? remoteKey;\n          if (responseId != null) {\n            await dao.markCleanByRemoteId(responseId, serverUpdatedAt: serverNow);\n          }\n        } catch (e, st) {\n          if (e is ApiRequestException && e.isNetworkError) {\n            rethrow;\n          }\n          // ignore: avoid_print\n          print('Failed to push dirty ${className}: $e');\n          // ignore: avoid_print\n          print(st);\n        }\n      }\n\n      final remoteItems = await service.list();\n      for (final item in remoteItems) {\n        final serverNow = DateTime.now().toIso8601String();\n        await dao.upsert(item, remoteId: item.id?.toString(), serverUpdatedAt: serverNow, markDirty: false);\n      }\n    } catch (e, st) {\n      if (e is ApiRequestException && e.isNetworkError) {\n        // ignore: avoid_print\n        print('Skipped ${className} sync (offline): ' + e.message);\n      } else {\n        // ignore: avoid_print\n        print('Failed to sync ${className}: $e');\n        // ignore: avoid_print\n        print(st);\n      }\n    }\n  }`;
        })
        .join('\n\n')
    : '';

  return `import 'dart:async';

import 'package:get/get.dart';

import '../connectivity/connectivity_service.dart';
import '../env/env.dart';
${apiClientImport}${serviceImports ? serviceImports + '\n' : ''}${daoImports ? daoImports + '\n' : ''}

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

  Future<void> syncNow() async {
    try {
      await _performSync();
    } catch (e, st) {
      // ignore: avoid_print
      print('Manual sync failed: $e');
      // ignore: avoid_print
      print(st);
    }
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
