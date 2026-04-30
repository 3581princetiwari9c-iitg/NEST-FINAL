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
    fetch('/components/page-header.html')
        .then(res => res.text())
        .then(data => {
            const navbarContainer = document.getElementById('navbar');
            if (navbarContainer) {
                navbarContainer.innerHTML = data;
                const btn = document.getElementById('mobile-menu-btn');
                const menu = document.getElementById('mobile-menu');
                if (btn && menu) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        menu.classList.toggle('hidden');
                    });
                }
            }
        });

    const routes = {
        '#profile': '/entrepreneurDashboard/profile.html',
        '#programs': '/entrepreneurDashboard/programs.html',
        '#marketplace': '/entrepreneurDashboard/marketplace.html',
        '#add-product': '/entrepreneurDashboard/addproduct.html',
        '#edit-product': '/entrepreneurDashboard/addproduct.html',
        '#myidea': '/entrepreneurDashboard/myidea.html',
        '#logout': 'index.html'
    };

    function handleNavigation() {
        const hash = window.location.hash || '#programs';
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
            .then(res => { if (!res.ok) throw new Error('Page not found'); return res.text(); })
            .then(html => {
                if (mainContent) {
                    mainContent.innerHTML = html;
                    const scripts = mainContent.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                        oldScript.parentNode.replaceChild(newScript, oldScript);
                    });
                    window.scrollTo(0, 0);
                }
            });
    }

    fetch('/components/entrepreneur-sidebar.html')
        .then(res => res.text())
        .then(data => {
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
                window.addEventListener('hashchange', () => { updateActiveSidebar(); handleNavigation(); });
            }
        });
});
