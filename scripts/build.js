const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const tscBin = path.join(rootDir, 'node_modules/typescript/bin/tsc');

console.log('\x1b[34m[build]\x1b[0m Compiling TypeScript declarations and CommonJS distribution...');

// 1. Run tsc with tsconfig.json (produces .js and .d.ts in dist)
execSync(`node "${tscBin}"`, { cwd: rootDir, stdio: 'inherit' });

// 2. Generate .cjs files from .js files
function processFiles(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processFiles(fullPath);
    } else if (item.endsWith('.js') && !item.endsWith('.cjs') && !item.endsWith('.mjs')) {
      const cjsPath = fullPath.slice(0, -3) + '.cjs';
      fs.copyFileSync(fullPath, cjsPath);
    }
  }
}
processFiles(distDir);

// 3. Compile ESM (.mjs) by invoking tsc with ES2022 module
console.log('\x1b[34m[build]\x1b[0m Compiling ES Modules (.mjs)...');
const tempTsconfig = path.join(rootDir, 'tsconfig.esm.json');
fs.writeFileSync(tempTsconfig, JSON.stringify({
  extends: './tsconfig.json',
  compilerOptions: {
    module: 'ES2022',
    moduleResolution: 'bundler',
    declaration: false,
    outDir: './dist/esm'
  }
}, null, 2));

try {
  execSync(`node "${tscBin}" -p "${tempTsconfig}"`, { cwd: rootDir, stdio: 'inherit' });

  // Move files from dist/esm to dist as .mjs
  function moveEsm(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        moveEsm(fullPath);
      } else if (item.endsWith('.js')) {
        const rel = path.relative(path.join(distDir, 'esm'), fullPath);
        const targetPath = path.join(distDir, rel.slice(0, -3) + '.mjs');
        let code = fs.readFileSync(fullPath, 'utf8');
        // Ensure relative imports in ESM have .mjs
        code = code.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, imp) => {
          if (!imp.endsWith('.mjs') && !imp.endsWith('.js')) {
            return `from '${imp}.mjs'`;
          }
          return match;
        });
        code = code.replace(/export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g, (match, imp) => {
          if (!imp.endsWith('.mjs') && !imp.endsWith('.js')) {
            return `export * from '${imp}.mjs'`;
          }
          return match;
        });
        code = code.replace(/export\s+\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g, (match, names, imp) => {
          if (!imp.endsWith('.mjs') && !imp.endsWith('.js')) {
            return `export {${names}} from '${imp}.mjs'`;
          }
          return match;
        });
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, code, 'utf8');
      }
    }
  }
  moveEsm(path.join(distDir, 'esm'));
  fs.rmSync(path.join(distDir, 'esm'), { recursive: true, force: true });
} finally {
  if (fs.existsSync(tempTsconfig)) {
    fs.unlinkSync(tempTsconfig);
  }
}

console.log('\x1b[32m[build]\x1b[0m Build complete! Full dual distribution (CJS, ESM, .d.ts) generated in dist/');
