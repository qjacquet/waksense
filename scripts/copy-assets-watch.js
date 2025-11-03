/**
 * Script pour surveiller et copier les assets HTML/CSS en temps réel
 * et les assets globaux vers dist/assets
 */

const chokidar = require("chokidar");
const fs = require("fs");
const path = require("path");

const rendererSourceDir = path.join(__dirname, "..", "src", "renderer");
const rendererDestDir = path.join(__dirname, "..", "dist", "renderer");
const assetsSourceDir = path.join(__dirname, "..", "assets");
const assetsDestDir = path.join(__dirname, "..", "dist", "assets");

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${src} -> ${dest}`);
}

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
    if (!src.endsWith(".ts")) {
      copyFile(src, dest);
    }
  }
}

// Copier initialement les fichiers renderer
if (fs.existsSync(rendererSourceDir)) {
  copyRecursive(rendererSourceDir, rendererDestDir);
}

// Copier initialement les assets globaux
if (fs.existsSync(assetsSourceDir)) {
  copyRecursive(assetsSourceDir, assetsDestDir);
}

// Surveiller les changements du renderer
const rendererWatcher = chokidar.watch(rendererSourceDir, {
  ignored: /\.ts$/,
  persistent: true,
});

rendererWatcher.on("change", (filePath) => {
  const relativePath = path.relative(rendererSourceDir, filePath);
  const destPath = path.join(rendererDestDir, relativePath);
  copyFile(filePath, destPath);
});

rendererWatcher.on("add", (filePath) => {
  if (!filePath.endsWith(".ts")) {
    const relativePath = path.relative(rendererSourceDir, filePath);
    const destPath = path.join(rendererDestDir, relativePath);
    copyFile(filePath, destPath);
  }
});

// Surveiller les changements des assets globaux
const assetsWatcher = chokidar.watch(assetsSourceDir, {
  persistent: true,
});

assetsWatcher.on("change", (filePath) => {
  const relativePath = path.relative(assetsSourceDir, filePath);
  const destPath = path.join(assetsDestDir, relativePath);
  copyFile(filePath, destPath);
});

assetsWatcher.on("add", (filePath) => {
  const relativePath = path.relative(assetsSourceDir, filePath);
  const destPath = path.join(assetsDestDir, relativePath);
  copyFile(filePath, destPath);
});

console.log("Watching for asset changes (renderer and global assets)...");
