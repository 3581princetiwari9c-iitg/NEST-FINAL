import re

with open('pages/verticals.html', 'r') as f:
    html = f.read()

# Replace <details ...> with <div class="... accordion-item">
# We also want to add 'transition-all duration-300' and 'is-active' for the first one if we want it open. Let's start closed.
html = re.sub(r'<details class="group bg-white rounded-\[24px\] shadow-\[0px_1px_2px_0px_rgba\(0,0,0,0\.05\)\] border border-\[#e2e8f0\] overflow-hidden">', 
              r'<div class="accordion-item group bg-white rounded-[24px] shadow-sm hover:shadow-md transition-shadow duration-300 border border-[#e2e8f0] overflow-hidden">', html)

# Replace <summary ...> with <button ...>
html = re.sub(r'<summary class="([^"]+)">', 
              lambda m: '<button type="button" class="' + m.group(1).replace('group-open:border-[#e2e8f0]', 'group-[.is-active]:border-[#e2e8f0]').replace('rounded-t-[24px]', 'rounded-[24px] group-[.is-active]:rounded-b-none group-[.is-active]:bg-gray-50').replace('py-4 lg:py-[12px]', 'py-5 lg:py-[20px] w-full text-left') + ' accordion-header">', html)

html = html.replace('</summary>', '</button>')

# Replace group-open classes
html = html.replace('group-open:hidden', 'group-[.is-active]:hidden')
html = html.replace('group-open:flex', 'group-[.is-active]:flex')

# Now the tricky part: wrapping the content.
# The content is in <div class="bg-..."> right after </button>
# We can find </button>\s*<div class="(bg-\[[^\]]+\][^"]+)">
def wrap_content(m):
    classes = m.group(1)
    # The inner div will have the original classes, but we wrap it.
    return f'</button>\n        <div class="accordion-content grid grid-rows-[0fr] transition-all duration-500 ease-in-out opacity-0 group-[.is-active]:opacity-100 group-[.is-active]:grid-rows-[1fr]">\n          <div class="overflow-hidden">\n            <div class="{classes} border-t border-[#e2e8f0]/50">'

html = re.sub(r'</button>\s*<div class="(bg-\[[^\]]+\][^"]+)">', wrap_content, html)

# Close the wrapper before </details> -> </div>
html = re.sub(r'(\s*)</details>', r'\n            </div>\n          </div>\n        </div>\1</div>', html)

# Add the script at the end of the file
script = """
<!-- Accordion Script -->
<script>
  document.querySelectorAll('.accordion-header').forEach(button => {
    button.addEventListener('click', () => {
      const accordionItem = button.closest('.accordion-item');
      
      // Close all other accordions (Optional, comment out if you want multiple open at once)
      document.querySelectorAll('.accordion-item').forEach(item => {
        if (item !== accordionItem) {
          item.classList.remove('is-active');
        }
      });

      // Toggle current accordion
      accordionItem.classList.toggle('is-active');
    });
  });
</script>
"""
if "<!-- Accordion Script -->" not in html:
    html = html + script

with open('pages/verticals.html', 'w') as f:
    f.write(html)
