import os
import re

sidebars = [
    'components/sidebar.html',
    'components/startup-sidebar.html',
    'components/artisan-sidebar.html',
    'components/entrepreneur-sidebar.html',
    'components/trainee-sidebar.html'
]

for sb in sidebars:
    if not os.path.exists(sb):
        continue
    with open(sb, 'r') as f:
        content = f.read()

    # Revert /admin/something to #something
    content = re.sub(r'href="/admin/([^"]+)"', r'href="#\1"', content)
    # Revert /startup/something to #something
    content = re.sub(r'href="/startup/([^"]+)"', r'href="#\1"', content)
    # Revert /artisan/something to #something
    content = re.sub(r'href="/artisan/([^"]+)"', r'href="#\1"', content)
    # Revert /entrepreneur/something to #something
    content = re.sub(r'href="/entrepreneur/([^"]+)"', r'href="#\1"', content)
    # Revert /trainee/something to #something
    content = re.sub(r'href="/trainee/([^"]+)"', r'href="#\1"', content)

    # In case there's any left-over href="/admin" to href="#dashboard"
    content = re.sub(r'href="/admin"', r'href="#dashboard"', content)

    with open(sb, 'w') as f:
        f.write(content)

print("Reverted sidebars to use hash routing.")
