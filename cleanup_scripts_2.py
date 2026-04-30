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

    # Remove the click listener block containing window.history.pushState
    content = re.sub(r"document\.addEventListener\('click',\s*\(e\)\s*=>\s*\{.*?(?:updateActiveSidebar|handleNavigation)\(\);\s*\}\s*\}\);\s*", '', content, flags=re.DOTALL)

    with open(script, 'w') as f:
        f.write(content)

print("Removed remaining pushState interceptors")
