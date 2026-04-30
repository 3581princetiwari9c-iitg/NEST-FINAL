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
    const fetchOptions = { cache: 'no-store' };

    // ----------------------------
    // 1. Load Navbar
    // ----------------------------
    fetch('/components/page-header.html', fetchOptions)
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
        '#marketplace': '/dashboard/admin/marketplacedashboard.html',
        '#hubmou': '/dashboard/admin/hubmou.html',
        '#add-mou': '/dashboard/admin/addmou.html',
        '#add-hub': '/dashboard/admin/addhub.html',
        '#notification': '/dashboard/admin/notificationdashboard.html',
        '#profile': '/dashboard/admin/profile.html',
        '#team': '/dashboard/admin/teammanagement.html',
        '#logout': 'index.html' // Handle logout
    };

    function ensureMarketplaceSidebarLink(sidebarContainer) {
        if (!sidebarContainer || sidebarContainer.querySelector('a[href="#marketplace"]')) return;
        const link = document.createElement('a');
        link.href = '#marketplace';
        link.className = 'flex items-center gap-3 px-4 py-3 text-[#677461] hover:bg-gray-50 hover:text-[#2d5a3d] rounded-lg transition-all duration-200 group';
        link.innerHTML = `
            <div class="w-5 h-5 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
                    <path d="M3 6h18"></path>
                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
            </div>
            <span class="text-base font-['Inter']">Marketplace</span>`;
        const hubMouButton = Array.from(sidebarContainer.querySelectorAll('button')).find((button) =>
            (button.textContent || '').toLowerCase().includes('hub & mou')
        );
        const hubMouSection = hubMouButton && hubMouButton.closest('.relative');
        if (hubMouSection && hubMouSection.parentNode) {
            hubMouSection.parentNode.insertBefore(link, hubMouSection);
            return;
        }
        const galleryLink = sidebarContainer.querySelector('a[href="#gallery"]');
        if (galleryLink) galleryLink.insertAdjacentElement('afterend', link);
        else sidebarContainer.appendChild(link);
    }

    function handleNavigation() {
        const hash = window.location.hash || '#dashboard';

        // Handle Logout specially
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

        const path = routes[hash] || routes['#dashboard'];

        if (mainContent && path !== window.location.pathname) {
            mainContent.innerHTML = '<div class="flex items-center justify-center min-h-[400px]"><div class="w-8 h-8 border-4 border-[#2d5a3d] border-t-transparent rounded-full animate-spin"></div></div>';
        }

        fetch(path, fetchOptions)
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
    fetch('/components/sidebar.html', fetchOptions)
        .then((res) => {
            if (!res.ok) throw new Error('Failed to load sidebar');
            return res.text();
        })
        .then((data) => {
            const sidebarContainer = document.getElementById('sidebar');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = data;
                ensureMarketplaceSidebarLink(sidebarContainer);

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
