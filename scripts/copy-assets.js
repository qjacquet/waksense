/**
 * Script pour copier les assets HTML/CSS vers dist/renderer
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'src', 'renderer');
const destDir = path.join(__dirname, '..', 'dist', 'renderer');

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
    // Ne copier que les fichiers non-TypeScript
    if (!src.endsWith('.ts')) {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(src, dest);
    }
  }
}

// Copier tous les fichiers non-TypeScript du renderer
if (fs.existsSync(sourceDir)) {
  copyRecursive(sourceDir, destDir);
  console.log('Assets copiés vers dist/renderer');
}

