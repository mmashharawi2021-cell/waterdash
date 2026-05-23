const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, 'assets');
const ARCHIVE_DIR = path.join(ASSETS_DIR, 'archive');

// Ensure archive directory exists
if (!fs.existsSync(ARCHIVE_DIR)) {
  fs.mkdirSync(ARCHIVE_DIR);
}

const JS_MODULES = {
  'core-system.js': [
    'version-guard.js',
    'theme-switcher.js',
    'firebase-config.js',
    'firebase-service.js',
    'parser.js'
  ],
  'auth-system.js': [
    'users-auth.js',
    'users-login-fix.js',
    'users-session-restore.js',
    'users-ui.js',
    'permissions-guard.js',
    'users-button-force.js'
  ],
  'ui-system.js': [
    'skip-warnings-patch.js',
    'date-save-patch.js',
    'ui.js',
    'startup-stability-fix.js',
    'stable-layout-reset.js',
    'warning-actions.js'
  ],
  'reports-system.js': [
    'report-utils.js',
    'report-utils-time-patch.js',
    'live-calculations.js',
    'fuel-dashboard-patch.js',
    'external-water-and-save-patch.js',
    'fuel-previous-and-time-fix.js',
    'fuel-kpi-override.js',
    'data-quality-pro.js'
  ],
  'fuel-system.js': [
    'incoming-fuel-v2.js',
    'fuel-entry-dedupe-fix.js',
    'fuel-entry-source-fix.js',
    'refresh-control.js'
  ],
  'export-system.js': [
    'export-center-v4-core.js',
    'export-center-v4-runner.js'
  ],
  'main-app.js': [
    'stable-cleanup.js',
    'app.js'
  ]
};

const CSS_MODULES = {
  'theme.css': [
    'styles.css',
    'theme-polish.css',
    'theme-variants.css',
    'day-night-theme.css'
  ],
  'layout.css': [
    'final-ui.css',
    'product-features.css',
    'compact-cards.css',
    'stabilization-responsive.css',
    'stabilization-mobile-cards.css',
    'stabilization-visual-v2.css',
    'stabilization-visual-v3.css',
    'stable-cleanup.css'
  ],
  'components.css': [
    'performance-fix.css',
    'warning-actions.css',
    'skip-warnings-patch.css',
    'time-picker.css',
    'live-calculations.css',
    'fuel-dashboard-patch.css',
    'external-water-and-save-patch.css',
    'fuel-previous-and-time-fix.css',
    'users-ui.css',
    'users-button-force.css',
    'incoming-fuel.css',
    'fuel-entry-dedupe-fix.css',
    'refresh-control.css',
    'export-center-v4.css',
    'export-center-pro.css'
  ]
};

console.log('🏗️ Starting consolidation...');

let archivedFiles = new Set();

function concatFiles(modulesMap, outExt) {
  for (const [outFileName, fileList] of Object.entries(modulesMap)) {
    let combinedContent = `/* --- Auto-Generated Module: ${outFileName} --- */\n\n`;
    let hasContent = false;
    
    for (const fileName of fileList) {
      const filePath = path.join(ASSETS_DIR, fileName);
      if (fs.existsSync(filePath)) {
        console.log(`Reading: ${fileName}`);
        combinedContent += `/* ==========================================\n   FILE: ${fileName}\n   ========================================== */\n`;
        combinedContent += fs.readFileSync(filePath, 'utf8') + '\n\n';
        archivedFiles.add(fileName);
        hasContent = true;
      } else {
        console.warn(`⚠️ Warning: ${fileName} not found!`);
      }
    }
    
    if (hasContent) {
      const outPath = path.join(ASSETS_DIR, 'bundled', outFileName);
      // create bundled dir if not exist
      const bundledDir = path.join(ASSETS_DIR, 'bundled');
      if (!fs.existsSync(bundledDir)) fs.mkdirSync(bundledDir);
      
      fs.writeFileSync(outPath, combinedContent);
      console.log(`✅ Created: ${outFileName}`);
    }
  }
}

concatFiles(JS_MODULES, '.js');
concatFiles(CSS_MODULES, '.css');

// Move bundled files up to assets and archive old files
console.log('\n📦 Archiving old files and moving bundled files...');
const bundledDir = path.join(ASSETS_DIR, 'bundled');

if (fs.existsSync(bundledDir)) {
  const bundledFiles = fs.readdirSync(bundledDir);
  
  // Move old files to archive
  for (const file of fs.readdirSync(ASSETS_DIR)) {
    if (file.endsWith('.js') || file.endsWith('.css')) {
      const filePath = path.join(ASSETS_DIR, file);
      // We also archive files that were NOT in the manifest but are just lying around (e.g., unused patches)
      // Actually let's only archive files we explicitly know or unused patches. 
      // Safe strategy: archive everything that is .js or .css except the newly bundled ones
      if (!bundledFiles.includes(file)) {
          const archivePath = path.join(ARCHIVE_DIR, file);
          fs.renameSync(filePath, archivePath);
          console.log(`Moved to archive: ${file}`);
      }
    }
  }

  // Move bundled files out
  for (const file of bundledFiles) {
    fs.renameSync(path.join(bundledDir, file), path.join(ASSETS_DIR, file));
    console.log(`Published module: ${file}`);
  }
  
  fs.rmdirSync(bundledDir);
}

// Generate clean index.html
console.log('\n📝 Generating clean index.html...');
const htmlContent = `<!doctype html>
<html lang="ar" dir="rtl" data-water-booting="true">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#031D36">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>نظام تقارير تشغيل وضخ المياه | صالح الدحنون</title>
  <link rel="icon" href="data:,">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <script>window.WATER_APP_BUILD = '20260523-clean-v2';</script>
  
  <!-- CSS Modules -->
  <link rel="stylesheet" href="assets/theme.css?v=20260523-clean-v2">
  <link rel="stylesheet" href="assets/layout.css?v=20260523-clean-v2">
  <link rel="stylesheet" href="assets/components.css?v=20260523-clean-v2">
</head>
<body>
  <div id="app"></div>

  <!-- Firebase & External Libraries -->
  <script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

  <!-- JS Modules -->
  <script src="assets/core-system.js?v=20260523-clean-v2"></script>
  <script src="assets/auth-system.js?v=20260523-clean-v2"></script>
  <script src="assets/ui-system.js?v=20260523-clean-v2"></script>
  <script src="assets/reports-system.js?v=20260523-clean-v2"></script>
  <script src="assets/fuel-system.js?v=20260523-clean-v2"></script>
  <script src="assets/export-system.js?v=20260523-clean-v2"></script>
  <script src="assets/main-app.js?v=20260523-clean-v2"></script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'index.html'), htmlContent);
console.log('✅ index.html has been overwritten with modular setup!');
console.log('🎉 Refactoring Complete!');
