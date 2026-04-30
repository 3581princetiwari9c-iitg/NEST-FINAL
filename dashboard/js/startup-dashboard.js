document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.dashboardRole && !localStorage.getItem('nest_current_user')) {
        const guard = window.NESTSupabaseApp && window.NESTSupabaseApp.ensureDashboardAuth;
        if (guard) {
            guard().then((allowed) => {
                if (allowed) window.location.reload();
            });
        } else {
            window.location.replace('index.html#login');
        }
        return;
    }

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
        '#profile': '/startupDashboard/profile.html',
        '#programs': '/startupDashboard/programs.html',
        '#mystartup': '/startupDashboard/mystartup.html',
        '#marketplace': '/startupDashboard/marketplace.html',
        '#add-product': '/startupDashboard/addproduct.html',
        '#edit-product': '/startupDashboard/addproduct.html',
        '#register': '/startupDashboard/register-startup.html',
        '#logout': 'index.html'
    };

    
    function getRouteHash() {
        if (window.location.hash) return window.location.hash;
        const path = window.location.pathname;
        if (path.startsWith('/startup/')) {
            const h = path.substring('/startup/'.length).replace(/\/+$/, '');
            if (h) return '#' + h;
        }
        return '#programs';
    }
    
    function handleNavigation() {
        const hash = getRouteHash(); // Default to programs

        if (hash === '#logout') {
            if (confirm("Do you want to logout?")) {
                if (window.NESTSupabaseApp && window.NESTSupabaseApp.logout) {
                    window.NESTSupabaseApp.logout();
                } else {
                    localStorage.removeItem('nest_current_user');
                    window.location.href = 'index.html';
                }
            } else {
                window.history.back();
            }
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
    fetch('/components/startup-sidebar.html')
        .then((res) => {
            if (!res.ok) throw new Error('Failed to load sidebar');
            return res.text();
        })
        .then((data) => {
            const sidebarContainer = document.getElementById('sidebar');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = data;

                const updateActiveSidebar = () => {
                    const currentHash = getRouteHash();
                    const links = sidebarContainer.querySelectorAll('a');
                    links.forEach(link => {
                        const href = link.getAttribute('href');
                        const hrefHash = href && href.startsWith('/startup/') ? '#' + href.substring('/startup/'.length) : href;
                        const isDefault = (currentHash === '#programs' || currentHash === '') && hrefHash === '#programs';
                        if (hrefHash === currentHash || isDefault) {
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

                window.addEventListener('popstate', () => {
                    updateActiveSidebar();
                    handleNavigation();
                });

                document.addEventListener('click', (e) => {
                    const link = e.target.closest('a');
                    if (!link) return;
                    const href = link.getAttribute('href');
                        const hrefHash = href && href.startsWith('/startup/') ? '#' + href.substring('/startup/'.length) : href;
                    if (href && href.startsWith('/startup/') && !href.endsWith('.html')) {
                        e.preventDefault();
                        window.history.pushState(null, '', href);
                        updateActiveSidebar();
                        handleNavigation();
                    }
                });
    

                
            }
        })
        .catch((err) => console.error('Sidebar error:', err));
});
