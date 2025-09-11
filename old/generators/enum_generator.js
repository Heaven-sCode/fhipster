/**
 * Generates the content for a Dart enum file.
 * @param {string} enumName - The name of the enum.
 * @param {Array<string>} values - The values of the enum.
 * @returns {string} The Dart code for the enum.
 */
function generateEnumTemplate(enumName, values) {
    const enumValues = values.map(val => `  ${val.toUpperCase()}`).join(',\n'); 
    return `enum ${enumName} {
${enumValues}
}
`;
}

module.exports = { generateEnumTemplate };
