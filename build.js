const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
const assets = ['index.html', 'styles.css', 'config.js', 'app.js', 'month-loader.js', 'month-filter.js', 'admin-panel.js', 'supervisor-panel.js', 'assets/bsi-mark.png'];

fs.mkdirSync(dist, { recursive: true });
for (const asset of assets) {
  const target = path.join(dist, asset);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, asset), target);
}
console.log(`Built ${assets.length} files into dist/`);

