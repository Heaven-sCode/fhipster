// generators/module_init_generator.js
// Emits lib/core/module_init.dart
// - Provides initialization function for parent apps to register module services
//
// Usage in parent app:
//   import 'package:my_module/core/module_init.dart';
//   ModuleInit.registerServices();

const { serviceFileName, controllerFileName } = require('../utils/naming');

function generateModuleInitTemplate(entities = []) {
  const serviceImports = entities.map(entity => `import '../services/${serviceFileName(entity, true)}';`).join('\n');
  const controllerImports = entities.map(entity => `import '../controllers/${controllerFileName(entity, true)}';`).join('\n');

  const serviceRegistrations = entities.map(entity => {
    const serviceClass = `${entity}ModuleService`;
    return `    // Register ${serviceClass}
    if (!Get.isRegistered<${serviceClass}>()) {
      Get.put(${serviceClass}(), permanent: true);
    }`;
  }).join('\n');

  const controllerRegistrations = entities.map(entity => {
    const controllerClass = `${entity}ModuleController`;
    return `    // Register ${controllerClass}
    if (!Get.isRegistered<${controllerClass}>()) {
      Get.put(${controllerClass}(), permanent: true);
    }`;
  }).join('\n');

  return `import 'package:get/get.dart';
import 'env/env.dart';
import 'api_client.dart';
import 'module_bridge.dart';
import 'preferences/column_preferences.dart';
${serviceImports ? serviceImports + '\n' : ''}${controllerImports ? controllerImports + '\n' : ''}

/// Module initialization utilities.
/// Call [registerServices] in your parent app to initialize the module's dependencies.
class ModuleInit {
  /// Registers the module's core services.
  /// Call this in your parent app's main() to initialize the module.
  ///
  /// Example:
  ///   void main() async {
  ///     // ... other initialization
  ///     ModuleInit.registerServices();
  ///     // Now you can use module controllers and views
  ///   }
  static void registerServices() {
    // Ensure Env is initialized
    try {
      Env.get();
    } catch (_) {
      throw Exception('Env must be initialized before registering module services. Call Env.initGenerated() and Env.setProfile() first.');
    }

    // Register ModuleApiClient for module HTTP communication
    if (!Get.isRegistered<ModuleApiClient>()) {
      Get.put(ModuleApiClient(), permanent: true);
    }

    // Register ModuleBridge for token management
    if (!Get.isRegistered<ModuleBridge>()) {
      Get.put(ModuleBridge(), permanent: true);
    }

    // Register ColumnPreferencesService for table views
    final columnPrefs = Get.put(ColumnPreferencesService(), permanent: true);
    columnPrefs.init();

${serviceRegistrations}

${controllerRegistrations}
  }

  /// Sets authentication tokens for the module.
  /// Call this after user login to provide tokens to the module.
  ///
  /// Example:
  ///   ModuleInit.setAuthTokens(
  ///     accessToken: 'token',
  ///     refreshToken: 'refresh',
  ///   );
  static void setAuthTokens({
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiry,
    DateTime? refreshTokenExpiry,
  }) {
    if (Get.isRegistered<ModuleBridge>()) {
      Get.find<ModuleBridge>().setAuthTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
        accessTokenExpiry: accessTokenExpiry,
        refreshTokenExpiry: refreshTokenExpiry,
      );
    }
  }

  /// Clears authentication tokens for the module.
  /// Call this on logout.
  static void clearAuthTokens() {
    if (Get.isRegistered<ModuleBridge>()) {
      Get.find<ModuleBridge>().clearAuthTokens();
    }
  }

  /// Checks if the module has valid authentication tokens.
  static bool get hasValidTokens {
    if (Get.isRegistered<ModuleBridge>()) {
      return Get.find<ModuleBridge>().hasValidTokens;
    }
    return false;
  }
}
`;
}

module.exports = { generateModuleInitTemplate };