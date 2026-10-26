const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
const assets = ['index.html', 'styles.css', 'config.js', 'app.js'];

fs.mkdirSync(dist, { recursive: true });
for (const asset of assets) fs.copyFileSync(path.join(root, asset), path.join(dist, asset));
console.log(`Built ${assets.length} files into dist/`);
