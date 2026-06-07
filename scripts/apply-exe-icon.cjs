const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const iconPath = path.join(root, 'build', 'icon.ico');
const cacheRoot = path.join(root, 'output', 'electron-builder-cache', 'winCodeSign');

function findRcedit(dir) {
  if (!fs.existsSync(dir)) {
    return null;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === 'rcedit-x64.exe') {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = findRcedit(fullPath);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

module.exports = async function applyExeIcon(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const rceditPath = findRcedit(cacheRoot);
  if (!rceditPath) {
    console.warn('Skipped exe icon patch: rcedit-x64.exe was not found in electron-builder cache.');
    return;
  }

  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const target = path.join(context.appOutDir, exeName);
  if (!fs.existsSync(target)) {
    console.warn(`Skipped exe icon patch: ${target} was not found.`);
    return;
  }

  const result = spawnSync(rceditPath, [target, '--set-icon', iconPath], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    throw new Error(`Failed to apply Windows exe icon to ${target}.`);
  }

  console.log(`Applied Windows exe icon to ${target}.`);
};
