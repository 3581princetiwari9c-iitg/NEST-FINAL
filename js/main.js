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
  function handleNavigation() {
    const hash = window.location.hash;
    const mainContent = document.getElementById('main-content');

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
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

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
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

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
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

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
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

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
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

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
    } else if (hash === '#incubation') {
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';

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
    } else if (hash === '' || hash === '#home') {
      if (window.heroCarouselInterval) clearInterval(window.heroCarouselInterval);
      mainContent.innerHTML =
        '<div class="flex justify-center items-center py-32"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d5a3d]"></div></div>';
        
      fetch('/pages/home.html')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load page');
          return res.text();
        })
        .then((data) => {
          mainContent.innerHTML = data;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          
          if (typeof window.initHeroCarousel === 'function') {
             // Let UI paint first
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
