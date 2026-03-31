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

    // --- Simple Routing Logic ---
    function handleNavigation() {
        const hash = window.location.hash;
        const mainContent = document.getElementById("main-content");

        if (!mainContent) return;

        if (hash === "#clusterformation" || hash === "#clusteractivities" || hash === "#leadership" || hash === "#scientificteam" || hash === "#executiveteam") {
            const pageName = hash.substring(1);
            // Show a simple loading state while fetching
            mainContent.innerHTML = '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

            fetch(`/pages/About/${pageName}.html`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load page");
                    return res.text();
                })
                .then(data => {
                    mainContent.innerHTML = data;
                    window.scrollTo({ top: 0, behavior: 'smooth' });

                    const menu = document.getElementById('mobile-menu');
                    if (menu && !menu.classList.contains('hidden')) {
                        menu.classList.add('hidden');
                    }
                })
                .catch(err => {
                    console.error("Routing error:", err);
                    mainContent.innerHTML = '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
                });
        } else if (hash === "#startups") {
            mainContent.innerHTML = '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';
            
            fetch(`/pages/startups.html`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load page");
                    return res.text();
                })
                .then(data => {
                    mainContent.innerHTML = data;
                    window.scrollTo({ top: 0, behavior: 'smooth' });

                    const menu = document.getElementById('mobile-menu');
                    if (menu && !menu.classList.contains('hidden')) {
                        menu.classList.add('hidden');
                    }
                })
                .catch(err => {
                    console.error("Routing error:", err);
                    mainContent.innerHTML = '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
                });
        } else if (hash === "" || hash === "#home") {
            // For now, if no hash, just restore the placeholder or load a home page in the future
            mainContent.innerHTML = '<div class="h-[800px] flex items-center justify-center font-[\'Inter\'] text-[#677461]">Home Page Placeholder (Add home component later)</div>';
        }
    }

    // Listen for URL changes
    window.addEventListener("hashchange", handleNavigation);

    // Check initial hash on page load
    if (window.location.hash) {
        handleNavigation();
    }
    // ----------------------------

    // FOOTER ADD THIS
    fetch("/components/footer.html")
        .then(res => res.text())
        .then(data => {
            document.getElementById("footer").innerHTML = data;
        });
});