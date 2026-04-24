document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');

    // ----------------------------
    // 1. Load Navbar
    // ----------------------------
    fetch('/components/navbar.html')
        .then((res) => {
            if (!res.ok) throw new Error('Failed to load navbar');
            return res.text();
        })
        .then((data) => {
            const navbarContainer = document.getElementById('navbar');
            if (navbarContainer) {
                navbarContainer.innerHTML = data;

                // --- Navbar Interactivity ---
                const btn = document.getElementById('mobile-menu-btn');
                const menu = document.getElementById('mobile-menu');

                if (btn && menu) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        menu.classList.toggle('hidden');
                    });

                    // Mobile Accordions
                    const accordions = document.querySelectorAll('.js-accordion-toggle');
                    accordions.forEach((acc) => {
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

                    // Click outside to close mobile menu
                    document.addEventListener('click', (e) => {
                        if (navbarContainer && !navbarContainer.contains(e.target)) {
                            menu.classList.add('hidden');
                        }
                    });
                }
            }
        })
        .catch((err) => console.error('Navbar error:', err));

    // ----------------------------
    // 2. Routing Logic
    // ----------------------------
    const routes = {
        '#dashboard': '/dashboard/admin/clusterdashboard.html',
        '#programs': '/dashboard/admin/programdashboard.html',
        '#hub': '/dashboard/admin/hubdashboard.html',
        '#add-hub': '/dashboard/admin/addhub.html',
        '#create-program': '/dashboard/admin/createprogram.html',
        '#edit-program': '/dashboard/admin/editprogram.html',
        '#startups': '/dashboard/admin/startupdashboard.html',
        '#requests': '/dashboard/admin/requestdashboard.html',
        '#newsletter': '/dashboard/admin/newsletterdashboard.html',
        '#upload-newsletter': '/dashboard/admin/uploadnewsletter.html',
        '#stats': '/dashboard/admin/statschange.html',
        '#management': '/dashboard/admin/management.html',
        '#gallery': '/dashboard/admin/gallerydashboard.html',
        '#hubmou': '/dashboard/admin/hubmou.html',
        '#add-mou': '/dashboard/admin/addmou.html',
        '#add-hub': '/dashboard/admin/addhub.html',
        '#notification': '/dashboard/admin/notificationdashboard.html',
        '#profile': '/dashboard/admin/profile.html',
        '#team': '/dashboard/admin/teammanagement.html',
        '#logout': '/index.html' // Handle logout
    };

    function handleNavigation() {
        const hash = window.location.hash || '#dashboard';

        // Handle Logout specially
        if (hash === '#logout') {
            window.location.href = '/index.html';
            return;
        }

        const path = routes[hash] || routes['#dashboard'];

        fetch(path, { cache: 'no-store' })
            .then(res => {
                if (!res.ok) throw new Error('Page not found');
                return res.text();
            })
            .then(html => {
                if (mainContent) {
                    mainContent.innerHTML = html;

                    // Execute all script tags found in the fetched HTML
                    const scripts = mainContent.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                        oldScript.parentNode.replaceChild(newScript, oldScript);
                    });

                    window.scrollTo(0, 0);
                }
            })
            .catch(err => {
                console.error('Fetch error:', err);
                if (mainContent) {
                    mainContent.innerHTML = '<div class="p-8 text-red-500">Error loading page. Please try again.</div>';
                }
            });
    }

    // ----------------------------
    // 3. Load Sidebar
    // ----------------------------
    fetch('/components/sidebar.html')
        .then((res) => {
            if (!res.ok) throw new Error('Failed to load sidebar');
            return res.text();
        })
        .then((data) => {
            const sidebarContainer = document.getElementById('sidebar');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = data;

                // Handle active states based on hash
                const updateActiveSidebar = () => {
                    const currentHash = window.location.hash || '#dashboard';
                    const links = sidebarContainer.querySelectorAll('a');
                    links.forEach(link => {
                        const href = link.getAttribute('href');
                        const isDashboardDefault = (currentHash === '#dashboard' || currentHash === '') && href === '#dashboard';
                        if (href === currentHash || isDashboardDefault) {
                            link.classList.add('bg-[#f1ffee]', 'text-[#2d5a3d]', 'font-bold');
                            link.classList.remove('text-[#677461]', 'hover:bg-gray-50');
                            const svg = link.querySelector('svg');
                            if (svg) svg.classList.add('text-[#2d5a3d]');
                        } else {
                            link.classList.remove('bg-[#f1ffee]', 'text-[#2d5a3d]', 'font-bold');
                            link.classList.add('text-[#677461]', 'hover:bg-gray-50');
                            const svg = link.querySelector('svg');
                            if (svg) svg.classList.remove('text-[#2d5a3d]');
                        }
                    });
                };

                updateActiveSidebar();

                // Initial load of content
                handleNavigation();

                window.addEventListener('hashchange', () => {
                    updateActiveSidebar();
                    handleNavigation();
                });
            }
        })
        .catch((err) => console.error('Sidebar error:', err));
});
