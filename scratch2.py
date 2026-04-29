with open('pages/verticals.html', 'r') as f:
    html = f.read()

# 1
html = html.replace(
    '<details class="group bg-white rounded-[24px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] border border-[#e2e8f0] overflow-hidden">',
    '<div class="accordion-item group bg-white rounded-[24px] shadow-sm hover:shadow-md transition-shadow duration-300 border border-[#e2e8f0] overflow-hidden">'
)

# 2
html = html.replace(
    '<summary class="flex items-center justify-between px-6 lg:px-[56px] py-4 lg:py-[12px] cursor-pointer outline-none list-none [&::-webkit-details-marker]:hidden bg-white hover:bg-gray-50 transition-colors border-b border-transparent group-open:border-[#e2e8f0] rounded-t-[24px]">',
    '<button type="button" class="w-full flex items-center justify-between px-6 lg:px-[56px] py-5 lg:py-[20px] cursor-pointer outline-none bg-white hover:bg-gray-50 transition-colors border-b border-transparent group-[.is-active]:border-[#e2e8f0]/50 group-[.is-active]:bg-gray-50 accordion-header">'
)

# 3, 4, 5
html = html.replace('group-open:hidden', 'group-[.is-active]:hidden')
html = html.replace('group-open:flex', 'group-[.is-active]:flex')
html = html.replace('</summary>', '</button>')

# 6
html = html.replace(
    '<div class="bg-[#ebebeb] px-6 lg:px-[56px] py-10 lg:py-[72px] flex flex-col items-center gap-10 lg:gap-[56px]">',
    '<div class="accordion-content grid grid-rows-[0fr] transition-all duration-500 ease-in-out opacity-0 group-[.is-active]:opacity-100 group-[.is-active]:grid-rows-[1fr]">\n          <div class="overflow-hidden">\n            <div class="bg-[#f8fafc] px-6 lg:px-[56px] py-10 lg:py-[72px] flex flex-col items-center gap-10 lg:gap-[56px]">'
)

# 7
html = html.replace(
    '<div class="bg-white px-6 lg:px-[56px] py-10 lg:py-[72px] flex flex-col items-center gap-10 lg:gap-[56px] rounded-b-[24px]">',
    '<div class="accordion-content grid grid-rows-[0fr] transition-all duration-500 ease-in-out opacity-0 group-[.is-active]:opacity-100 group-[.is-active]:grid-rows-[1fr]">\n          <div class="overflow-hidden">\n            <div class="bg-[#f8fafc] px-6 lg:px-[56px] py-10 lg:py-[72px] flex flex-col items-center gap-10 lg:gap-[56px]">'
)

# 8
html = html.replace('</details>', '</div>\n          </div>\n        </div>\n      </div>')

# 9. Ensure script is added
script = """
<!-- Accordion Script -->
<script>
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.accordion-header').forEach(button => {
      button.addEventListener('click', () => {
        const accordionItem = button.closest('.accordion-item');
        
        // Optional: Close others (uncomment to make it exclusive)
        // document.querySelectorAll('.accordion-item').forEach(item => {
        //   if (item !== accordionItem) {
        //     item.classList.remove('is-active');
        //   }
        // });

        accordionItem.classList.toggle('is-active');
      });
    });
  });
</script>
"""

if "<!-- Accordion Script -->" not in html:
    # Append it right before the closing </body> tag if it exists, otherwise at the end.
    if '</body>' in html:
        html = html.replace('</body>', f'{script}\n</body>')
    else:
        html += script

with open('pages/verticals.html', 'w') as f:
    f.write(html)

print("Done")
