const fs = require('fs');
const path = '/Users/umarfiroz/Desktop/nest-pr/NEST-FINAL/js/nest-supabase-app.js';
let content = fs.readFileSync(path, 'utf8');

// Fix line 1420 syntax error
content = content.replace(
  /\s*\.map\(\s*<a href="\$\{html\(row\.pdf_url \|\| '#'\)\}"/,
  `\n        .map(\n          (row) => \`\n        <a href="\${html(row.pdf_url || '#')}"`
);

// Fix formatter damage globally
content = content.replace(/<\s+div\s+class=\s+"/g, '<div class="');
content = content.replace(/"\s+>/g, '">');
content = content.replace(/<\/div\s+>/g, '</div>');

content = content.replace(/<\s+span\s+class=\s+"/g, '<span class="');
content = content.replace(/<\/span\s+>/g, '</span>');

content = content.replace(/<\s+img\s+/g, '<img ');

content = content.replace(/<\s+button\s+/g, '<button ');
content = content.replace(/<\/button\s+>/g, '</button>');

content = content.replace(/<\s+a\s+/g, '<a ');
content = content.replace(/<\/a\s+>/g, '</a>');

content = content.replace(/<\s+p\s+class=\s+"/g, '<p class="');
content = content.replace(/<\/p\s+>/g, '</p>');

fs.writeFileSync(path, content);
console.log('Fixed syntax and formatter damage.');
