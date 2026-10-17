const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'build' && file !== 'dist' && file !== '__tests__') {
        walk(full, fileList);
      }
    } else if (/\.(jsx?|tsx?|css)$/.test(file)) {
      fileList.push(full);
    }
  }
  return fileList;
}

const targetDir = path.resolve(__dirname, '../src');
const files = walk(targetDir);

const hexRegex = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
const tailwindPaletteRegex = /\b(?:bg|text|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g;

let totalHex = 0;
let totalTailwind = 0;
const offenders = [];

for (const f of files) {
  const rel = path.relative(targetDir, f).replace(/\\/g, '/');
  // Whitelist theme.js and index.css as canonical token definitions
  if (rel === 'utils/theme.js' || rel === 'index.css') continue;

  const content = fs.readFileSync(f, 'utf8');
  const hexMatches = content.match(hexRegex) || [];
  const twMatches = content.match(tailwindPaletteRegex) || [];

  if (hexMatches.length > 0 || twMatches.length > 0) {
    totalHex += hexMatches.length;
    totalTailwind += twMatches.length;
    offenders.push({
      file: rel,
      hex: hexMatches.length,
      tailwind: twMatches.length,
      total: hexMatches.length + twMatches.length,
    });
  }
}

offenders.sort((a, b) => b.total - a.total);

console.log('--- Academic Registrar Color Linter ---');
console.log(`Files with color leaks: ${offenders.length}`);
console.log(`Hard-coded Hex literals: ${totalHex}`);
console.log(`Raw Tailwind palette classes: ${totalTailwind}`);
console.log(`Total instances: ${totalHex + totalTailwind}\n`);

if (offenders.length > 0) {
  console.log('Top 10 Files:');
  offenders.slice(0, 10).forEach((o, i) => {
    console.log(`  ${i + 1}. ${o.file} — ${o.total} leaks (hex: ${o.hex}, tw: ${o.tailwind})`);
  });
}
