document.addEventListener('DOMContentLoaded', () => {
  // Navbar
  fetch('/components/navbar.html')
    .then((res) => res.text())
    .then((data) => {
      document.getElementById('navbar').innerHTML = data;

      // Navbar JS (your existing code)
      const btn = document.getElementById('mobile-menu-btn');
      const menu = document.getElementById('mobile-menu');

      if (btn && menu) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          menu.classList.toggle('hidden');
        });

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

        document.addEventListener('click', (e) => {
          const navbar = document.getElementById('navbar');
          if (navbar && !navbar.contains(e.target)) {
            menu.classList.add('hidden');
          }
        });
      }
    });

  // --- Simple Routing Logic ---
  function renderNotificationBar() {
    const hash = window.location.hash;
    const notificationBar = document.getElementById('notification-bar');
    if (!notificationBar) return;

    if (hash === '' || hash === '#home') {
      const savedData = JSON.parse(localStorage.getItem('nest_notification_config') || 'null');
      const text = savedData ? savedData.text : "NEST Cluster Progress Report 2025-26 is now live!";
      const pdfUrl = savedData ? savedData.pdfUrl : "/assets/docs/NEST_Report_2026.pdf";

      notificationBar.innerHTML = `
        <div class="bg-gradient-to-r from-[#7C1F1F] via-[#A82B2B] to-[#7C1F1F] text-white py-1 px-4 relative overflow-hidden group shadow-md transition-all duration-300">
          <div class="max-w-[1440px] mx-auto flex items-center justify-center flex-wrap gap-x-6 gap-y-1 text-center">
            <div class="flex items-center gap-2 whitespace-nowrap">
              <span class="bg-white text-[#7C1F1F] text-[8px] uppercase font-bold px-1.5 py-0.5 rounded shadow-sm leading-none flex items-center h-[14px]">Update</span>
              <p class="font-['Inter'] text-[12px] sm:text-[13px] font-medium tracking-wide">
                 ${text}
              </p>
            </div>
            
            <a href="${pdfUrl}" target="_blank" class="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 py-0.5 px-2.5 rounded transition-all duration-300 backdrop-blur-md group whitespace-nowrap">
              <span class="font-['Inter'] text-[10px] font-semibold uppercase tracking-tight">PDF</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="group-hover:translate-y-0.5 transition-transform">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </a>
          </div>
        </div>
      `;
      document.body.style.paddingTop = '142px';
    } else {
      notificationBar.innerHTML = '';
      document.body.style.paddingTop = '114px';
    }
  }

  // Handle Scroll Behavior for Fixed Header & Notification Bar
  window.addEventListener('scroll', () => {
    const notificationBar = document.getElementById('notification-bar');
    if (notificationBar && notificationBar.children.length > 0) {
      if (window.scrollY > 20) {
        notificationBar.style.maxHeight = '0px';
        notificationBar.style.opacity = '0';
      } else {
        notificationBar.style.maxHeight = '100px';
        notificationBar.style.opacity = '1';
      }
    }
  });

  function handleNavigation() {
    renderNotificationBar();

    const hash = window.location.hash;
    const mainContent = document.getElementById('main-content');

    // Centralized Loader HTML with Japi Icon
    const LOADER_HTML = `
      <div class="flex justify-center items-center py-40 min-h-[400px]">
        <img src="assets/icons/jopi.png" alt="Loading..." class="animate-spin h-[75px] w-[75px] object-contain">
      </div>
    `;

    // Always clear the home carousel interval conditionally when navigating to any page to prevent leaks
    if (window.heroCarouselInterval) {
      clearInterval(window.heroCarouselInterval);
      window.heroCarouselInterval = null;
    }

    if (!mainContent) return;

    if (
      hash === '#clusterformation' ||
      hash === '#clusteractivities' ||
      hash === '#visionmission' ||
      hash === '#clusterdevelopment' ||
      hash === '#leadership' ||
      hash === '#scientificteam' ||
      hash === '#executiveteam'
    ) {
      let pageName = hash.substring(1);

      // Map new hashes to existing files
      if (pageName === 'clusterdevelopment') pageName = 'clusteractivities';

      // Loader
      mainContent.innerHTML = LOADER_HTML;

      let path = '';

      // About pages
      if (pageName === 'visionmission' || pageName === 'clusteractivities') {
        path = `/pages/About/${pageName}.html`;
      }
      // Administrative pages
      else if (
        pageName === 'leadership' ||
        pageName === 'scientificteam' ||
        pageName === 'executiveteam'
      ) {
        path = `/pages/administrative/${pageName}.html`;
      }

      fetch(path)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#startups') {
      mainContent.innerHTML = LOADER_HTML;

      fetch(`/pages/startups.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#hubspoke') {
      mainContent.innerHTML = LOADER_HTML;

      fetch(`/pages/hubSpoke.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#programs') {
      mainContent.innerHTML = LOADER_HTML;

      fetch(`/pages/Program/programs.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#stp') {
      mainContent.innerHTML = LOADER_HTML;

      fetch(`/pages/Program/stp.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#ltp') {
      mainContent.innerHTML = LOADER_HTML;

      fetch(`/pages/Program/ltp.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#process') {
      mainContent.innerHTML = LOADER_HTML;

      fetch(`/pages/Program/process.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#hrd') {
      mainContent.innerHTML = LOADER_HTML;

      fetch(`/pages/Program/hrd.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#td') {
      mainContent.innerHTML = LOADER_HTML;

      fetch(`/pages/Program/td.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#incubation') {
      mainContent.innerHTML = LOADER_HTML;

      fetch(`/pages/Program/incubation.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#outreach') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/Program/outreach.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#eventcomplete') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/Program/eventcompleted/eventcomplete.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#eventcomplete1') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/Program/eventcompleted/eventcomplete1.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#eventcomplete2') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/Program/eventcompleted/eventcomplete2.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#eventcomplete3') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/Program/eventcompleted/eventcomplete3.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#eventcomplete4') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/Program/eventcompleted/eventcomplete4.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#eventcomplete5') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/Program/eventcompleted/eventcomplete5.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#verticals') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/verticals.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#event-detail') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/Program/event-detail.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#market') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/market.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#gallery') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/Media/gallery.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#newsletter') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/Media/newsletter.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#contact') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

      fetch(`/pages/contact.html`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#register') {
      mainContent.innerHTML = LOADER_HTML;
      fetch('/pages/loginregister/register.html')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#tranieeregister') {
      mainContent.innerHTML = LOADER_HTML;
      fetch('/pages/loginregister/tranieeregistration.html')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#login') {
      mainContent.innerHTML = LOADER_HTML;
      fetch('/pages/loginregister/login.html')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          // Re-initialize scripts (for OTP auto-tabbing and toggles)
          const scripts = mainContent.querySelectorAll('script');
          scripts.forEach((oldScript) => {
            const newScript = document.createElement('script');
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
          });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#artisanregister') {
      mainContent.innerHTML = LOADER_HTML;
      fetch('/pages/loginregister/artisanregistration.html')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '#entrepreneurregister') {
      mainContent.innerHTML = LOADER_HTML;
      fetch('/pages/loginregister/entrepreneurregistration.html')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });

          // Re-initialize any scripts in the fetched HTML if needed
          const scripts = mainContent.querySelectorAll('script');
          scripts.forEach((oldScript) => {
            const newScript = document.createElement('script');
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
          });

          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    } else if (hash === '' || hash === '#home') {
      if (window.heroCarouselInterval)
        clearInterval(window.heroCarouselInterval);
      mainContent.innerHTML = LOADER_HTML;
      fetch('/pages/home.html')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          if (typeof window.initHeroCarousel === 'function') {
            setTimeout(window.initHeroCarousel, 50);
          }
          const menu = document.getElementById('mobile-menu');
          if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
          }
        })
        .catch((err) => {
          console.error('Routing error:', err);
          mainContent.innerHTML =
            '<div class="text-center py-20 text-red-500 font-[\'Inter\']">Error loading content.</div>';
        });
    }
  }

  // Listen for URL changes
  window.addEventListener('hashchange', handleNavigation);

  // Check initial hash on page load
  if (window.location.hash) {
    handleNavigation();
  } else {
    window.location.hash = '#home';
    handleNavigation();
  }
  // ----------------------------

  // FOOTER ADD THIS
  fetch('/components/footer.html')
    .then((res) => res.text())
    .then((data) => {
      document.getElementById('footer').innerHTML = data;
    });

  // Global Event Delegation for STP page tabs and buttons
  document.addEventListener('click', (e) => {
    // Handle Tab Switching
    const tab = e.target.closest('.program-tab');
    if (tab) {
      document.querySelectorAll('.program-tab').forEach((t) => {
        t.classList.remove('program-tab-active', 'bg-[#5c8b6e]', 'text-white');
        t.classList.add('bg-transparent', 'text-[#1b3a28]');
      });
      tab.classList.add('program-tab-active', 'bg-[#5c8b6e]', 'text-white');
      tab.classList.remove('bg-transparent', 'text-[#1b3a28]');

      document.querySelectorAll('.program-tab-content').forEach((c) => {
        c.classList.add('hidden');
        c.classList.remove('block');
      });
      const tabId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById('tab-content-' + tabId);
      if (targetContent) {
        targetContent.classList.remove('hidden');
        targetContent.classList.add('block');
      }
    }

    // Handle View Programs Button
    const btn = e.target.closest('.view-programs-btn');
    if (btn) {
      const category = btn.getAttribute('data-category');
      sessionStorage.setItem('selectedProgramCategory', category);
      // Example of what could happen: Backend team reads sessionStorage or URL to render
      // Then redirect to /pages/programs.html using simple routing logic
      window.location.hash = '#programs';
    }
  });
});

/**
 * Universal Tab Switching for Program Categories
 * Attached to window to be accessible from dynamic HTML fragments
 */
window.switchProgramTab = function(tab) {
  // List containers
  const upcomingList = document.getElementById('upcoming-list');
  const ongoingList = document.getElementById('ongoing-list');
  const completedList = document.getElementById('completed-list');
  
  // Tab buttons
  const tabs = {
    upcoming: document.getElementById('tab-upcoming'),
    ongoing: document.getElementById('tab-ongoing'),
    completed: document.getElementById('tab-completed')
  };

  // 1. Update List Visibility
  if (upcomingList) upcomingList.classList.add('hidden');
  if (ongoingList) ongoingList.classList.add('hidden');
  if (completedList) completedList.classList.add('hidden');

  if (tab === 'upcoming' && upcomingList) upcomingList.classList.remove('hidden');
  else if (tab === 'ongoing' && ongoingList) ongoingList.classList.remove('hidden');
  else if (tab === 'completed' && completedList) completedList.classList.remove('hidden');

  // 2. Update Tab Styling
  Object.keys(tabs).forEach(key => {
    const btn = tabs[key];
    if (!btn) return;
    const icon = btn.querySelector('.tab-icon');
    const text = btn.querySelector('.tab-text');
    const indicator = btn.querySelector('.tab-indicator');
    const count = btn.querySelector('span:last-child');

    if (key === tab) {
      // Active Styles
      if (icon) {
        icon.classList.remove('text-[#677461]');
        icon.classList.add('text-[#2d5a3d]');
      }
      if (text) {
        text.classList.add('font-semibold', 'text-[#2d5a3d]');
        text.classList.remove('font-normal', 'text-[#677461]');
      }
      if (indicator) {
        indicator.classList.remove('bg-transparent');
        indicator.classList.add('bg-[#2d5a3d]');
      }
      if (count) {
        count.classList.add('font-semibold', 'text-[#2d5a3d]');
        count.classList.remove('font-normal', 'text-[#677461]');
      }
    } else {
      // Inactive Styles
      if (icon) {
        icon.classList.add('text-[#677461]');
        icon.classList.remove('text-[#2d5a3d]');
      }
      if (text) {
        text.classList.remove('font-semibold', 'text-[#2d5a3d]');
        text.classList.add('font-normal', 'text-[#677461]');
      }
      if (indicator) {
        indicator.classList.add('bg-transparent');
        indicator.classList.remove('bg-[#2d5a3d]');
      }
      if (count) {
        count.classList.remove('font-semibold', 'text-[#2d5a3d]');
        count.classList.add('font-normal', 'text-[#677461]');
      }
    }
  });
};
