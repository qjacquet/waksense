/**
 * Reorganize dist folder structure
 * Moves files from nested directories to flat structure
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function moveDir(src, dest) {
  if (!fs.existsSync(src)) return;
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    if (fs.statSync(srcPath).isDirectory()) {
      moveDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('Reorganizing dist structure...');

// Move main/main/* to main/
const mainMainDir = path.join(distDir, 'main', 'main');
const mainDir = path.join(distDir, 'main');
if (fs.existsSync(mainMainDir)) {
  console.log('Moving main/main/* to main/');
  moveDir(mainMainDir, mainDir);
  removeDir(mainMainDir);
}

// Move renderer/renderer/* to renderer/
const rendererRendererDir = path.join(distDir, 'renderer', 'renderer');
const rendererDir = path.join(distDir, 'renderer');
if (fs.existsSync(rendererRendererDir)) {
  console.log('Moving renderer/renderer/* to renderer/');
  moveDir(rendererRendererDir, rendererDir);
  removeDir(rendererRendererDir);
  
  // Fix import paths in renderer JS files: change ../../../shared/ to ../../shared/
  console.log('Fixing import paths in renderer files...');
  function fixImports(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fixImports(filePath);
      } else if (file.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        // Replace ../../../shared/ with ../../shared/ in import statements
        content = content.replace(/from\s+['"]\.\.\/\.\.\/\.\.\/shared\//g, (match) => {
          const quote = match.includes("'") ? "'" : '"';
          return `from ${quote}../../shared/`;
        });
        fs.writeFileSync(filePath, content, 'utf8');
      }
    }
  }
  fixImports(rendererDir);
}

// Copy shared files from main/shared to dist/shared before removing (needed by main process)
const mainSharedDir = path.join(distDir, 'main', 'shared');
const sharedDir = path.join(distDir, 'shared');
if (fs.existsSync(mainSharedDir)) {
  console.log('Copying main/shared/* to shared/');
  moveDir(mainSharedDir, sharedDir);
  console.log('Removing duplicate main/shared/');
  removeDir(mainSharedDir);
}
// Keep renderer/shared/ as it contains ES module versions needed by renderer

// Remove duplicate shared/shared if it exists
const sharedSharedDir = path.join(distDir, 'shared', 'shared');
if (fs.existsSync(sharedSharedDir)) {
  console.log('Removing duplicate shared/shared/');
  removeDir(sharedSharedDir);
}

console.log('Reorganization complete!');

