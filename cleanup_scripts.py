import os
import re

dashboard_scripts = [
    'dashboard/js/dashboard.js',
    'dashboard/js/startup-dashboard.js',
    'dashboard/js/artisan-dashboard.js',
    'dashboard/js/entrepreneur-dashboard.js',
    'dashboard/js/trainee-dashboard.js'
]

for script in dashboard_scripts:
    if not os.path.exists(script):
        continue
    with open(script, 'r') as f:
        content = f.read()

    # Remove ensureMarketplaceSidebarLink completely
    # It starts at "function ensureMarketplaceSidebarLink" and ends at the closing brace of that function
    content = re.sub(r'function ensureMarketplaceSidebarLink.*?\}\s*\n', '', content, flags=re.DOTALL)
    
    # Remove the call to ensureMarketplaceSidebarLink
    content = re.sub(r'ensureMarketplaceSidebarLink\(sidebarContainer\);\s*\n', '', content)

    # Remove the interceptor document.addEventListener('click', ...
    # This might look like:
    # document.addEventListener('click', (e) => {
    #     const link = e.target.closest('a');
    #     if (!link) return;
    #     const href = link.getAttribute('href');
    #     if (href && href.startsWith('/admin/')) { ... }
    # });
    
    content = re.sub(r"document\.addEventListener\('click',\s*\([^)]*\)\s*=>\s*\{[^}]+href\.startsWith\([^}]+updateActiveSidebar\(\);[^}]+handleNavigation\(\);[^}]+\}\);\s*", '', content, flags=re.DOTALL)

    with open(script, 'w') as f:
        f.write(content)

print("Cleaned up dashboard scripts")
