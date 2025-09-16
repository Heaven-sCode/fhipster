function generateSamplePubspec({ enableSQLite = false } = {}) {
  const dependencies = {
    flutter: { sdk: 'flutter' },
    cupertino_icons: '^1.0.6',
    get: '^4.6.6',
    get_storage: '^2.1.1',
    connectivity_plus: '^5.0.2',
  };

  if (enableSQLite) {
    dependencies.sqflite = '^2.3.0';
    dependencies.path = '^1.8.3';
    dependencies.path_provider = '^2.1.2';
  }

  const lines = [];
  lines.push('# Generated sample pubspec that lists dependencies required by FHipster output.');
  lines.push('# Merge these with your project\'s pubspec.yaml as needed.');
  lines.push('name: fhipster_generated_dependencies');
  lines.push('description: Sample dependency manifest emitted by FHipster.');
  lines.push("environment:");
  lines.push("  sdk: '>=3.0.0 <4.0.0'");
  lines.push('');
  lines.push('dependencies:');
  Object.entries(dependencies).forEach(([name, value]) => {
    if (typeof value === 'object') {
      lines.push(`  ${name}:`);
      Object.entries(value).forEach(([k, v]) => {
        lines.push(`    ${k}: ${v}`);
      });
    } else {
      lines.push(`  ${name}: ${value}`);
    }
  });
  lines.push('');
  lines.push('dev_dependencies:');
  lines.push('  flutter_test:');
  lines.push("    sdk: flutter");
  lines.push('');
  lines.push('flutter:');
  lines.push('  uses-material-design: true');

  return lines.join('\n');
}

module.exports = { generateSamplePubspec };
