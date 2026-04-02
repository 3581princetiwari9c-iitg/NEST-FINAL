function initHeroCarousel() {
  const track = document.getElementById('hero-carousel-track');
  if (!track) return;

  // Define our 5 slides data based on Figma node 17:4601
  const slidesData = [
    {
      id: 1,
      bgImage: 'https://images.unsplash.com/photo-1541888086-6ea43a139a66?q=80&w=2674&auto=format&fit=crop',
      title1: 'North Eastern',
      title2: 'Science & Technology',
      title3: '(NEST) Cluster',
      desc: 'Empowering research, innovation, and entrepreneurship across the North Eastern region. Empowering research, innovation, and entrepreneurship across the North Eastern region.'
    },
    {
      id: 2,
      bgImage: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2670&auto=format&fit=crop',
      title1: 'Innovation',
      title2: 'Through Collaboration',
      title3: 'Ecosystem',
      desc: 'Bridging the gap between academia and industry to foster sustainable technological advancement.'
    },
    {
      id: 3,
      bgImage: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2670&auto=format&fit=crop',
      title1: 'Fostering',
      title2: 'Startups & Ventures',
      title3: 'Growth',
      desc: 'Providing incubation, mentorship, and resources to the next generation of regional entrepreneurs.'
    },
    {
      id: 4,
      bgImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop',
      title1: 'Empowering',
      title2: 'Future Leaders',
      title3: 'Network',
      desc: 'Nurturing talent through specialized programs, skill development, and expert guidance.'
    },
    {
      id: 5,
      bgImage: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2670&auto=format&fit=crop',
      title1: 'Sustainable',
      title2: 'Technology Solutions',
      title3: 'Impact',
      desc: 'Driving socio-economic transformation through meaningful research and community engagement.'
    }
  ];

  // To create a seamless infinite loop, we will pad the array.
  // We will add copies of the last 2 items to the front, and copies of the first 2 items to the back.
  const loopedSlides = [
    { ...slidesData[3], isClone: true, origIndex: 3 },
    { ...slidesData[4], isClone: true, origIndex: 4 },
    ...slidesData.map((s, i) => ({ ...s, isClone: false, origIndex: i })),
    { ...slidesData[0], isClone: true, origIndex: 0 },
    { ...slidesData[1], isClone: true, origIndex: 1 }
  ];

  // Render the HTML for each slide
  track.innerHTML = loopedSlides.map((slide, index) => {
    return `
      <div class="hero-slide relative shrink-0 rounded-[36px] overflow-hidden shadow-2xl flex items-center" style="width: 1180px; height: 610px; max-width: 90vw; background-color: ${['#ef4444','#22c55e','#3b82f6','#eab308','#f97316'][slide.origIndex]};" data-index="${index}" data-orig="${slide.origIndex}">
        <!-- Text Content -->
        <div class="hero-text-content relative z-10 flex flex-col gap-[20px] sm:gap-[38px] px-[30px] sm:px-[60px] max-w-[800px] text-white">
          <div class="font-['Inter'] font-semibold leading-[1.1] text-[40px] sm:text-[65px] text-white">
            <p class="m-0">${slide.title1}</p>
            <p class="m-0 text-[#ffce65]">${slide.title2}</p>
            <p class="m-0"><span class="text-[#ffce65]">${slide.title3.split(' ')[0]} </span>${slide.title3.split(' ').slice(1).join(' ')}</p>
          </div>
          <p class="font-['Inter'] font-normal text-[16px] sm:text-[21.6px] text-white/90 leading-relaxed m-0 pr-4 sm:pr-0">
            ${slide.desc}
          </p>
        </div>
      </div>
    `;
  }).join('');

  let currentIndex = 2; // Start at index 2 (which is origIndex 0)
  const totalOriginals = 5;
  const slideElements = Array.from(track.children);
  const gap = window.innerWidth < 640 ? 24 : 40; // Matches tailwind gap
  
  function updateCarousel(instant = false) {
    if (instant) {
      track.style.transition = 'none';
    } else {
      track.style.transition = 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    const container = track.parentElement;
    const centerView = container.offsetWidth / 2;
    
    // Wait until elements are rendered to get precise width
    const slideWidth = slideElements[0].offsetWidth; 
    const totalSlideWidth = slideWidth + gap;
    
    const slideCenter = (currentIndex * totalSlideWidth) + (slideWidth / 2);
    const sidePeek = slideWidth * 0.01; // amount of side visibility
    const translateX = centerView - slideCenter + sidePeek;
    
    track.style.transform = `translateX(${translateX}px)`;

    // Update classes
    slideElements.forEach((el, i) => {
      if (i === currentIndex) {
        el.classList.add('is-active');
        
        // Manage Progress bars
        const orig = parseInt(el.getAttribute('data-orig'));
        for (let j = 1; j <= 5; j++) {
          const bar = document.getElementById(`hero-progress-${j}`);
          if (bar) {
            bar.classList.remove('progress-bar-fill');
            bar.style.width = j < (orig + 1) ? '100%' : '0%';
          }
        }
        
        const activeBar = document.getElementById(`hero-progress-${orig + 1}`);
        if (activeBar && !instant) {
          activeBar.style.width = '0%';
          // Trigger reflow to restart animation
          void activeBar.offsetWidth;
          activeBar.classList.add('progress-bar-fill');
        }

      } else {
        el.classList.remove('is-active');
      }
    });
  }

  function nextSlide() {
    currentIndex++;
    updateCarousel();

    if (currentIndex === totalOriginals + 2) {
      setTimeout(() => {
        currentIndex = 2;
        updateCarousel(true);
        
        const activeBar = document.getElementById(`hero-progress-1`);
        if (activeBar) {
           activeBar.style.width = '0%';
           void activeBar.offsetWidth;
           activeBar.classList.add('progress-bar-fill');
        }
      }, 700); 
    }
  }

  // Initial execution
  setTimeout(() => {
    updateCarousel(true);
    const activeBar = document.getElementById(`hero-progress-1`);
    if (activeBar) {
        void activeBar.offsetWidth;
        activeBar.classList.add('progress-bar-fill');
    }
  }, 50);
  
  // Handle window resize dynamically to re-center
  // Assign to window object so we can remove it on page navigation to prevent leak
  if (window.heroCarouselResizeHandler) {
      window.removeEventListener('resize', window.heroCarouselResizeHandler);
  }
  window.heroCarouselResizeHandler = () => updateCarousel(true);
  window.addEventListener('resize', window.heroCarouselResizeHandler);

  if (window.heroCarouselInterval) clearInterval(window.heroCarouselInterval);
  window.heroCarouselInterval = setInterval(nextSlide, 3000);
}

window.initHeroCarousel = initHeroCarousel;
