const fs = require('fs');
const path = '/Users/umarfiroz/Desktop/nest-pr/NEST-FINAL/components/page-header.html';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/href="\/index\.html#/g, 'href="index.html#');
fs.writeFileSync(path, content);
console.log('Fixed URLs in page-header.html');
