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
                }
            }
        })
        .catch((err) => console.error('Navbar error:', err));

    // ----------------------------
    // 2. Routing Logic
    // ----------------------------
    const routes = {
        '#profile': '/entrepreneurDashboard/profile.html',
        '#programs': '/entrepreneurDashboard/programs.html',
        '#mystartup': '/entrepreneurDashboard/mystartup.html',
        '#marketplace': '/entrepreneurDashboard/marketplace.html',
        '#add-product': '/entrepreneurDashboard/addproduct.html',
        '#edit-product': '/entrepreneurDashboard/addproduct.html',
        '#register': '/entrepreneurDashboard/register-startup.html',
        '#logout': '/index.html'
    };

    function handleNavigation() {
        const hash = window.location.hash || '#programs'; // Default to programs

        if (hash === '#logout') {
            window.location.href = '/index.html';
            return;
        }

        const path = routes[hash] || routes['#profile'];

        fetch(path)
            .then(res => {
                if (!res.ok) throw new Error('Page not found');
                return res.text();
            })
            .then(html => {
                if (mainContent) {
                    mainContent.innerHTML = html;

                    // Execute scripts
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
    fetch('/components/entrepreneur-sidebar.html')
        .then((res) => {
            if (!res.ok) throw new Error('Failed to load sidebar');
            return res.text();
        })
        .then((data) => {
            const sidebarContainer = document.getElementById('sidebar');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = data;

                const updateActiveSidebar = () => {
                    const currentHash = window.location.hash || '#programs';
                    const links = sidebarContainer.querySelectorAll('a');
                    links.forEach(link => {
                        const href = link.getAttribute('href');
                        const isDefault = (currentHash === '#programs' || currentHash === '') && href === '#programs';
                        if (href === currentHash || isDefault) {
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
                handleNavigation();

                window.addEventListener('hashchange', () => {
                    updateActiveSidebar();
                    handleNavigation();
                });
            }
        })
        .catch((err) => console.error('Sidebar error:', err));
});
