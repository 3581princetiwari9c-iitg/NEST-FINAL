import os

path = 'components/page-header.html'
with open(path, 'r') as f:
    content = f.read()

# Replace all occurrences
content = content.replace('href="index.html#', 'href="/index.html#')

# In case there are any 'href="index.html"'
content = content.replace('href="index.html"', 'href="/index.html"')

with open(path, 'w') as f:
    f.write(content)

print("Replaced successfully in page-header.html")
