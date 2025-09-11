/**
 * Generates the content for a Dart DataTable2 View file using GetX state management.
 * @param {string} entityName - The name of the entity.
 * @param {Array<Object>} fields - The fields of the entity.
 * @returns {string} The Dart code for the table view.
 */
function generateTableViewTemplate(entityName, fields) {
    const modelClassName = `${entityName}Model`;
    const serviceClassName = `${entityName}Service`;
    const viewClassName = `${entityName}TableView`;
    const controllerClassName = `${entityName}TableViewController`;
    const dataSourceClassName = `${entityName}DataSource`;
    const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);

    const sortableFields = fields
        .filter(f => !f.isRelationship && f.type !== 'TextBlob' && f.name !== 'id');

    const sortableFieldNames = sortableFields.map(f => `'${f.name}'`).join(', ');

    const tableColumns = sortableFields
        .map(f => {
            const labelText = f.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return `
      DataColumn2(
        label: Text('${labelText}'.tr),
        size: ColumnSize.L,
        onSort: (columnIndex, ascending) => controller.sort(columnIndex, ascending),
      )`;
        }).join(',\n');

    const dataCells = sortableFields
        .map(f => {
            return `DataCell(Text(item.${f.name}?.toString() ?? ''))`;
        }).join(',\n          ');

    return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:data_table_2/data_table_2.dart';
import '../models/${instanceName}_model.dart';
import '../services/${instanceName}_service.dart';
import 'dart:async';

// The controller is responsible for managing the search and sorting state.
class ${controllerClassName} extends GetxController {
  final _searchQuery = ''.obs;
  String get searchQuery => _searchQuery.value;

  final int _rowsPerPage = 20;
  int get rowsPerPage => _rowsPerPage;

  // State for sorting
  final sortColumnIndex = Rxn<int>();
  final sortAscending = true.obs;
  final List<String> sortableFields = [${sortableFieldNames}];

  // A key to force-refresh the DataTableSource
  final tableKey = UniqueKey().obs;

  void onSearchChanged(String query) {
    if (_searchQuery.value != query) {
      _searchQuery.value = query;
      // Change the key to signal the DataTableSource to refresh
      tableKey.value = UniqueKey();
    }
  }

  void sort(int columnIndex, bool ascending) {
    sortColumnIndex.value = columnIndex;
    sortAscending.value = ascending;
    // Change the key to signal the DataTableSource to refresh
    tableKey.value = UniqueKey();
  }
}

// The data source handles the fetching and presentation of data for the table.
class ${dataSourceClassName} extends AsyncDataTableSource {
  final ${serviceClassName} _service = Get.find<${serviceClassName}>();
  final ${controllerClassName} _controller = Get.find<${controllerClassName}>();
  
  String _searchQuery = '';
  
  ${dataSourceClassName}() {
    _searchQuery = _controller.searchQuery;
  }

  @override
  Future<AsyncRowsResponse> getRows(int startIndex, int count) async {
    try {
      final pageIndex = startIndex ~/ count;
      final Map<String, dynamic> req = {
        'page': pageIndex,
        'size': count,
      };

      if (_searchQuery.isNotEmpty) {
        req['keyword.contains'] = _searchQuery;
      }

      // Add sorting to the request if a sort column is selected
      if (_controller.sortColumnIndex.value != null) {
        final sortField = _controller.sortableFields[_controller.sortColumnIndex.value!];
        final sortDirection = _controller.sortAscending.value ? 'asc' : 'desc';
        req['sort'] = '\${sortField},\${sortDirection}';
      }

      final responseData = await _service.query(req: req);
      
      // Mock total count. In a real app, extract this from the 'X-Total-Count' header.
      final totalRecords = responseData.length + (pageIndex > 0 ? 20 : 0);

      var rows = responseData.map((item) {
        return DataRow(
          cells: [
            ${dataCells}
          ],
        );
      }).toList();

      return AsyncRowsResponse(totalRecords, rows);
    } catch (e) {
      Get.snackbar('Error'.tr, 'Failed to fetch data: \${e.toString()}'.tr, snackPosition: SnackPosition.BOTTOM);
      return AsyncRowsResponse(0, []);
    }
  }
}

// The view is a stateless widget that builds the UI.
class ${viewClassName} extends StatelessWidget {
  const ${viewClassName}({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(${controllerClassName}());

    return Scaffold(
      appBar: AppBar(
        title: Text('${entityName} List'.tr),
      ),
      body: Column(
        children: [
          _buildSearchField(controller),
          Expanded(
            child: _buildDataTable(controller),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchField(${controllerClassName} controller) {
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: TextField(
        onChanged: controller.onSearchChanged,
        decoration: InputDecoration(
          labelText: 'Search'.tr,
          hintText: 'Enter keywords...'.tr,
          prefixIcon: Icon(Icons.search),
          border: OutlineInputBorder(),
        ),
      ),
    );
  }

  Widget _buildDataTable(${controllerClassName} controller) {
    return Obx(
      () => PaginatedDataTable2(
        key: controller.tableKey.value, // Re-creates the source when the key changes
        sortColumnIndex: controller.sortColumnIndex.value,
        sortAscending: controller.sortAscending.value,
        columns: [
          ${tableColumns}
        ],
        source: ${dataSourceClassName}(),
        rowsPerPage: controller.rowsPerPage,
        showCheckboxColumn: false,
        minWidth: 800, // Provides a minimum width for horizontal scrolling
        columnSpacing: 12,
        horizontalMargin: 12,
      ),
    );
  }
}
`;
}

module.exports = { generateTableViewTemplate };
