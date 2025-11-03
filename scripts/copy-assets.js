/**
 * Script pour copier les assets HTML/CSS vers dist/renderer
 * et les assets globaux vers dist/assets
 */

const fs = require("fs");
const path = require("path");

const rendererSourceDir = path.join(__dirname, "..", "src", "renderer");
const rendererDestDir = path.join(__dirname, "..", "dist", "renderer");
const assetsSourceDir = path.join(__dirname, "..", "assets");
const assetsDestDir = path.join(__dirname, "..", "dist", "assets");

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // Ne copier que les fichiers non-TypeScript
    if (!src.endsWith(".ts")) {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(src, dest);
    }
  }
}

// Copier tous les fichiers non-TypeScript du renderer
if (fs.existsSync(rendererSourceDir)) {
  copyRecursive(rendererSourceDir, rendererDestDir);
  console.log("Assets copiés vers dist/renderer");
}

// Copier tous les assets globaux vers dist/assets
if (fs.existsSync(assetsSourceDir)) {
  copyRecursive(assetsSourceDir, assetsDestDir);
  console.log("Assets globaux copiés vers dist/assets");
}
