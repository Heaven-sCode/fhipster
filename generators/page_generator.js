// generators/page_generator.js
// Emits lib/views/<page_name>_page.dart
// - Stateless widget for a blank page
//
// Usage:
//   writeFile(..., generatePageTemplate('MyPage'), ...)

function generatePageTemplate(pageName) {
  const className = `${pageName}Page`;

  return `// Custom page - do not overwrite
import 'package:flutter/material.dart';
import 'package:get/get.dart';

/// Blank page for ${pageName}.
class ${className} extends StatelessWidget {
  const ${className}({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${pageName}'.tr),
      ),
      body: Center(
        child: Text('${pageName} Page'.tr),
      ),
    );
  }
}
`;
}

module.exports = { generatePageTemplate };