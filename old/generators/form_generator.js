const { jdlToDartType } = require('../parser');

/**
 * Generates the content for a Dart GetX form file.
 * @param {string} entityName - The name of the entity.
 * @param {Array<Object>} fields - The fields of the entity.
 * @param {object} parsedEnums - The object of all parsed enums.
 * @returns {string} The Dart code for the form.
 */
function generateFormTemplate(entityName, fields, parsedEnums) {
    const modelClassName = `${entityName}Model`;
    const formClassName = `${entityName}Form`;
    const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    
    const formFieldsList = fields.filter(f => f.name !== 'id');

    const controllerDeclarations = formFieldsList.map(f => {
        const dartType = jdlToDartType(f.type, parsedEnums);
        const fieldName = f.name;
        if (f.isRelationship) return ''; 
        else if (dartType === 'bool') return `  late bool _${fieldName}Value;`;
        else if (parsedEnums[f.type]) return `  ${f.type}? _${fieldName}Value;`;
        return `  late final TextEditingController _${fieldName}Controller;`;
    }).filter(line => line.length > 0).join('\n');

    const controllerInitializations = formFieldsList.map(f => {
        const dartType = jdlToDartType(f.type, parsedEnums);
        const fieldName = f.name;
        if (f.isRelationship) return '';
        else if (dartType === 'bool') return `    _${fieldName}Value = widget.initialData?.${fieldName} ?? false;`;
        else if (parsedEnums[f.type]) return `    _${fieldName}Value = widget.initialData?.${fieldName};`;
        else if (dartType === 'DateTime') return `    _${fieldName}Controller = TextEditingController(text: widget.initialData?.${fieldName}?.toIso8601String() ?? '');`;
        return `    _${fieldName}Controller = TextEditingController(text: widget.initialData?.${fieldName}?.toString() ?? '');`;
    }).filter(line => line.length > 0).join('\n');

    const controllerDisposals = formFieldsList.map(f => {
        const dartType = jdlToDartType(f.type, parsedEnums);
        if (f.isRelationship) return '';
        else if (dartType !== 'bool' && !parsedEnums[f.type]) return `    _${f.name}Controller.dispose();`;
        return '';
    }).filter(line => line.length > 0).join('\n');

    const formFieldsWidgets = formFieldsList.map(f => {
        const dartType = jdlToDartType(f.type, parsedEnums);
        const fieldName = f.name;
        const labelText = fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const hintText = `Enter ${labelText}`;
        
        let fieldWidget;

        if (f.isRelationship) {
            fieldWidget = `
            // TODO: Implement UI for relationship '${fieldName}' (${f.relationshipType} to ${f.targetEntity})
            FHipsterInputField(
              controller: TextEditingController(text: 'Relationship: ${f.relationshipType} to ${f.targetEntity}'),
              label: '${labelText}'.tr,
              readOnly: true,
            )`;
        } else if (dartType === 'bool') {
            fieldWidget = `
          CheckboxListTile(
            title: Text('${labelText}'.tr),
            value: _${fieldName}Value,
            onChanged: (bool? newValue) {
              setState(() { _${fieldName}Value = newValue ?? false; });
            },
            controlAffinity: ListTileControlAffinity.leading,
          )`;
        } else if (parsedEnums[f.type]) {
            const enumValues = parsedEnums[f.type].map(val => `${f.type}.${val.toUpperCase()}`).join(',\n              '); 
            fieldWidget = `
          DropdownButtonFormField<${f.type}>(
            value: _${fieldName}Value,
            decoration: InputDecoration(labelText: '${labelText}'.tr),
            hint: Text('Select ${labelText}'.tr),
            items: <${f.type}>[${enumValues}].map<DropdownMenuItem<${f.type}>>((${f.type} value) {
              return DropdownMenuItem<${f.type}>(value: value, child: Text(value.toString().split('.').last));
            }).toList(),
            onChanged: (${f.type}? newValue) {
              setState(() { _${fieldName}Value = newValue; });
            },
            validator: (value) => value == null ? 'Please select a ${labelText.toLowerCase()}'.tr : null,
          )`;
        } else if (dartType === 'DateTime') {
            fieldWidget = `
          FHipsterInputField(
            controller: _${fieldName}Controller,
            label: '${labelText}'.tr,
            hint: 'YYYY-MM-DDTHH:MM:SSZ'.tr,
            keyboardType: TextInputType.datetime,
            validator: (value) {
              if (value == null || value.isEmpty) return 'Please enter ${labelText.toLowerCase()}'.tr;
              try { DateTime.parse(value); } catch (e) { return 'Invalid date format.'.tr; }
              return null;
            },
          )`;
        } else if (dartType === 'int' || dartType === 'double') {
            fieldWidget = `
          FHipsterInputField(
            controller: _${fieldName}Controller,
            label: '${labelText}'.tr,
            hint: '${hintText}'.tr,
            keyboardType: TextInputType.number,
            validator: (value) {
              if (value == null || value.isEmpty) return 'Please enter ${labelText.toLowerCase()}'.tr;
              if (double.tryParse(value) == null) return 'Please enter a valid number'.tr;
              return null;
            },
          )`;
        } else {
            fieldWidget = `
          FHipsterInputField(
            controller: _${fieldName}Controller,
            label: '${labelText}'.tr,
            hint: '${hintText}'.tr,
            validator: (value) => (value == null || value.isEmpty) ? 'Please enter ${labelText.toLowerCase()}'.tr : null,
          )`;
        }

        return `
          ResponsiveGridCol(
            lg: 4,
            md: 6,
            xs: 12,
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: ${fieldWidget},
            ),
          )`;

    }).join(',\n');

    const modelConstruction = fields.map(f => {
        const dartType = jdlToDartType(f.type, parsedEnums);
        const fieldName = f.name;
        
        if (fieldName === 'id') {
            return `        id: widget.initialData?.id,`;
        }
        if (f.isRelationship) {
            return `        ${fieldName}: widget.initialData?.${fieldName},`;
        } else if (dartType === 'bool') {
            return `        ${fieldName}: _${fieldName}Value,`;
        } else if (parsedEnums[f.type]) {
            return `        ${fieldName}: _${fieldName}Value,`;
        } else if (dartType === 'DateTime') {
            return `        ${fieldName}: DateTime.tryParse(_${fieldName}Controller.text),`;
        } else if (dartType === 'int') {
            return `        ${fieldName}: int.tryParse(_${fieldName}Controller.text),`;
        } else if (dartType === 'double') {
            return `        ${fieldName}: double.tryParse(_${fieldName}Controller.text),`;
        } else {
            return `        ${fieldName}: _${fieldName}Controller.text,`;
        }
    }).join('\n');

    const enumImports = formFieldsList
        .filter(f => parsedEnums[f.type])
        .map(f => `import '../enums/${f.type.charAt(0).toLowerCase() + f.type.slice(1)}_enum.dart';`)
        .filter((value, index, self) => self.indexOf(value) === index)
        .join('\n');

    return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:responsive_grid/responsive_grid.dart';
import '../models/${instanceName}_model.dart';
import '../widgets/fhipster_input_field.dart';
${enumImports.length > 0 ? enumImports + '\n' : ''}
class ${formClassName} extends StatefulWidget {
  final ${modelClassName}? initialData;
  final Function(${modelClassName}) onSubmit;

  const ${formClassName}({
    Key? key,
    this.initialData,
    required this.onSubmit,
  }) : super(key: key);

  @override
  State<${formClassName}> createState() => _${formClassName}State();
}

class _${formClassName}State extends State<${formClassName}> {
  final _formKey = GlobalKey<FormState>();

${controllerDeclarations}

  @override
  void initState() {
    super.initState();
${controllerInitializations}
  }

  @override
  void dispose() {
${controllerDisposals}
    super.dispose();
  }

  void _submitForm() {
    if (_formKey.currentState?.validate() ?? false) {
      final ${instanceName} = ${modelClassName}(
${modelConstruction}
      );
      widget.onSubmit(${instanceName});
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            ResponsiveGridRow(
              children: [
                ${formFieldsWidgets}
              ],
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _submitForm,
              child: Text(
                widget.initialData == null ? 'Create ${entityName}'.tr : 'Update ${entityName}'.tr,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
`;
}

module.exports = { generateFormTemplate };
