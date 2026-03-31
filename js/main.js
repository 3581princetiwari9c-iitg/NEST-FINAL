document.addEventListener("DOMContentLoaded", () => {
    fetch("components/navbar.html")
        .then(res => res.text())
        .then(data => {
            document.getElementById("navbar").innerHTML = data;

            // Initialization for Mobile Navbar 
            const btn = document.getElementById('mobile-menu-btn');
            const menu = document.getElementById('mobile-menu');

            if (btn && menu) {
                // 1. Toggle mobile menu on clicking hamburger
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Avoid triggering document click
                    menu.classList.toggle('hidden');
                });

                // 2. Accordion logic for mobile dropdowns
                const accordions = document.querySelectorAll('.js-accordion-toggle');
                accordions.forEach(acc => {
                    acc.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Find the dropdown sub-container
                        const content = acc.nextElementSibling;
                        if (content) {
                            content.classList.toggle('hidden');

                            // Optional: Rotate the SVG caret
                            const icon = acc.querySelector('svg');
                            if (icon) {
                                icon.classList.toggle('rotate-180');
                                icon.classList.add('transition-transform');
                            }
                        }
                    });
                });

                // 3. Close the menu when clicking anywhere else
                document.addEventListener('click', (e) => {
                    const navbar = document.getElementById('navbar');
                    if (navbar && !navbar.contains(e.target)) {
                        if (!menu.classList.contains('hidden')) {
                            menu.classList.add('hidden');
                        }
                    }
                });
            }
        });
});