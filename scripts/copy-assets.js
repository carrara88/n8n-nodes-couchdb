const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'nodes', 'CouchDb', 'logo.svg');
const destDir = path.join(__dirname, '..', 'dist', 'nodes', 'CouchDb');
const dest = path.join(destDir, 'logo.svg');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);

console.log(`Copied ${src} -> ${dest}`);
