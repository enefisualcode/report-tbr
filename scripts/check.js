const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ignored = new Set(['dist', 'node_modules', '.git']);

function listJavaScript(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScript(fullPath);
    return entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

for (const file of listJavaScript(root)) {
  try {
    new Function(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Syntax error in ${path.relative(root, file)}: ${error.message}`);
    process.exit(1);
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)]
  .map(match => match[1])
  .filter(reference => !/^(?:https?:|data:|#)/.test(reference));
for (const reference of references) {
  if (!fs.existsSync(path.join(root, reference))) {
    console.error(`Missing local asset referenced by index.html: ${reference}`);
    process.exit(1);
  }
}

console.log(`Checked ${listJavaScript(root).length} JavaScript files and ${references.length} local HTML assets.`);
