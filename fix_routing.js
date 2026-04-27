const fs = require('fs');
const path = require('path');

const basePath = '/Users/umarfiroz/Desktop/nest-pr/NEST-FINAL';

// 1. Copy and modify navbar
const navbarSrc = fs.readFileSync(path.join(basePath, 'components/navbar.html'), 'utf8');
const pageHeaderSrc = navbarSrc.replace(/href="#/g, 'href="/index.html#');
fs.writeFileSync(path.join(basePath, 'components/page-header.html'), pageHeaderSrc);

// 2. Modify dashboard JS files
const jsDir = path.join(basePath, 'dashboard/js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

for (const file of files) {
    const filePath = path.join(jsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Change fetched header
    content = content.replace(/fetch\(['"]\/components\/navbar\.html['"]\)/g, "fetch('/components/page-header.html')");
    
    // Fix logout logic
    const newLogout = `        if (hash === '#logout') {
            if (confirm("Do you want to logout?")) {
                localStorage.removeItem('nest_current_user');
                window.location.href = '/index.html';
            } else {
                window.history.back();
            }
            return;
        }`;
        
    content = content.replace(/if\s*\(\s*hash\s*===\s*['"]#logout['"]\s*\)\s*\{\s*window\.location\.href\s*=\s*['"]\/index\.html['"];\s*return;\s*\}/, newLogout);
    
    fs.writeFileSync(filePath, content);
}
console.log('Done fixing routing and logout.');
