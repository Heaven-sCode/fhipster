const { camelToKebabCase } = require('../utils');

/**
 * Generates the content for a GetX service file.
 * @param {string} entityName - The name of the entity.
 * @param {string} microserviceName - The name of the microservice.
 * @param {string} apiHost - The base host for the API.
 * @returns {string} The Dart code for the service.
 */
function generateServiceTemplate(entityName, microserviceName, apiHost) {
    const modelClassName = `${entityName}Model`;
    const serviceClassName = `${entityName}Service`;
    const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    
    let pluralCamelCaseEndpoint = instanceName.endsWith('y') 
        ? `${instanceName.slice(0, -1)}ies` 
        : `${instanceName}s`;

    const endpointName = camelToKebabCase(pluralCamelCaseEndpoint);

    const baseUrl = `'${apiHost}/services/${microserviceName}/api'`;
    const searchUrl = `'${apiHost}/services/${microserviceName}/api/${endpointName}/_search'`;

    return `import 'package:get/get.dart';
import '../models/${instanceName}_model.dart';
import '../core/api_client.dart'; // Import the central ApiClient

class ${serviceClassName} extends GetxService {
  // Use the shared ApiClient instance.
  final ApiClient _apiClient = Get.find<ApiClient>();
  final String _baseUrl = ${baseUrl};
  final String _searchUrl = ${searchUrl};

  @override
  void onInit() {
    // Set the base URL for this service's requests.
    _apiClient.getConnect.httpClient.baseUrl = _baseUrl;
    super.onInit();
  }

  Future<${modelClassName}> create(${modelClassName} ${instanceName}) async {
    final response = await _apiClient.getConnect.post('/${endpointName}', ${instanceName}.toJson());
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  Future<${modelClassName}> update(${modelClassName} ${instanceName}) async {
    if (${instanceName}.id == null) {
      return Future.error("Cannot update a model without an ID.");
    }
    final response = await _apiClient.getConnect.put('/${endpointName}/\${${instanceName}.id}', ${instanceName}.toJson());
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  Future<${modelClassName}> partialUpdate(${modelClassName} ${instanceName}) async {
    if (${instanceName}.id == null) {
      return Future.error("Cannot partially update a model without an ID.");
    }
    final response = await _apiClient.getConnect.patch('/${endpointName}/\${${instanceName}.id}', ${instanceName}.toJson());
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  Future<${modelClassName}> find(int id) async {
    final response = await _apiClient.getConnect.get('/${endpointName}/\$id');
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return ${modelClassName}.fromJson(response.body);
  }

  Future<List<${modelClassName}>> query({Map<String, dynamic>? req}) async {
    final response = await _apiClient.getConnect.get('/${endpointName}', query: req);
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return (response.body as List).map((json) => ${modelClassName}.fromJson(json)).toList();
  }

  Future<void> delete(int id) async {
    final response = await _apiClient.getConnect.delete('/${endpointName}/\$id');
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
  }

  Future<List<${modelClassName}>> search({required Map<String, dynamic> req}) async {
    final response = await _apiClient.getConnect.get(_searchUrl, query: req);
    if (response.status.hasError) {
      return Future.error(response.statusText!);
    }
    return (response.body as List).map((json) => ${modelClassName}.fromJson(json)).toList();
  }
}
`;
}

module.exports = { generateServiceTemplate };
