const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const lucideIcons = [
  'Plus', 'PlusCircle', 'Trash2', 'Edit3', 'Zap', 'Monitor', 'Tv', 'Gamepad2',
  'CheckCircle', 'CheckCircle2', 'X', 'AlertTriangle', 'AlertCircle', 'Clock',
  'Coffee', 'Receipt', 'Users', 'Banknote', 'CreditCard', 'Smartphone', 'Moon',
  'Sparkles', 'TrendingUp', 'TrendingDown', 'Package', 'ShoppingBag', 'ShoppingCart',
  'Settings', 'RefreshCw', 'ArrowLeft', 'ArrowRight', 'ArrowRightLeft', 'PowerOff',
  'Printer', 'Share2', 'Save', 'FileCheck', 'Building2', 'Phone', 'KeyRound',
  'SlidersHorizontal', 'Search', 'UserPlus', 'UserCheck', 'UserX', 'Database',
  'Activity', 'Eye', 'EyeOff', 'Layers', 'DollarSign', 'BarChart2', 'LayoutDashboard',
  'LayoutGrid', 'List', 'Sun', 'Moon', 'LogOut', 'Menu', 'Shield', 'Loader2', 'Inbox', 'Minus',
  'Laptop', 'ArrowUpRight', 'ArrowDownRight'
];

const files = getFiles('./src');
let missingCount = 0;

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  lucideIcons.forEach(icon => {
    const regex = new RegExp('<' + icon + '(\\s|/|>)');
    if (regex.test(content)) {
      const hasImport = new RegExp('import[\\s\\S]*?\\b' + icon + '\\b[\\s\\S]*?from[\\s\\S]*?[\'"]lucide-react[\'"]').test(content);
      const isDefined = new RegExp('(function|class|const|let|var)\\s+' + icon + '\\b').test(content);
      if (!hasImport && !isDefined) {
        console.log(`MISSING IMPORT in ${f}: ${icon}`);
        missingCount++;
      }
    }
  });
});

console.log(`Scan complete. Missing imports found: ${missingCount}`);
