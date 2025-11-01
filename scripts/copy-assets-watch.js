/**
 * Script pour surveiller et copier les assets HTML/CSS en temps réel
 */

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'src', 'renderer');
const destDir = path.join(__dirname, '..', 'dist', 'renderer');

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${src} -> ${dest}`);
}

// Copier initialement
if (fs.existsSync(sourceDir)) {
  function copyRecursive(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      fs.readdirSync(src).forEach(childItemName => {
        copyRecursive(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      });
    } else {
      if (!src.endsWith('.ts')) {
        copyFile(src, dest);
      }
    }
  }
  copyRecursive(sourceDir, destDir);
}

// Surveiller les changements
const watcher = chokidar.watch(sourceDir, {
  ignored: /\.ts$/,
  persistent: true
});

watcher.on('change', filePath => {
  const relativePath = path.relative(sourceDir, filePath);
  const destPath = path.join(destDir, relativePath);
  copyFile(filePath, destPath);
});

watcher.on('add', filePath => {
  if (!filePath.endsWith('.ts')) {
    const relativePath = path.relative(sourceDir, filePath);
    const destPath = path.join(destDir, relativePath);
    copyFile(filePath, destPath);
  }
});

console.log('Watching for asset changes...');

