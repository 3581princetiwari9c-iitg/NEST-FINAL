document.addEventListener("DOMContentLoaded", () => {
    // Navbar
    fetch("/components/navbar.html")
        .then(res => res.text())
        .then(data => {
            document.getElementById("navbar").innerHTML = data;

            // Navbar JS (your existing code)
            const btn = document.getElementById('mobile-menu-btn');
            const menu = document.getElementById('mobile-menu');

            if (btn && menu) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.toggle('hidden');
                });

                const accordions = document.querySelectorAll('.js-accordion-toggle');
                accordions.forEach(acc => {
                    acc.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const content = acc.nextElementSibling;
                        if (content) {
                            content.classList.toggle('hidden');

                            const icon = acc.querySelector('svg');
                            if (icon) {
                                icon.classList.toggle('rotate-180');
                            }
                        }
                    });
                });

                document.addEventListener('click', (e) => {
                    const navbar = document.getElementById('navbar');
                    if (navbar && !navbar.contains(e.target)) {
                        menu.classList.add('hidden');
                    }
                });
            }
        });

    // FOOTER ADD THIS
    fetch("/components/footer.html")
        .then(res => res.text())
        .then(data => {
            document.getElementById("footer").innerHTML = data;
        });
});