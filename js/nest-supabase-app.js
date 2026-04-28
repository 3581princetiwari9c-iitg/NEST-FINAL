(function () {
  const FALLBACK_IMAGE = 'https://placehold.co/800x480/f1ffee/2d5a3d?text=NEST';
  const FALLBACK_AVATAR = '/assets/logo/depositphotos_239470246-stock-illustration-user-sign-icon-person-symbol.jpg';
  const REALTIME_TABLES = [
    'programs',
    'startups',
    'marketplace_products',
    'requests',
    'newsletters',
    'site_stats',
    'gallery_items',
    'hubs',
    'mous',
    'team_members',
    'notifications'
  ];
  const DEMO_USERS = {
    'admin@nest.test': {
      password: 'Admin@123',
      role: 'admin',
      name: 'Demo Admin',
      redirect: 'admin.html#dashboard'
    },
    'entrepreneur@nest.test': {
      password: 'Test@123',
      role: 'entrepreneur',
      name: 'Demo Entrepreneur',
      redirect: 'entrepreneur.html#myidea'
    },
    'artisan@nest.test': {
      password: 'Test@123',
      role: 'artisan',
      name: 'Demo Artisan',
      redirect: 'artisan.html#marketplace'
    },
    'startup@nest.test': {
      password: 'Test@123',
      role: 'startup',
      name: 'Demo Startup Founder',
      redirect: 'startup.html#mystartup'
    },
    'trainee@nest.test': {
      password: 'Test@123',
      role: 'trainee',
      name: 'Demo Trainee',
      redirect: 'trainee.html#programs'
    }
  };

  let currentPageKey = '';
  let initTimer = null;
  let realtimeStarted = false;
  let teamState = {
    team: 'leadership',
    category: 'grassroots',
    editingId: null,
    photoFile: null,
    photoUrl: null
  };
  let defaultGalleryCache = null;

  function supabase() {
    return window.NESTSupabase && window.NESTSupabase.client;
  }

  function mainRoot() {
    return document.getElementById('main-content');
  }

  function text(el) {
    return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function html(value) {
    return clean(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function toKey(value) {
    return lower(value)
      .replace(/\([^)]*\)/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function titleCase(value) {
    return clean(value)
      .replace(/[_-]+/g, ' ')
      .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  function formatDate(value) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatDateRange(row) {
    if (row.start_date && row.end_date) return `${formatDate(row.start_date)} - ${formatDate(row.end_date)}`;
    if (row.start_date) return formatDate(row.start_date);
    return row.duration || 'Date pending';
  }

  function formatDateAndDuration(row) {
    const range = formatDateRange(row);
    return row.duration && range !== row.duration ? `${range} (${row.duration})` : range;
  }

  function jsonList(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? clean(item) : clean(item && (item.text || item.title || item.description))))
        .filter(Boolean);
    }
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return jsonList(parsed);
      } catch (error) {
        return clean(value) ? [clean(value)] : [];
      }
    }
    return [];
  }

  function jsonHighlights(value) {
    const list = Array.isArray(value) ? value : [];
    return list
      .map((item) => {
        if (typeof item === 'string') return { title: item, body: '' };
        return {
          title: clean(item && (item.title || item.heading || item.name)),
          body: clean(item && (item.body || item.text || item.description))
        };
      })
      .filter((item) => item.title || item.body);
  }

  function setTextById(root, id, value) {
    const element = root.querySelector(`#${id}`);
    if (element) element.textContent = value;
  }

  function listHtml(items, fallback) {
    const values = items.length ? items : fallback;
    return values.map((item) => `<li>${html(item)}</li>`).join('');
  }

  function participantLabel(row) {
    if (!row.participant_count) return 'Seats available';
    const value = clean(row.participant_count);
    return /^max/i.test(value) ? value : `Max ${value} Seats`;
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === '') return 'Price on request';
    const amount = Number(value);
    if (Number.isNaN(amount)) return html(value);
    return `Rs. ${amount.toLocaleString('en-IN')}`;
  }

  function readStore(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function rememberCurrentUser(role, fields) {
    const user = {
      role,
      name: fields.full_name || fields.founder_owner_name || fields.startup_name || fields.email_address || `${titleCase(role)} User`,
      email: fields.email_address || '',
      phone: fields.phone_number || ''
    };
    writeStore('nest_current_user', user);
    return user;
  }

  function statusBadge(status) {
    const value = lower(status || 'pending');
    const config = {
      pending: ['bg-[#FFF7ED]', 'text-[#EA580C]', 'Pending Approval'],
      approved: ['bg-[#ECFDF5]', 'text-[#16a34a]', 'Approved'],
      rejected: ['bg-[#FEF2F2]', 'text-[#b04a4a]', 'Rejected']
    }[value] || ['bg-gray-100', 'text-[#677461]', titleCase(value)];
    return `<span class="${config[0]} ${config[1]} px-4 py-1.5 rounded-full font-['Inter'] font-semibold text-[13px] border border-current/20">${config[2]}</span>`;
  }

  function statusMessage(status, subject) {
    const value = lower(status || 'pending');
    if (value === 'approved') return `${subject} is approved and visible on the public website.`;
    if (value === 'rejected') return `${subject} was rejected by admin and is not visible on the public website.`;
    return `${subject} is pending admin approval. It will appear publicly only after approval.`;
  }

  function selectedText(select) {
    if (!select) return '';
    const selected = select.selectedOptions && select.selectedOptions[0];
    return clean(selected ? selected.textContent : select.value);
  }

  function setSelect(select, value) {
    if (!select || !value) return;
    const wanted = lower(value);
    Array.from(select.options).some((option) => {
      if (lower(option.value) === wanted || lower(option.textContent) === wanted) {
        select.value = option.value;
        return true;
      }
      return false;
    });
  }

  function dataId(event) {
    const control = event.target.closest('[data-id]');
    return control && control.dataset.id;
  }

  function showToast(message, type) {
    const old = document.getElementById('nest-supabase-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'nest-supabase-toast';
    toast.className = `fixed bottom-6 right-6 z-[9999] max-w-sm rounded-[12px] px-5 py-4 font-['Inter'] text-sm shadow-xl ${type === 'error' ? 'bg-[#b04a4a] text-white' : 'bg-[#1b3a28] text-white'
      }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function showModal(message) {
    const modal = document.getElementById('success-modal');
    const modalContent = document.getElementById('modal-content');
    const paragraph = modal && modal.querySelector('p');
    if (paragraph && message) paragraph.textContent = message;
    if (!modal) {
      showToast(message || 'Saved successfully.');
      return;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (modalContent) {
      setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
      }, 10);
    }
  }

  async function rows(table, build) {
    let query = supabase().from(table).select('*');
    if (build) query = build(query);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function single(table, id) {
    const { data, error } = await supabase().from(table).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function insertRow(table, payload) {
    const { data, error } = await supabase().from(table).insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function updateRow(table, id, payload) {
    const { data, error } = await supabase().from(table).update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function deleteRow(table, id) {
    const { error } = await supabase().from(table).delete().eq('id', id);
    if (error) throw error;
  }

  async function upload(file, folder) {
    return window.NESTSupabase.uploadFile(file, folder);
  }

  function findGrid(root, selectorHint) {
    if (selectorHint) {
      const direct = root.querySelector(selectorHint);
      if (direct) return direct;
    }
    const candidates = Array.from(root.querySelectorAll('div')).filter((el) => {
      const cls = el.className || '';
      return typeof cls === 'string' && cls.includes('flex-wrap') && cls.includes('items-stretch');
    });
    return candidates[candidates.length - 1] || null;
  }

  function setCounterText(root, label, value) {
    const labelEl = Array.from(root.querySelectorAll('span, h3')).find((el) => lower(text(el)) === lower(label));
    const box = labelEl && labelEl.parentElement;
    const valueEl = box && Array.from(box.querySelectorAll('span, p')).find((el) => el !== labelEl && /\d/.test(text(el)));
    if (valueEl) valueEl.textContent = value;
  }

  function markContentUpdated(table) {
    try {
      localStorage.setItem('nest_content_updated_at', JSON.stringify({ table, time: Date.now() }));
    } catch (error) {
      console.warn('Could not broadcast content update:', error);
    }
  }

  function galleryKey(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin ? decodeURIComponent(parsed.pathname).toLowerCase() : parsed.href.toLowerCase();
    } catch (error) {
      return String(url).toLowerCase();
    }
  }

  function extractDefaultGalleryItems(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll('img'))
      .filter((image) => (image.getAttribute('src') || '').includes('assets/programpic'))
      .map((image, index) => ({
        id: `website-gallery-${index}`,
        title: image.getAttribute('alt') || `Gallery image ${index + 1}`,
        caption: '',
        image_url: image.getAttribute('src'),
        sort_order: 1000 + index,
        is_default_gallery: true
      }));
  }

  async function defaultGalleryItems(root) {
    const publicGalleryGrid = root && root.querySelector('#public-gallery-grid');
    const inPageItems = publicGalleryGrid ? extractDefaultGalleryItems(publicGalleryGrid) : [];
    if (inPageItems.length) {
      defaultGalleryCache = inPageItems;
      return inPageItems;
    }
    if (defaultGalleryCache && defaultGalleryCache.length) return defaultGalleryCache;
    try {
      const response = await fetch('/pages/Media/gallery.html', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load website gallery defaults.');
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      defaultGalleryCache = extractDefaultGalleryItems(doc);
      return defaultGalleryCache;
    } catch (error) {
      console.warn('Could not load default gallery images:', error);
      return [];
    }
  }

  async function galleryItems(root) {
    const [databaseItems, websiteItems] = await Promise.all([
      rows('gallery_items', (q) => q.order('sort_order').order('created_at', { ascending: false })),
      defaultGalleryItems(root)
    ]);
    const seen = new Set();
    return [...databaseItems, ...websiteItems].filter((item) => {
      const key = galleryKey(item.image_url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function collectLabeledFields(scope, options) {
    const includeHidden = options && options.includeHidden;
    const fields = {};
    Array.from(scope.querySelectorAll('label')).forEach((label) => {
      const wrapper = label.closest('div') || label.parentElement;
      const control = wrapper && wrapper.querySelector('input:not([type="file"]), textarea, select');
      if (!control || control.type === 'password' || (!includeHidden && control.closest('.hidden'))) return;
      const key = toKey(text(label));
      fields[key] = control.tagName === 'SELECT' ? selectedText(control) : clean(control.value);
    });
    return fields;
  }

  function controls(root) {
    return Array.from(root.querySelectorAll('input:not([type="file"]), select, textarea')).filter(
      (control) => control.type !== 'password'
    );
  }

  function formControls(form) {
    return Array.from(form.querySelectorAll('input, select, textarea')).filter((control) => {
      const type = lower(control.type);
      return !control.disabled && !['button', 'submit', 'reset', 'hidden', 'file'].includes(type);
    });
  }

  function isVisibleControl(control) {
    if (control.closest('.hidden, [hidden]')) return false;
    const style = window.getComputedStyle(control);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = control.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return clean(value).replace(/"/g, '\\"');
  }

  function controlLabel(control) {
    const explicit = control.id ? document.querySelector(`label[for="${cssEscape(control.id)}"]`) : null;
    if (explicit) return text(explicit);
    const wrapper = control.closest('div');
    const label = wrapper && wrapper.querySelector('label');
    return text(label) || clean(control.placeholder || control.getAttribute('aria-label'));
  }

  function isOptionalControl(control) {
    const label = `${controlLabel(control)} ${control.placeholder || ''}`;
    return lower(label).includes('optional');
  }

  function markInvalidControl(control) {
    control.classList.add('ring-2', 'ring-[#b04a4a]', 'border-[#b04a4a]');
    setTimeout(() => control.classList.remove('ring-2', 'ring-[#b04a4a]', 'border-[#b04a4a]'), 2500);
    if (typeof control.focus === 'function') control.focus();
  }

  function controlIsEmpty(control) {
    if (control.tagName === 'SELECT') {
      const selected = selectedText(control);
      return !clean(control.value) || !selected || lower(selected).startsWith('select ');
    }
    if (control.type === 'checkbox' || control.type === 'radio') return !control.checked;
    return !clean(control.value);
  }

  function validateRegistrationForm(form, options) {
    const visibleOnly = options && options.visibleOnly;
    const candidates = formControls(form).filter((control) => !isOptionalControl(control) && (!visibleOnly || isVisibleControl(control)));
    const missing = candidates.find(controlIsEmpty);
    if (missing) {
      markInvalidControl(missing);
      throw new Error('Please fill all required registration fields before continuing.');
    }
    const passwords = candidates.filter((control) => control.type === 'password');
    const confirm = passwords.find((control) => /confirm/i.test(`${control.id || ''} ${control.name || ''} ${control.placeholder || ''} ${controlLabel(control)}`));
    const password = passwords.find((control) => control !== confirm);
    if (password && confirm && clean(password.value) !== clean(confirm.value)) {
      markInvalidControl(confirm);
      throw new Error('Password and confirm password must match.');
    }
  }

  function deriveProgramStatus(startDate, endDate) {
    if (!startDate) return 'upcoming';
    const now = new Date();
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;
    if (Number.isNaN(start.getTime())) return 'upcoming';
    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
    return 'ongoing';
  }

  function normalizeProgramStatus(row) {
    const status = lower(row && row.status);
    if (['upcoming', 'ongoing', 'completed'].includes(status)) return status;
    return deriveProgramStatus(row && row.start_date, row && row.end_date);
  }

  function dateValue(value, fallback) {
    const time = new Date(value || '').getTime();
    return Number.isNaN(time) ? fallback : time;
  }

  function sortProgramsForStatus(programs, status) {
    return [...programs].sort((a, b) => {
      if (status === 'completed') {
        return dateValue(b.end_date || b.start_date, 0) - dateValue(a.end_date || a.start_date, 0);
      }
      const primary = dateValue(a.start_date, Number.MAX_SAFE_INTEGER) - dateValue(b.start_date, Number.MAX_SAFE_INTEGER);
      if (primary !== 0) return primary;
      return dateValue(b.created_at, 0) - dateValue(a.created_at, 0);
    });
  }

  function estimateEndDate(startDate, duration) {
    if (!startDate || !duration) return null;
    const match = clean(duration).match(/(\d+)/);
    if (!match) return null;
    const date = new Date(startDate);
    if (Number.isNaN(date.getTime())) return null;
    date.setDate(date.getDate() + Math.max(Number(match[1]) - 1, 0));
    return date.toISOString().slice(0, 10);
  }

  function statusColor(status) {
    const name = lower(status);
    if (name === 'approved' || name === 'ongoing' || name === 'active' || name === 'published') return 'text-[#16a34a]';
    if (name === 'pending' || name === 'upcoming') return 'text-[#2563eb]';
    if (name === 'rejected') return 'text-[#b04a4a]';
    return 'text-[#64748b]';
  }

  function programCard(row, isDashboard = false) {
    const status = normalizeProgramStatus(row);

    let actionHtml = '';
    let categoryBg = 'bg-[#f1ffee]';
    let categoryText = 'text-[#1b3a28]';
    let progressHtml = '';

    if (status === 'upcoming') {
      categoryBg = 'bg-[#ffdcc5]';
      categoryText = 'text-[#653d1e]';
      if (isDashboard) {
        actionHtml = `
            <button disabled class="bg-gray-400 cursor-not-allowed transition-colors flex items-center justify-center gap-[10px] h-[43px] px-[22px] py-[12px] rounded-[38px] text-white font-['Inter'] font-semibold text-[15px] md:text-[16px] w-full md:w-max group">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              Registered
            </button>`;
      } else {
        actionHtml = `
            <div class="bg-[#2d5a3d] hover:bg-[#1f422c] transition-colors flex items-center justify-center gap-[10px] h-[43px] px-[22px] py-[12px] rounded-[38px] text-white font-['Inter'] font-semibold text-[15px] md:text-[16px] w-full md:w-max group">
              Register Now
              <svg class="w-[18px] h-[18px] transform rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
            </div>`;
      }
      progressHtml = `
          <div class="flex flex-col gap-[8px] w-full mt-auto pt-[2px] -mt-[5px]">
            <div class="flex justify-between items-center w-full">
              <span class="font-['Inter'] font-semibold text-[#464e42] text-[13px] md:text-[14px] uppercase tracking-wide">Registration Process</span>
              <span class="event-slots font-['Inter'] font-medium text-[#677461] text-[13px] md:text-[14px]">0 / ${html(row.participant_count || '15')} spots filled</span>
            </div>
            <div class="w-full bg-[#dedede] h-[6px] rounded-[13px] overflow-hidden">
              <div class="event-progress bg-[#78a877] h-full rounded-full transition-all duration-500 ease-out" style="width: 10%"></div>
            </div>
          </div>`;
    } else if (status === 'ongoing') {
      categoryBg = 'bg-[#e0e7ff]';
      categoryText = 'text-[#3730a3]';
      actionHtml = `
            <div class="bg-[#1e4456] hover:bg-[#15313d] transition-colors flex items-center justify-center gap-[10px] h-[43px] px-[22px] py-[12px] rounded-[38px] text-white font-['Inter'] font-semibold text-[15px] md:text-[16px] w-full md:w-max group">
              View Details
              <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </div>`;
      progressHtml = `
          <div class="flex flex-col gap-[8px] w-full mt-auto pt-[2px] -mt-[5px]">
            <div class="flex justify-between items-center w-full">
              <span class="font-['Inter'] font-semibold text-[#464e42] text-[13px] md:text-[14px] uppercase tracking-wide">PROGRAM IN PROGRESS</span>
              <span class="event-slots font-['Inter'] font-medium text-[#677461] text-[13px] md:text-[14px]">Active Participants</span>
            </div>
            <div class="w-full bg-[#dedede] h-[6px] rounded-[13px] overflow-hidden">
              <div class="event-progress bg-[#3b82f6] h-full rounded-full transition-all duration-500 ease-out" style="width: 80%"></div>
            </div>
          </div>`;
    } else {
      categoryBg = 'bg-[#f3f4f6]';
      categoryText = 'text-[#4b5563]';
      actionHtml = `
            <div class="flex flex-wrap items-center gap-[12px] w-full md:w-auto">
              <div class="bg-[#f3f4f6] text-[#4b5563] cursor-default flex items-center justify-center gap-[10px] h-[43px] px-[22px] py-[12px] rounded-[38px] font-['Inter'] font-semibold text-[15px] md:text-[16px] w-full md:w-max group">
                <svg class="w-5 h-5 text-[#4b5563]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Completed
              </div>
              <div class="bg-[#1e4456] hover:bg-[#15313d] transition-colors flex items-center justify-center gap-[10px] h-[43px] px-[22px] py-[12px] rounded-[38px] text-white font-['Inter'] font-semibold text-[15px] md:text-[16px] w-full md:w-max group">
                View Details
                <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </div>
            </div>`;
      progressHtml = `
          <div class="flex flex-col gap-[8px] w-full mt-auto pt-[2px] -mt-[5px]">
            <div class="flex justify-between items-center w-full">
              <span class="font-['Inter'] font-semibold text-[#464e42] text-[13px] md:text-[14px] uppercase tracking-wide">PROGRAM COMPLETED</span>
              <span class="event-slots font-['Inter'] font-medium text-[#677461] text-[13px] md:text-[14px]">Completed</span>
            </div>
            <div class="w-full bg-[#dedede] h-[6px] rounded-[13px] overflow-hidden">
              <div class="event-progress bg-[#22c55e] h-full rounded-full transition-all duration-500 ease-out" style="width: 100%"></div>
            </div>
          </div>`;
    }

    return `
      <a href="#event-detail" data-program-id="${html(row.id)}" class="program-card ${status} flex flex-col md:flex-row h-auto md:h-[342px] w-full max-w-[1073px] mx-auto overflow-hidden relative rounded-[24px] bg-white shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-[#f3f4f6] transition-all duration-300 hover:shadow-[0px_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 cursor-pointer block">
        <div class="w-full md:w-[319px] shrink-0 h-[250px] md:h-full relative overflow-hidden bg-gray-100 rounded-t-[24px] md:rounded-tr-none md:rounded-l-[24px]">
          <img class="absolute inset-0 w-full h-full object-cover" src="${html(row.image_url || FALLBACK_IMAGE)}" alt="${html(row.title)}">
        </div>
        <div class="flex-1 flex flex-col justify-center p-[20px] md:p-[24px] gap-[16px] md:gap-[20px] bg-white">
          <div class="${categoryBg} inline-flex items-center justify-center px-[12px] py-[4px] rounded-[23px] w-max mt-[5px]">
            <span class="font-['Inter'] font-medium ${categoryText} text-[15px] md:text-[16px]">${html(row.category || 'NEST Program')}</span>
          </div>
          <div class="flex flex-col gap-[10px] md:gap-[12px] w-full">
            <h3 class="font-['Inter'] font-bold text-[#1b3a28] text-[20px] md:text-[22px] leading-snug">${html(row.title)}</h3>
            <div class="flex flex-wrap gap-x-[16px] md:gap-x-[24px] gap-y-[8px] items-center w-full">
              <div class="flex items-center gap-[6px]">
                <svg class="w-[16px] h-[16px] text-[#677461]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span class="font-['Inter'] font-normal text-[#677461] text-[13px] md:text-[14px]">${html(formatDateRange(row))}</span>
              </div>
              <div class="flex items-center gap-[6px]">
                <svg class="w-[16px] h-[16px] text-[#677461]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <span class="font-['Inter'] font-normal text-[#677461] text-[13px] md:text-[14px]">${html(row.location || 'Venue pending')}</span>
              </div>
            </div>
          </div>
          <p class="font-['Inter'] font-normal text-[#464e42] text-[15px] md:text-[16px] leading-relaxed line-clamp-3 md:line-clamp-none">${html(row.description || row.tagline || '')}</p>
          <div class="mt-1">
            ${actionHtml}
          </div>
          ${progressHtml}
        </div>
      </a>
    `;
  }

  function dashboardProgramStatusText(row) {
    const status = normalizeProgramStatus(row);
    if (status === 'completed') return 'Event completed';
    if (status === 'ongoing') return 'Program is currently under progress';
    return `Program starts on ${formatDate(row.start_date)}`;
  }

  function dashboardProgramCard(row, activeStatus) {
    const status = normalizeProgramStatus(row);
    const hidden = status === activeStatus ? '' : ' hidden';
    const instructor = row.instructor || row.speaker || row.coordinator || 'NEST Team';
    const statusIcon =
      status === 'completed'
        ? `<svg class="w-4 h-4 text-[#2d5a3d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
        : `<span class="w-2 h-2 rounded-full bg-[#2d5a3d]${status === 'ongoing' ? ' animate-pulse' : ''}"></span>`;
    return `
      <a href="index.html#event-detail" data-program-id="${html(row.id)}" class="program-card ${html(status)}${hidden} flex flex-col md:flex-row h-auto md:h-[342px] w-full max-w-[1073px] mx-auto overflow-hidden relative rounded-[24px] bg-white shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-[#f3f4f6] transition-all duration-300 hover:shadow-[0px_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 cursor-pointer block">
        <div class="w-full md:w-[319px] shrink-0 h-[250px] md:h-full relative overflow-hidden bg-gray-100 rounded-t-[24px] md:rounded-tr-none md:rounded-l-[24px]">
          <img class="event-image absolute inset-0 w-full h-full object-cover" src="${html(row.image_url || FALLBACK_IMAGE)}" alt="${html(row.title)}">
        </div>
        <div class="flex-1 flex flex-col justify-center p-[20px] md:p-[24px] gap-[16px] md:gap-[20px] bg-white text-left">
          <div class="bg-[#ffdcc5] inline-flex items-center justify-center px-[12px] py-[4px] rounded-[23px] w-max mt-[5px]">
            <span class="event-category font-['Inter'] font-medium text-[#653d1e] text-[15px] md:text-[16px]">${html(row.category || 'NEST Program')}</span>
          </div>
          <div class="flex flex-col gap-[10px] md:gap-[12px] w-full">
            <h3 class="event-title font-['Inter'] font-bold text-[#1b3a28] text-[20px] md:text-[22px] leading-snug">${html(row.title)}</h3>
            <div class="flex flex-wrap gap-x-[16px] md:gap-x-[24px] gap-y-[8px] items-center w-full">
              <div class="flex items-center gap-[6px]">
                <svg class="w-[16px] h-[16px] text-[#677461]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span class="event-date font-['Inter'] font-normal text-[#677461] text-[13px] md:text-[14px]">${html(formatDateRange(row))}</span>
              </div>
              <div class="flex items-center gap-[6px]">
                <svg class="w-[16px] h-[16px] text-[#677461]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <span class="event-location font-['Inter'] font-normal text-[#677461] text-[13px] md:text-[14px]">${html(row.location || 'Venue pending')}</span>
              </div>
              <div class="flex items-center gap-[6px]">
                <svg class="w-[16px] h-[16px] text-[#677461]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <span class="event-instructor font-['Inter'] font-normal text-[#677461] text-[13px] md:text-[14px]">${html(instructor)}</span>
              </div>
            </div>
          </div>
          <p class="event-description font-['Inter'] font-normal text-[#464e42] text-[15px] md:text-[16px] line-clamp-3 md:line-clamp-none leading-relaxed text-left">
            ${html(row.description || row.tagline || 'Program details will be updated soon.')}
          </p>
          <div class="mt-auto pt-[4px]">
            <span class="font-['Inter'] font-semibold text-[#2d5a3d] text-[14px] flex items-center gap-2">
              ${statusIcon}
              ${html(dashboardProgramStatusText(row))}
            </span>
          </div>
        </div>
      </a>`;
  }

  function startupCard(row) {
    return `
      <div class="bg-white border border-[#f3f4f6] flex flex-col gap-[28px] items-center justify-between p-[24px] rounded-[24px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] w-full sm:w-[calc(50%-18px)] lg:w-[calc(33.333%-24px)] max-w-[390px] hover:shadow-md transition-shadow">
        <div class="flex flex-col gap-[14px] items-center w-full">
          <h3 class="font-['Inter'] font-semibold leading-tight text-[#1b3a28] text-[22px] text-center">${html(row.name)}</h3>
          <div class="bg-[#f1ffee] flex items-center justify-center px-[12px] py-[6px] rounded-[23px]">
            <span class="font-['Inter'] font-medium text-[#1b3a28] text-[16px] text-center whitespace-nowrap">${html(row.category || 'Startup')}</span>
          </div>
        </div>
        <div class="flex-1 flex items-center justify-center overflow-hidden w-full min-h-[93px]">
          <img src="${html(row.logo_url || FALLBACK_IMAGE)}" alt="${html(row.name)} logo" class="max-h-[93px] w-auto max-w-[211px] object-contain pointer-events-none">
        </div>
        <div class="flex items-center justify-between w-full max-w-[320px]">
          <div class="flex flex-col gap-[7px] items-center justify-center flex-1">
            <span class="font-['Inter'] font-normal text-[#677461] text-[14px] leading-none">Established</span>
            <span class="font-['Inter'] font-medium text-[#1b3a28] text-[20px] leading-none">${html(row.established_year || 'NA')}</span>
          </div>
          <div class="bg-[#d9d9d9] h-[37px] rounded-[3px] w-[2px]"></div>
          <div class="flex flex-col gap-[7px] items-center justify-center flex-1">
            <span class="font-['Inter'] font-normal text-[#677461] text-[14px] leading-none text-center">Funding Raised</span>
            <span class="font-['Inter'] font-medium text-[#1b3a28] text-[20px] leading-none">${html(row.funding_raised || 'NA')}</span>
          </div>
          <div class="bg-[#d9d9d9] h-[37px] rounded-[3px] w-[2px]"></div>
          <div class="flex flex-col gap-[7px] items-center justify-center flex-1">
            <span class="font-['Inter'] font-normal text-[#677461] text-[14px] leading-none">State</span>
            <span class="font-['Inter'] font-medium text-[#1b3a28] text-[20px] leading-none truncate max-w-[90px]">${html(row.state || 'NA')}</span>
          </div>
        </div>
        <a href="${html(row.website_url || '#')}" target="_blank" class="bg-[#2d5a3d] border border-[#e5e5e5] flex items-center justify-center px-[26px] py-[14px] rounded-[9px] w-full hover:bg-[#1b3a28] transition-colors mt-2">
          <span class="font-['Inter'] font-medium text-[18px] text-white whitespace-nowrap">Visit Website -></span>
        </a>
      </div>
    `;
  }

  function productCard(row) {
    return `
      <div class="bg-white/80 backdrop-blur-md border border-white/20 flex flex-col gap-[20px] items-center justify-between p-[20px] rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full sm:w-[calc(50%-18px)] lg:w-[calc(33.333%-24px)] max-w-[390px] shrink-0 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] hover:-translate-y-2 transition-all duration-500 group">
        <div class="flex h-[220px] items-center justify-center overflow-hidden rounded-[24px] w-full relative bg-gray-50">
          <img src="${html(row.image_url || FALLBACK_IMAGE)}" alt="${html(row.title)}" class="object-cover w-full h-full">
        </div>
        <div class="flex flex-col gap-[12px] items-center w-full px-2">
          <div class="flex flex-col items-center w-full gap-1">
            <p class="font-['Inter'] font-bold leading-tight text-[#1b3a28] text-[20px] text-center group-hover:text-[#2d5a3d] transition-colors">${html(row.title)}</p>
            <p class="text-[#677461] text-[14px] font-medium opacity-80">${html(row.category || 'NEST Marketplace')}</p>
          </div>
          <div class="flex items-center justify-between w-full border-t border-gray-100 pt-3">
            <div class="flex flex-col">
              <span class="text-[12px] text-[#677461] uppercase font-semibold tracking-tight opacity-70">Price</span>
              <p class="font-['Inter'] font-bold leading-[normal] text-[#1b3a28] text-[22px]">${formatMoney(row.price)}</p>
            </div>
            <div class="flex flex-col items-end">
              <span class="text-[12px] text-[#677461] uppercase font-semibold tracking-tight opacity-70">Stock</span>
              <p class="font-bold text-[#1b3a28] text-[16px]">${html(row.stock || 0)}</p>
            </div>
          </div>
        </div>
        <a href="#" class="group/btn relative overflow-hidden bg-[#2d5a3d] flex items-center justify-center px-[26px] py-[16px] rounded-[16px] w-full transition-all duration-300 shadow-lg shadow-green-900/10 hover:shadow-green-900/20 active:scale-[0.98]">
          <span class="relative font-['Inter'] font-semibold text-[17px] text-white tracking-wide">View Product Detail</span>
        </a>
      </div>
    `;
  }

  function emptyRow(cols, message) {
    return `<tr><td colspan="${cols}" class="px-[24px] py-[40px] text-center font-['Inter'] text-[#677461] text-[14px]">${html(message)}</td></tr>`;
  }

  function isPendingStatus(status) {
    return lower(status || 'pending') === 'pending';
  }

  function payloadObject(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        return {};
      }
    }
    return {};
  }

  function requestSources(row, related) {
    return [related || {}, payloadObject(related && related.metadata), payloadObject(row && row.payload)];
  }

  function requestValue(sources, keys, fallback) {
    const normalizedKeys = keys.map(toKey);
    for (const source of sources) {
      const data = payloadObject(source);
      for (const key of keys) {
        if (clean(data[key])) return clean(data[key]);
      }
      const normalized = {};
      Object.keys(data).forEach((key) => {
        normalized[toKey(key)] = data[key];
      });
      for (const key of normalizedKeys) {
        if (clean(normalized[key])) return clean(normalized[key]);
      }
    }
    return fallback || '';
  }

  function formatBudgetText(value) {
    const raw = clean(value);
    if (!raw) return 'Not provided';
    if (/[a-zA-Z]/.test(raw) || raw.includes('Rs') || raw.includes('INR')) return raw;
    const number = Number(raw.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(number) || !number) return raw;
    return `Rs. ${number.toLocaleString('en-IN')}`;
  }

  function requestDetailItem(label, value) {
    return `
      <div class="flex flex-col gap-[4px]">
        <span class="font-['Inter'] font-semibold text-[#677461] text-[12px] uppercase tracking-widest">${html(label)}</span>
        <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[17px] leading-snug">${html(value || 'Not provided')}</span>
      </div>`;
  }

  function requestDocumentsHtml(sources) {
    const docs = [];
    sources.forEach((source) => {
      const data = payloadObject(source);
      Object.keys(data).forEach((key) => {
        const value = clean(data[key]);
        if (!value || /password|profile_id|startup_id|product_id/i.test(key)) return;
        if (/(document|file|pdf|deck|certificate|proposal|image|mou)/i.test(key)) {
          docs.push({
            title: titleCase(key),
            value
          });
        }
      });
    });
    if (!docs.length) {
      return `
        <div class="flex items-center gap-3 p-4 bg-[#f3f4f6]/50 rounded-[12px]">
          <div class="w-10 h-10 bg-red-50 rounded-[8px] flex items-center justify-center border border-red-100 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="flex flex-col">
            <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[14px]">No document uploaded</span>
            <span class="font-['Inter'] text-[#677461] text-[11px]">Document not provided</span>
          </div>
        </div>`;
    }
    return docs
      .slice(0, 6)
      .map(
        (doc, index) => {
          const fileLabel = /^https?:\/\//i.test(doc.value)
            ? decodeURIComponent(doc.value.split('/').pop() || doc.title).replace(/^\d+-/, '')
            : doc.value.match(/\.(pdf|docx?|png|jpe?g|webp)$/i)
              ? doc.value
              : doc.title;
          return `
        <div class="flex items-center justify-between p-4 bg-[#f3f4f6]/50 rounded-[12px] hover:bg-gray-100 transition-all">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 bg-red-50 rounded-[8px] flex items-center justify-center border border-red-100 shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[14px] truncate">${html(fileLabel)}</span>
              <span class="font-['Inter'] text-[#677461] text-[11px] truncate">Document ${index + 1}</span>
            </div>
          </div>
          ${
            /^https?:\/\//i.test(doc.value)
              ? `<a href="${html(doc.value)}" target="_blank" class="font-['Inter'] font-bold text-[#2d5a3d] text-[12px]">Open</a>`
              : ''
          }
        </div>`;
        }
      )
      .join('');
  }

  function requestPayloadHtml(payload) {
    const skip = /password|profile_id|startup_id|product_id|submitted_as/i;
    const entries = Object.entries(payloadObject(payload)).filter(([key, value]) => clean(value) && !skip.test(key));
    if (!entries.length) return '';
    return `
      <div class="rounded-[16px] border border-gray-100 bg-[#f9fafb] p-5">
        <h4 class="font-['Inter'] font-bold text-[#677461] text-[12px] uppercase tracking-[0.1em] mb-4">Registration Data</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${entries
            .map(
              ([key, value]) => `
              <div>
                <span class="font-['Inter'] font-semibold text-[#677461] text-[11px] uppercase tracking-widest">${html(titleCase(key))}</span>
                <p class="font-['Inter'] text-[#1b3a28] text-[14px] leading-relaxed mt-1 break-words">${html(value)}</p>
              </div>`
            )
            .join('')}
        </div>
      </div>`;
  }

  function requestDetailModal(row, related) {
    const sources = requestSources(row, related);
    const role = requestValue(sources, ['submitted_as', 'requester_role'], row.requester_role || row.request_type);
    const requestType = lower(row.request_type);
    const isProduct = requestType.includes('product') || requestType.includes('marketplace');
    const isEntrepreneur = lower(role).includes('entrepreneur') || lower(requestValue(sources, ['category'], '')).includes('idea');
    const title = related && (related.name || related.title) ? related.name || related.title : row.title;
    const overviewTitle = isProduct ? 'Product Overview' : isEntrepreneur ? 'Idea Overview' : 'Startup Overview';
    const overview = requestValue(
      sources,
      ['overview', 'startup_overview', 'brief_idea_description', 'product_description', 'description'],
      'No overview was entered.'
    );
    const applicant = requestValue(sources, ['founder_name', 'founder_owner_name', 'full_name', 'seller_name', 'shop_name'], row.requester_name);
    const kindLabel = isProduct ? 'Product Listing' : isEntrepreneur ? 'Entrepreneur Idea' : 'Startup';
    const details = isProduct
      ? [
          ['Category', requestValue(sources, ['category'], '')],
          ['Price', formatMoney(requestValue(sources, ['price'], ''))],
          ['Stock', requestValue(sources, ['stock'], '')],
          ['Seller', requestValue(sources, ['seller_name', 'shop_name'], row.requester_name)]
        ]
      : [
          ['Founder / Applicant', requestValue(sources, ['founder_name', 'founder_owner_name', 'full_name'], row.requester_name)],
          ['Location', requestValue(sources, ['state', 'state_region', 'location'], '')],
          ['Team Size', requestValue(sources, ['team_size'], '')],
          ['Funding / Budget', formatBudgetText(requestValue(sources, ['funding_raised', 'funding_raised_inr', 'budget'], ''))]
        ];
    const pending = isPendingStatus(row.status);
    return `
      <div id="request-detail-modal" class="fixed inset-0 items-start justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm py-[60px]" style="position: fixed; inset: 0; z-index: 2147483647; display: flex; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(4px);">
        <div class="fixed inset-0 z-0" data-action="close-request-modal"></div>
        <div class="relative z-10 bg-white rounded-[32px] shadow-[0px_20px_60px_rgba(0,0,0,0.1)] p-[32px] md:p-[40px] w-full max-w-[1140px]" style="position: relative; z-index: 1; width: min(1140px, calc(100vw - 32px));">
          <button data-action="close-request-modal" class="absolute top-8 right-8 text-gray-400 hover:text-red-600 transition-all" aria-label="Close request detail">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div class="flex flex-col gap-[32px]">
            <div class="flex flex-col gap-[8px] pr-12">
              <h2 class="font-['Manrope'] font-bold text-[#1b3a28] text-[28px] leading-tight max-w-[80%] uppercase tracking-tight">${html(title).toUpperCase()}</h2>
              <p class="font-['Inter'] text-[#677461] text-[16px]">${html(applicant)} &bull; ${html(kindLabel)}</p>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-[40px]">
              <div class="lg:col-span-2 flex flex-col gap-[32px]">
                <div class="flex flex-col gap-[16px]">
                  <h4 class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px]">${html(overviewTitle)}</h4>
                  <p class="font-['Inter'] text-[#464E42] text-[15px] leading-relaxed">${html(overview)}</p>
                </div>
                <div class="bg-[#f9f8f4] rounded-[20px] p-[28px] md:p-[32px] flex flex-col gap-[24px]">
                  <h4 class="font-['Inter'] font-bold text-[#677461] text-[12px] uppercase tracking-[0.1em]">Details</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
                    ${details.map(([label, value]) => requestDetailItem(label, value)).join('')}
                  </div>
                </div>
                <div class="flex items-center gap-4 mt-4 flex-wrap">
                  ${
                    pending
                      ? `<button data-action="reject-request" data-id="${row.id}" class="bg-[#b04a4a] text-white px-10 py-4 rounded-[16px] font-['Manrope'] font-bold text-[16px] shadow-lg hover:bg-[#8e3b3b] transform hover:-translate-y-1 transition-all">Reject Request</button>
                         <button data-action="approve-request" data-id="${row.id}" class="bg-[#1b3a28] text-white px-10 py-4 rounded-[16px] font-['Manrope'] font-bold text-[16px] shadow-lg hover:bg-[#142c1e] transform hover:-translate-y-1 transition-all">Approve Request</button>`
                      : `<div class="rounded-[16px] bg-[#f0f2f0] px-8 py-4 font-['Manrope'] font-bold text-[#677461] text-[16px]">Request already ${html(row.status || 'reviewed')}</div>`
                  }
                </div>
              </div>
              <div class="flex flex-col gap-[32px]">
                <div class="flex flex-col gap-[16px]">
                  <h4 class="font-['Inter'] font-bold text-[#677461] text-[12px] uppercase tracking-[0.1em]">Documents</h4>
                  <div class="flex flex-col gap-3">${requestDocumentsHtml(sources)}</div>
                </div>
                <div class="bg-[#f1fff6] rounded-[20px] p-[24px] flex flex-col gap-[24px]" style="background: #f1fff6;">
                  <div class="flex flex-col gap-[8px]">
                    <span class="font-['Inter'] text-[#677461] text-[14px]">Official Email</span>
                    <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px] break-words">${html(requestValue(sources, ['email', 'email_address'], row.requester_email) || 'Not provided')}</span>
                  </div>
                  <div class="flex flex-col gap-[8px]">
                    <span class="font-['Inter'] text-[#677461] text-[14px]">Phone Number</span>
                    <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px]">${html(requestValue(sources, ['phone', 'phone_number'], '') || 'Not provided')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function closeRequestDetailModal() {
    const modal = document.getElementById('request-detail-modal');
    if (modal) modal.remove();
    if (document.body.dataset.requestModalOpen === 'true') {
      document.body.style.overflow = '';
      delete document.body.dataset.requestModalOpen;
    }
  }

  async function showRequestDetail(id) {
    const request = await single('requests', id);
    let related = null;
    if (request.related_table && request.related_id) {
      try {
        related = await single(request.related_table, request.related_id);
      } catch (error) {
        console.warn('Could not load related request item:', error);
      }
    }
    closeRequestDetailModal();
    document.body.insertAdjacentHTML('beforeend', requestDetailModal(request, related));
    document.body.style.overflow = 'hidden';
    document.body.dataset.requestModalOpen = 'true';
  }

  function adminRequestRow(row, compact) {
    const actionClass = compact
      ? "px-[16px] py-[8px] font-['Inter'] text-[13px] rounded-[6px]"
      : "px-[20px] py-[10px] font-['Manrope'] text-[14px] rounded-[10px]";
    const date = row.submitted_at || row.created_at;
    const pending = isPendingStatus(row.status);
    return `
      <tr data-action="view-request" data-id="${row.id}" class="hover:bg-gray-50 transition-all group cursor-pointer">
        <td class="px-[24px] py-[20px]${compact ? ' min-w-[270px]' : ''}">
          <span class="block font-['Manrope'] font-bold text-[#1b3a28] text-[16px] whitespace-normal break-words">${html(row.title)}</span>
        </td>
        <td class="px-[24px] py-[20px]">
          <span class="font-['Inter'] text-[#464E42] ${compact ? 'text-[15px]' : 'text-[13px] uppercase'}">${html(titleCase(row.request_type))}</span>
        </td>
        <td class="px-[24px] py-[20px]">
          <span class="font-['Inter'] text-[#464E42] ${compact ? 'text-[15px]' : 'text-[14px]'}">${html(formatDate(date))}</span>
        </td>
        ${compact ? '' : `<td class="px-[24px] py-[20px]"><span class="font-['Inter'] ${statusColor(row.status)} font-bold text-[14px] capitalize">${html(row.status)}</span></td>`}
        <td class="px-[24px] py-[20px] text-right">
          <div class="flex items-center justify-end gap-[12px]">
            ${
              pending
                ? `<button data-action="reject-request" data-id="${row.id}" class="${actionClass} bg-[#b04a4a] text-white font-bold hover:bg-[#8e3b3b] shadow-sm transition-all">Reject</button>
                   <button data-action="approve-request" data-id="${row.id}" class="${actionClass} bg-[#1b3a28] text-white font-bold hover:bg-[#142c1e] shadow-sm transition-all">Approve</button>`
                : `<span class="inline-flex items-center px-4 py-2 rounded-full bg-[#f0f2f0] text-[#677461] font-['Inter'] font-bold text-[12px] uppercase tracking-wider">Reviewed</span>`
            }
          </div>
        </td>
      </tr>`;
  }

  function detectPage(root) {
    if (!root) return '';
    const heading = lower(text(root.querySelector('h1')));
    if (root.querySelector('#auth-form')) return 'login';
    if (heading.includes('cluster dashboard')) return 'admin-dashboard';
    if (heading.includes('create new program') || heading.includes('edit program')) return 'program-form';
    if (heading.includes('manage program')) return 'admin-programs';
    if (heading.includes('manage startups')) return 'admin-startups';
    if (heading === 'requests' || (heading.includes('requests') && root.querySelector('table'))) return 'admin-requests';
    if (heading.includes('newsletters upload')) return 'admin-newsletters';
    if (heading.includes('upload newsletter')) return 'newsletter-form';
    if (heading.includes('stats management')) return 'admin-stats';
    if (heading.includes('gallery management')) return 'admin-gallery';
    if (heading.includes('hub management')) return 'admin-hubs';
    if (heading.includes('add hub node')) return 'hub-form';
    if (heading.includes('mou management')) return 'admin-mous';
    if (heading.includes('add new mou')) return 'mou-form';
    if (heading.includes('team management')) return 'admin-team';
    if (root.querySelector('#event-title') && root.querySelector('#event-main-image')) return 'public-program-detail';
    if (root.querySelector('#program-list')) return 'dashboard-programs';
    if (heading.includes('marketplace management')) return 'dashboard-marketplace';
    if (heading.includes('my idea overview') || heading.includes('startup management')) return 'dashboard-startup-status';
    if (heading.includes('entrepreneur profile')) return 'dashboard-profile-status';
    if (heading.includes('program/course') || root.querySelector('#upcoming-list')) return 'public-programs';
    if (heading.includes('startups connected')) return 'public-startups';
    if (heading.includes('nest market')) return 'public-market';
    if (heading.includes('newsletter')) return 'public-newsletters';
    if (heading.includes('moments captured') || heading.includes('gallery')) return 'public-gallery';
    if (root.querySelector('#hub-list-state-universities')) return 'public-hubs';
    if (root.querySelector('#leadership-container')) return 'public-team-leadership';
    if (root.querySelector('#container-grassroots') || root.querySelector('#scientific-team-container')) return 'public-team-scientific';
    if (root.querySelector('#executive-team-container')) return 'public-team-executive';
    if (root.querySelector('#apply-btn')) return 'startup-application';
    if (root.querySelector('#prod-name')) return 'product-form';
    if (root.querySelector('#artisan-form') || root.querySelector('#traniee-form') || root.querySelector('#entrepreneur-form')) return 'registration-form';
    if (root.querySelector('.stat-number')) return 'home';
    return '';
  }

  async function renderAdminDashboard(root) {
    const [programs, startups, profiles, requests] = await Promise.all([
      rows('programs'),
      rows('startups'),
      rows('profiles'),
      rows('requests', (q) => q.eq('status', 'pending').order('submitted_at', { ascending: false }))
    ]);
    setCounterText(root, 'Total Events', String(programs.length));
    setCounterText(root, 'Total Startups', String(startups.filter((s) => s.status === 'approved').length));
    setCounterText(root, 'Total Users', String(profiles.length));
    setCounterText(root, 'Pending Approvals', String(requests.length));
    const tbody = root.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = requests.length
        ? requests.slice(0, 5).map((row) => adminRequestRow(row, true)).join('')
        : emptyRow(4, 'No pending requests right now.');
    }
  }

  async function renderAdminPrograms(root) {
    const programs = (await rows('programs', (q) => q.order('created_at', { ascending: false }))).map((row) => ({
      ...row,
      status: normalizeProgramStatus(row)
    }));
    const tbody = root.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = programs.length
      ? programs
        .map(
          (row) => `
        <tr class="hover:bg-gray-50 transition-all group">
          <td class="px-[24px] py-[20px] w-[40%] min-w-[300px]">
            <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px] leading-tight whitespace-normal break-words">${html(row.title)}</span>
          </td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[15px]">${html(row.category || 'NEST Program')}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-semibold text-[#464E42] text-[14px]">${html(formatDate(row.start_date))}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-bold ${statusColor(row.status)} text-[14px] capitalize">${html(row.status)}</span></td>
          <td class="px-[24px] py-[20px] text-right">
            <div class="flex items-center justify-end gap-[16px]">
              <button data-action="view-program" data-id="${row.id}" class="text-[#677461] hover:text-[#1b3a28] transition-all" title="View">View</button>
              <button data-action="edit-program" data-id="${row.id}" class="text-[#677461] hover:text-blue-600 transition-all" title="Edit">Edit</button>
              <button data-action="delete-program" data-id="${row.id}" class="text-[#677461] hover:text-red-600 transition-all" title="Delete">Delete</button>
            </div>
          </td>
        </tr>`
        )
        .join('')
      : emptyRow(5, 'No programs found. Create one to show it on the website.');
    const counter = Array.from(root.querySelectorAll('span')).find((el) => text(el).startsWith('Showing'));
    if (counter) counter.textContent = `Showing ${programs.length} programs`;
  }

  async function initProgramForm(root) {
    const editId = window.location.hash === '#edit-program' ? sessionStorage.getItem('nest_edit_program_id') : '';
    if (!editId) return;
    const program = await single('programs', editId);
    const list = controls(root);
    if (list[0]) list[0].value = program.title || '';
    if (list[1]) list[1].value = program.tagline || '';
    setSelect(list[2], program.category);
    setSelect(list[3], program.program_type);
    if (list[4]) list[4].value = program.start_date || '';
    if (list[5]) list[5].value = program.duration || '';
    if (list[6]) list[6].value = program.location || '';
    if (list[7]) list[7].value = program.application_deadline || '';
    if (list[8]) list[8].value = program.description || '';
    if (list[9]) list[9].value = program.participant_count || '';
    if (list[10]) list[10].value = program.fee || '';
    const eligibility = jsonList(program.eligibility);
    const selection = jsonList(program.selection_process);
    const highlights = jsonHighlights(program.highlights);
    if (list[11]) list[11].value = eligibility[0] || '';
    if (list[12]) list[12].value = eligibility[1] || '';
    if (list[13]) list[13].value = selection[0] || '';
    if (list[14]) list[14].value = selection[1] || '';
    highlights.forEach((item, index) => {
      const offset = 15 + index * 2;
      if (list[offset]) list[offset].value = item.title || '';
      if (list[offset + 1]) list[offset + 1].value = item.body || '';
    });
  }

  async function saveProgram(root) {
    const list = controls(root);
    const files = Array.from(root.querySelectorAll('input[type="file"]'));
    const startDate = clean(list[4] && list[4].value);
    const endDate = estimateEndDate(startDate, clean(list[5] && list[5].value));
    const eligibility = [list[11], list[12]].map((control) => clean(control && control.value)).filter(Boolean);
    const selection = [list[13], list[14]].map((control) => clean(control && control.value)).filter(Boolean);
    const highlights = [];
    for (let index = 15; index + 1 < list.length; index += 2) {
      const title = clean(list[index] && list[index].value);
      const body = clean(list[index + 1] && list[index + 1].value);
      if (title || body) highlights.push({ title, body });
    }
    const payload = {
      title: clean(list[0] && list[0].value) || 'Untitled Program',
      tagline: clean(list[1] && list[1].value),
      category: selectedText(list[2]) || 'NEST Program',
      program_type: selectedText(list[3]) || 'Program',
      start_date: startDate || null,
      end_date: endDate,
      duration: clean(list[5] && list[5].value),
      location: clean(list[6] && list[6].value),
      application_deadline: clean(list[7] && list[7].value) || null,
      description: clean(list[8] && list[8].value),
      participant_count: clean(list[9] && list[9].value),
      fee: clean(list[10] && list[10].value),
      eligibility,
      selection_process: selection,
      highlights,
      status: deriveProgramStatus(startDate, endDate),
      published: true
    };
    if (files[0] && files[0].files[0]) payload.image_url = await upload(files[0].files[0], 'programs');
    if (files[1] && files[1].files[0]) payload.brochure_url = await upload(files[1].files[0], 'brochures');

    const editId = window.location.hash === '#edit-program' ? sessionStorage.getItem('nest_edit_program_id') : '';
    if (editId) {
      await updateRow('programs', editId, payload);
      sessionStorage.removeItem('nest_edit_program_id');
      showModal('Program updated and synced to the website.');
    } else {
      await insertRow('programs', payload);
      showModal('Program created and published on the website.');
    }
    markContentUpdated('programs');
    setTimeout(() => {
      window.location.hash = '#programs';
    }, 800);
  }

  function showProgramLoading(root) {
    ['upcoming', 'ongoing', 'completed'].forEach((status) => {
      const list = root.querySelector(`#${status}-list`);
      if (list) {
        list.innerHTML = `<div class="w-full text-center py-16 text-[#677461] font-['Inter']">Loading ${status} programs...</div>`;
      }
    });
  }

  async function renderPublicPrograms(root) {
    showProgramLoading(root);
    const programs = (await rows('programs', (q) => q.eq('published', true).order('created_at', { ascending: false }))).map((row) => ({
      ...row,
      status: normalizeProgramStatus(row)
    }));
    ['upcoming', 'ongoing', 'completed'].forEach((status) => {
      const list = root.querySelector(`#${status}-list`);
      const filtered = sortProgramsForStatus(
        programs.filter((row) => row.status === status),
        status
      );
      if (list) {
        list.innerHTML = filtered.length
          ? filtered.map(programCard).join('')
          : `<div class="w-full text-center py-16 text-[#677461] font-['Inter']">No ${status} programs right now.</div>`;
      }
      const tab = root.querySelector(`#tab-${status}`);
      const count = tab && tab.querySelector('span:last-child');
      if (count) count.textContent = String(filtered.length);
    });
    if (typeof window.switchProgramTab === 'function') {
      const defaultStatus = ['upcoming', 'ongoing', 'completed'].find((status) => programs.some((row) => row.status === status)) || 'upcoming';
      window.switchProgramTab(defaultStatus);
    }
  }

  async function getSelectedProgram() {
    const selectedId = sessionStorage.getItem('nest_selected_program_id');
    if (selectedId) {
      try {
        const program = await single('programs', selectedId);
        if (program && program.published !== false) return program;
      } catch (error) {
        console.warn('Selected program could not be loaded:', error);
      }
    }
    const latest = await rows('programs', (q) => q.eq('published', true).order('created_at', { ascending: false }).limit(1));
    return latest[0] || null;
  }

  function renderProgramHighlights(root, program) {
    const highlightsGrid = Array.from(root.querySelectorAll('.grid')).find((grid) => grid.querySelector('h4'));
    if (!highlightsGrid) return;
    const fallback = [
      { title: 'Expert Mentorship', body: 'Guidance from NEST and industry mentors.' },
      { title: 'Hands-on Sessions', body: 'Practical learning through structured activities.' },
      { title: 'NEST Network', body: 'Access to peers, startups, and ecosystem partners.' },
      { title: 'Certificate', body: 'Recognition for eligible participants.' }
    ];
    const highlights = jsonHighlights(program.highlights);
    const cards = (highlights.length ? highlights : fallback).slice(0, 4);
    highlightsGrid.innerHTML = cards
      .map(
        (item) => `
          <div class="bg-white rounded-[24px] p-10 flex flex-col gap-4 shadow-sm border border-gray-50/50 hover:shadow-md transition-shadow">
            <h4 class="font-['Inter'] font-bold text-[#1b3a28] text-[20px]">${html(item.title || 'Program Highlight')}</h4>
            <p class="font-['Inter'] font-normal text-[#464e42] text-[14px]">${html(item.body || program.tagline || program.description || '')}</p>
          </div>
        `
      )
      .join('');
  }

  async function renderPublicProgramDetail(root) {
    const program = await getSelectedProgram();
    if (!program) {
      root.innerHTML = `<div class="text-center py-24 font-['Inter'] text-[#677461]">No published program was found.</div>`;
      return;
    }
    program.status = normalizeProgramStatus(program);

    setTextById(root, 'event-category', program.category || 'NEST Program');
    setTextById(root, 'event-status', titleCase(program.status));
    setTextById(root, 'event-title', program.title || 'NEST Program');
    setTextById(root, 'event-description', program.tagline || program.description || 'Program details will be updated soon.');
    setTextById(root, 'event-hero-date', formatDateRange(program));
    setTextById(root, 'event-hero-location', program.location || 'Venue pending');
    setTextById(root, 'event-spots-filled', participantLabel(program));
    setTextById(root, 'event-overview-text', program.description || program.tagline || 'Program overview will be updated soon.');
    setTextById(root, 'event-sidebar-date', formatDateAndDuration(program));
    setTextById(root, 'event-sidebar-location', program.location || 'Venue pending');
    setTextById(root, 'event-sidebar-participants', participantLabel(program));
    setTextById(root, 'event-sidebar-fee', program.fee || 'Free');
    setTextById(root, 'event-sidebar-deadline', formatDate(program.application_deadline));

    const image = root.querySelector('#event-main-image');
    if (image) {
      image.src = program.image_url || FALLBACK_IMAGE;
      image.alt = `${program.title || 'NEST Program'} Image`;
    }
    const progress = root.querySelector('#event-progress-bar');
    if (progress) progress.style.width = program.status === 'completed' ? '100%' : program.status === 'ongoing' ? '60%' : '0%';

    const eligibility = root.querySelector('#event-eligibility-list');
    if (eligibility) {
      eligibility.innerHTML = listHtml(jsonList(program.eligibility), [
        'Open to eligible participants from the NEST Cluster ecosystem',
        'Applicants should submit complete details during registration'
      ]);
    }
    const selection = root.querySelector('#event-selection-list');
    if (selection) {
      selection.innerHTML = listHtml(jsonList(program.selection_process), [
        'Applications will be reviewed by the NEST team',
        'Selected participants will be contacted with the next steps'
      ]);
    }
    renderProgramHighlights(root, program);

    const brochureButton = Array.from(root.querySelectorAll('button')).find((button) => lower(text(button)).includes('download brochure'));
    if (brochureButton) {
      brochureButton.disabled = !program.brochure_url;
      brochureButton.classList.toggle('opacity-50', !program.brochure_url);
      brochureButton.onclick = (event) => {
        event.preventDefault();
        if (program.brochure_url) window.open(program.brochure_url, '_blank');
        else showToast('No brochure has been uploaded for this program yet.', 'error');
      };
    }
  }

  async function renderDashboardPrograms(root) {
    const container = root.querySelector('#program-list');
    if (!container) return;
    const programs = (await rows('programs', (q) => q.eq('published', true).order('created_at', { ascending: false }))).map((row) => ({
      ...row,
      status: normalizeProgramStatus(row)
    }));
    const counts = {
      upcoming: programs.filter((row) => row.status === 'upcoming').length,
      ongoing: programs.filter((row) => row.status === 'ongoing').length,
      completed: programs.filter((row) => row.status === 'completed').length
    };
    Object.keys(counts).forEach((status) => {
      const count = root.querySelector(`#tab-${status} .js-tab-count`);
      if (count) count.textContent = String(counts[status]);
    });
    const activeStatus = counts.upcoming ? 'upcoming' : counts.ongoing ? 'ongoing' : counts.completed ? 'completed' : 'upcoming';
    const ordered = ['upcoming', 'ongoing', 'completed'].flatMap((status) => sortProgramsForStatus(programs.filter((row) => row.status === status), status));
    container.innerHTML = ordered.length
      ? ordered.map((row) => dashboardProgramCard(row, activeStatus)).join('')
      : `<div class="w-full max-w-[1073px] mx-auto bg-white rounded-[18px] border border-gray-100 p-8 text-center font-['Inter'] text-[#677461]">No published programs are available yet.</div>`;

    window.filterPrograms = function filterPrograms(status) {
      const cards = root.querySelectorAll('.program-card');
      const buttons = root.querySelectorAll('[id^="tab-"]');
      buttons.forEach((btn) => {
        const active = btn.id === `tab-${status}`;
        const indicator = btn.querySelector('.js-tab-indicator');
        const tabText = btn.querySelector('.js-tab-text');
        const icon = btn.querySelector('.js-tab-icon');
        const count = btn.querySelector('.js-tab-count');
        if (indicator) {
          indicator.classList.toggle('bg-transparent', !active);
          indicator.classList.toggle('bg-[#2d5a3d]', active);
        }
        if (tabText) {
          tabText.classList.toggle('font-semibold', active);
          tabText.classList.toggle('text-[#2d5a3d]', active);
          tabText.classList.toggle('font-normal', !active);
          tabText.classList.toggle('text-[#677461]', !active);
        }
        if (icon) {
          icon.classList.toggle('text-[#2d5a3d]', active);
          icon.classList.toggle('text-[#677461]', !active);
        }
        if (count) {
          count.classList.toggle('text-[#2d5a3d]', active);
          count.classList.toggle('bg-[#f1ffee]', active);
          count.classList.toggle('text-[#677461]', !active);
          count.classList.toggle('bg-[#f0f2f0]', !active);
        }
      });
      cards.forEach((card) => {
        card.classList.toggle('hidden', !card.classList.contains(status));
      });
    };
    window.filterPrograms(activeStatus);
  }

  async function getStoredStartup() {
    const app = readStore('nest_startup_application', null);
    if (app && app.startupId) {
      try {
        return await single('startups', app.startupId);
      } catch (error) {
        console.warn('Could not load stored startup application:', error);
      }
    }
    const user = readStore('nest_current_user', {});
    if (user.email) {
      const matches = await rows('startups', (q) => q.eq('email', user.email).order('created_at', { ascending: false }).limit(1));
      if (matches[0]) return matches[0];
    }
    return null;
  }

  async function renderDashboardStartupStatus(root) {
    const startup = await getStoredStartup();
    const user = readStore('nest_current_user', {});
    const isIdeaPage = lower(window.location.hash).includes('myidea') || lower(user.role).includes('entrepreneur') || lower(text(root)).includes('my idea overview');
    if (!startup) {
      root.innerHTML = `
        <div class="flex flex-col gap-[24px] items-start w-full max-w-[1000px]">
          <h1 class="font-['Cormorant_Garamond'] font-bold text-[#1b3a28] text-[36px]">${isIdeaPage ? 'My Idea Overview' : 'My Startup Request'}</h1>
          <div class="w-full bg-white rounded-[16px] border border-gray-100 shadow-sm p-8">
            <h2 class="font-['Manrope'] font-bold text-[#1b3a28] text-[22px]">No application found</h2>
            <p class="font-['Inter'] text-[#677461] mt-2">Submit an ${isIdeaPage ? 'entrepreneur idea' : 'startup'} registration request first. It will appear here as pending, approved, or rejected.</p>
          </div>
        </div>`;
      return;
    }
    const sources = [startup, payloadObject(startup.metadata)];
    if (isIdeaPage) {
      root.innerHTML = `
        <div class="flex flex-col gap-[24px] items-start w-full max-w-[1000px]">
          <div class="flex items-center justify-between w-full gap-4 flex-wrap">
            <div class="flex items-center gap-4 flex-wrap">
              <h1 class="font-['Cormorant_Garamond'] font-bold text-[#1b3a28] text-[36px] leading-[normal]">My Idea Overview</h1>
              ${statusBadge(startup.status)}
            </div>
            <button class="bg-[#2D5A3D] text-white px-6 py-2.5 rounded-[10px] font-['Manrope'] font-bold text-[14px] shadow-sm hover:bg-[#1b3a28] transition-all flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit Idea
            </button>
          </div>
          <div class="w-full bg-white rounded-[16px] shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-gray-100 p-8 flex flex-col gap-8">
            <div class="flex flex-col gap-4">
              <h2 class="font-['Manrope'] font-bold text-[#1b3a28] text-[20px] uppercase tracking-tight">Idea Concept</h2>
              <p class="font-['Inter'] text-[#464E42] text-[15px] leading-relaxed">
                ${html(requestValue(sources, ['overview', 'brief_idea_description', 'startup_overview'], 'No idea concept was provided.'))}
              </p>
            </div>
            <div class="bg-[#f9f8f4] rounded-[16px] p-[24px] border border-gray-100">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
                <div class="flex flex-col gap-[4px]">
                  <span class="font-['Inter'] font-semibold text-[#677461] text-[12px] uppercase tracking-widest">Proposed Location</span>
                  <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px]">${html(requestValue(sources, ['state', 'state_region', 'location'], 'Not provided'))}</span>
                </div>
                <div class="flex flex-col gap-[4px]">
                  <span class="font-['Inter'] font-semibold text-[#677461] text-[12px] uppercase tracking-widest">Estimated Budget</span>
                  <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px]">${html(formatBudgetText(requestValue(sources, ['funding_raised', 'funding_raised_inr', 'budget'], '')))}</span>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-[16px]">
              <h4 class="font-['Inter'] font-bold text-[#677461] text-[12px] uppercase tracking-[0.1em]">Attached Documents</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${requestDocumentsHtml(sources)}</div>
            </div>
          </div>
        </div>`;
      return;
    }
    root.innerHTML = `
      <div class="flex flex-col gap-[24px] items-start w-full max-w-[1000px]">
        <div class="flex items-center justify-between w-full gap-4 flex-wrap">
          <div class="flex items-center gap-4 flex-wrap">
            <h1 class="font-['Cormorant_Garamond'] font-bold text-[#1b3a28] text-[36px] leading-[normal]">${html(startup.name)}</h1>
            ${statusBadge(startup.status)}
          </div>
        </div>
        <div class="w-full bg-white rounded-[16px] shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-gray-100 p-8 flex flex-col gap-8">
          <div class="rounded-[14px] border border-gray-100 bg-[#f9fafb] p-5">
            <p class="font-['Inter'] text-[#464E42] text-[15px] leading-relaxed">${html(statusMessage(startup.status, 'Your startup application'))}</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
            <div>
              <span class="font-['Inter'] font-semibold text-[#677461] text-[12px] uppercase tracking-widest">Founder</span>
              <p class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px] mt-1">${html(startup.founder_name || 'Not provided')}</p>
            </div>
            <div>
              <span class="font-['Inter'] font-semibold text-[#677461] text-[12px] uppercase tracking-widest">Vertical</span>
              <p class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px] mt-1">${html(startup.category || 'Not provided')}</p>
            </div>
            <div>
              <span class="font-['Inter'] font-semibold text-[#677461] text-[12px] uppercase tracking-widest">State / Region</span>
              <p class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px] mt-1">${html(startup.state || 'Not provided')}</p>
            </div>
            <div>
              <span class="font-['Inter'] font-semibold text-[#677461] text-[12px] uppercase tracking-widest">Funding / Budget</span>
              <p class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px] mt-1">${html(startup.funding_raised || 'Not provided')}</p>
            </div>
          </div>
          <div>
            <h2 class="font-['Manrope'] font-bold text-[#1b3a28] text-[20px] uppercase tracking-tight">Overview</h2>
            <p class="font-['Inter'] text-[#464E42] text-[15px] leading-relaxed mt-3">${html(startup.overview || 'No overview was provided.')}</p>
          </div>
        </div>
      </div>`;
  }

  async function renderDashboardProfileStatus(root) {
    const startup = await getStoredStartup();
    if (!startup) return;
    const overview = root.querySelector('.w-full.bg-white');
    if (!overview || overview.querySelector('[data-nest-status-card]')) return;
    overview.insertAdjacentHTML(
      'beforeend',
      `<div data-nest-status-card class="mt-4 rounded-[12px] bg-[#f9fafb] border border-gray-100 px-5 py-4">
        <div class="flex items-center gap-3 flex-wrap">
          ${statusBadge(startup.status)}
          <span class="font-['Inter'] text-[#677461] text-[14px]">${html(statusMessage(startup.status, 'Startup profile'))}</span>
        </div>
      </div>`
    );
  }

  async function renderAdminStartups(root) {
    const startups = await rows('startups', (q) => q.order('created_at', { ascending: false }));
    const tbody = root.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = startups.length
      ? startups
        .map(
          (row) => `
        <tr class="hover:bg-gray-50 transition-all group">
          <td class="px-[24px] py-[20px]"><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px]">${html(row.name)}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] text-[#464E42] text-[14px]">${html(row.category || 'Startup')}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] text-[#464E42] text-[14px]">${html(row.established_year || 'NA')}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] text-[#464E42] text-[14px]">${html(row.state || 'NA')}</span></td>
          <td class="px-[24px] py-[20px] text-right">
            <div class="flex items-center justify-end gap-[16px]">
              <a href="${html(row.website_url || '#')}" target="_blank" class="text-[#677461] hover:text-[#1b3a28] transition-all">Visit</a>
              <button data-action="delete-startup" data-id="${row.id}" class="text-[#677461] hover:text-red-600 transition-all">Delete</button>
            </div>
          </td>
        </tr>`
        )
        .join('')
      : emptyRow(5, 'No startups are registered yet.');
    setCounterText(root, 'Total Startups', String(startups.length));
    setCounterText(root, 'Northeast Approval', String(startups.filter((s) => s.status === 'approved').length));
  }

  async function renderPublicStartups(root) {
    const startups = await rows('startups', (q) => q.eq('status', 'approved').order('created_at', { ascending: false }));
    const grid = findGrid(root);
    if (!grid) return;
    grid.innerHTML = startups.length
      ? startups.map(startupCard).join('')
      : `<div class="w-full text-center py-16 text-[#677461] font-['Inter']">No approved startups yet.</div>`;
  }

  async function submitStartupApplication(root) {
    const fields = collectLabeledFields(root);
    const currentUser = rememberCurrentUser('startup', fields);
    const website = fields.website_link ? `https://${fields.website_link.replace(/^https?:\/\//i, '')}` : '';
    const startup = await insertRow('startups', {
      name: fields.startup_name || 'Untitled Startup',
      founder_name: fields.founder_owner_name || fields.founder_name || currentUser.name,
      email: fields.email_address || '',
      phone: fields.phone_number || '',
      website_url: website,
      category: fields.industry_type || '',
      state: fields.state_region || '',
      team_size: fields.team_size || '',
      funding_raised: fields.funding_raised_inr || '',
      overview: fields.startup_overview || '',
      status: 'pending',
      metadata: fields
    });
    const request = await insertRow('requests', {
      request_type: 'startup_registration',
      title: startup.name,
      requester_name: startup.founder_name,
      requester_email: startup.email,
      requester_role: 'startup',
      related_table: 'startups',
      related_id: startup.id,
      payload: fields
    });
    writeStore('nest_startup_application', {
      role: 'startup',
      email: currentUser.email,
      startupId: startup.id,
      requestId: request.id
    });
    showModal('Your startup registration was sent to admin for approval.');
  }

  async function ensureDemoProfile(user) {
    const profile = {
      full_name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      organization: 'NEST Demo',
      status: 'approved',
      metadata: {
        demo_user: true,
        testing_credential: true
      }
    };
    const existing = await rows('profiles', (q) => q.eq('email', user.email).order('created_at', { ascending: false }).limit(1));
    if (existing[0]) await updateRow('profiles', existing[0].id, profile);
    else await insertRow('profiles', { id: crypto.randomUUID(), ...profile });
  }

  async function ensureDemoStartupRequest(user) {
    if (user.role !== 'entrepreneur' && user.role !== 'startup') return;
    const existing = await rows('startups', (q) => q.eq('email', user.email).order('created_at', { ascending: false }).limit(1));
    if (existing[0]) {
      const request = await rows('requests', (q) => q.eq('related_id', existing[0].id).order('submitted_at', { ascending: false }).limit(1));
      writeStore('nest_startup_application', {
        role: user.role,
        email: user.email,
        startupId: existing[0].id,
        requestId: request[0] && request[0].id
      });
      return;
    }
    const startup = await insertRow('startups', {
      name: user.role === 'entrepreneur' ? 'Demo Entrepreneur Venture' : 'Demo Startup Venture',
      founder_name: user.name,
      email: user.email,
      phone: user.phone || '',
      category: user.role === 'entrepreneur' ? 'Entrepreneur Idea' : 'Startup',
      state: 'Assam',
      funding_raised: 'Pending',
      overview: 'Demo application created from testing credentials.',
      status: 'pending',
      metadata: {
        demo_user: true,
        submitted_as: user.role
      }
    });
    const request = await insertRow('requests', {
      request_type: 'startup_registration',
      title: startup.name,
      requester_name: user.name,
      requester_email: user.email,
      requester_role: user.role,
      related_table: 'startups',
      related_id: startup.id,
      payload: {
        demo_user: true,
        startup_id: startup.id
      }
    });
    writeStore('nest_startup_application', {
      role: user.role,
      email: user.email,
      startupId: startup.id,
      requestId: request.id
    });
  }

  async function demoLogin(form) {
    const email = lower(form.querySelector('input[type="email"]') && form.querySelector('input[type="email"]').value);
    const passwordInput = form.querySelector('#state-login input[type="password"]') || form.querySelector('input[type="password"]');
    const password = passwordInput ? passwordInput.value : '';
    const account = DEMO_USERS[email];
    if (!account || account.password !== password) {
      showToast('Invalid testing credential. Use one of the demo emails and passwords shown on this page.', 'error');
      return;
    }
    const user = {
      email,
      role: account.role,
      name: account.name,
      phone: '',
      loggedInAt: new Date().toISOString(),
      isDemo: true
    };
    writeStore('nest_current_user', user);
    writeStore('nest_demo_session', user);
    try {
      await ensureDemoProfile(user);
    } catch (error) {
      console.warn('Demo profile could not be stored. Run the latest supabase/schema.sql to enable profile seeding.', error);
    }
    await ensureDemoStartupRequest(user);
    showToast(`Logged in as ${titleCase(account.role)}.`);
    setTimeout(() => {
      window.location.href = account.redirect;
    }, 400);
  }

  async function renderPublicMarket(root) {
    const products = await rows('marketplace_products', (q) => q.eq('status', 'approved').order('created_at', { ascending: false }));
    const grid = findGrid(root);
    if (!grid) return;
    grid.innerHTML = products.length
      ? products.map(productCard).join('')
      : `<div class="w-full text-center py-16 text-[#677461] font-['Inter']">No approved marketplace products yet.</div>`;
  }

  async function renderDashboardMarketplace(root) {
    const stored = readStore('nest_marketplace_products', []);
    const storedIds = stored.map((item) => item.productId).filter(Boolean);
    const user = readStore('nest_current_user', {});
    let products = [];
    if (storedIds.length) {
      const { data, error } = await supabase().from('marketplace_products').select('*').in('id', storedIds).order('created_at', { ascending: false });
      if (error) throw error;
      products = data || [];
    } else if (user.email) {
      const { data, error } = await supabase()
        .from('marketplace_products')
        .select('*')
        .filter('metadata->>seller_email', 'eq', user.email)
        .order('created_at', { ascending: false });
      if (error) throw error;
      products = data || [];
    } else {
      products = await rows('marketplace_products', (q) => q.order('created_at', { ascending: false }));
    }
    const tbody = root.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = products.length
      ? products
        .map(
          (row) => `
        <tr class="hover:bg-gray-50 transition-all group">
          <td class="px-[24px] py-[20px]"><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px]">${html(row.title)}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] text-[#464E42] text-[14px]">${formatMoney(row.price)}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-bold ${statusColor(row.status)} text-[14px] capitalize">${html(row.status)}</span></td>
          <td class="px-[24px] py-[20px] text-right">
            <div class="flex items-center justify-end gap-[16px]">
              <button data-action="delete-product" data-id="${row.id}" class="text-[#677461] hover:text-[#b04a4a] transition-all">Delete</button>
            </div>
          </td>
        </tr>`
        )
        .join('')
      : emptyRow(4, 'No marketplace requests have been submitted yet.');
    setCounterText(root, 'Products Listed', String(products.length));
  }

  async function submitProduct(root) {
    const files = Array.from(root.querySelectorAll('input[type="file"]')).flatMap((input) => Array.from(input.files || []));
    const select = root.querySelector('select');
    const imageUrls = [];
    for (const file of files) {
      imageUrls.push(await upload(file, 'products'));
    }
    const user = readStore('nest_current_user', {});
    const product = await insertRow('marketplace_products', {
      title: clean(root.querySelector('#prod-name') && root.querySelector('#prod-name').value) || 'Untitled Product',
      category: selectedText(select),
      price: Number(clean(root.querySelector('#prod-price') && root.querySelector('#prod-price').value)) || null,
      stock: Number(clean(root.querySelector('#prod-stock') && root.querySelector('#prod-stock').value)) || 0,
      description: clean(root.querySelector('textarea') && root.querySelector('textarea').value),
      image_url: imageUrls[0] || null,
      gallery_urls: imageUrls,
      status: 'pending',
      seller_role: document.body.dataset.dashboardRole || 'artisan',
      seller_name: user.name || 'NEST dashboard user',
      metadata: {
        seller_email: user.email || '',
        submitted_from_dashboard: document.body.dataset.dashboardRole || 'artisan'
      }
    });
    const request = await insertRow('requests', {
      request_type: 'product_listing',
      title: product.title,
      requester_name: product.seller_name,
      requester_email: user.email || '',
      requester_role: product.seller_role,
      related_table: 'marketplace_products',
      related_id: product.id,
      payload: product
    });
    const stored = readStore('nest_marketplace_products', []);
    stored.unshift({ productId: product.id, requestId: request.id, title: product.title });
    writeStore('nest_marketplace_products', stored.slice(0, 20));
    showModal('Product listing saved and sent to admin for approval.');
  }

  async function renderAdminRequests(root) {
    const requests = await rows('requests', (q) => q.order('submitted_at', { ascending: false }));
    const tbody = root.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = requests.length
      ? requests
        .map((row) => adminRequestRow(row, false))
        .join('')
      : emptyRow(5, 'No requests yet.');
    setCounterText(root, 'Pending Approval', String(requests.filter((r) => r.status === 'pending').length));
    setCounterText(root, 'Total Requests', String(requests.length));
  }

  async function decideRequest(id, status) {
    const req = await single('requests', id);
    if (req.related_table && req.related_id) {
      await updateRow(req.related_table, req.related_id, { status });
    }
    if (req.payload && req.payload.profile_id) {
      await updateRow('profiles', req.payload.profile_id, { status });
    }
    await updateRow('requests', id, { status });
    showToast(`Request ${status}.`);
    closeRequestDetailModal();
    scheduleInit(true);
  }

  async function renderAdminNewsletters(root) {
    const newsletters = await rows('newsletters', (q) => q.order('published_on', { ascending: false }));
    const tbody = root.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = newsletters.length
      ? newsletters
        .map(
          (row) => `
        <tr class="hover:bg-gray-50 transition-all group">
          <td class="px-[24px] py-[20px]"><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px]">${html(row.title)}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] text-[#464E42] text-[13px] uppercase">${html(row.month || '')}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] text-[#464E42] text-[14px]">${html(row.year || '')}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] text-[#464E42] text-[14px]">${html(formatDate(row.published_on))}</span></td>
          <td class="px-[24px] py-[20px] text-right">
            <div class="flex items-center justify-end gap-[16px]">
              <button data-action="view-newsletter" data-id="${row.id}" class="text-[#677461] hover:text-[#1b3a28] transition-all">View</button>
              <button data-action="delete-newsletter" data-id="${row.id}" class="text-[#677461] hover:text-red-600 transition-all">Delete</button>
            </div>
          </td>
        </tr>`
        )
        .join('')
      : emptyRow(5, 'No newsletters have been uploaded yet.');
    const counter = Array.from(root.querySelectorAll('span')).find((el) => text(el).startsWith('Showing'));
    if (counter) counter.textContent = `Showing ${newsletters.length} newsletters`;
  }

  async function saveNewsletter(root) {
    const list = controls(root);
    const file = root.querySelector('input[type="file"]');
    const pdf = file && file.files[0];
    if (!pdf) throw new Error('Please choose a PDF before uploading the newsletter.');
    if (pdf.type !== 'application/pdf' && !pdf.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Only PDF files can be uploaded for newsletters.');
    }
    if (pdf.size > 25 * 1024 * 1024) {
      throw new Error('Newsletter PDF must be less than 25mb.');
    }
    const pdfUrl = await upload(pdf, 'newsletters');
    await insertRow('newsletters', {
      title: clean(list[0] && list[0].value) || 'Untitled Newsletter',
      month: selectedText(list[1]),
      year: Number(clean(list[2] && list[2].value)) || new Date().getFullYear(),
      published_on: clean(list[3] && list[3].value) || new Date().toISOString().slice(0, 10),
      pdf_url: pdfUrl,
      status: 'published'
    });
    showModal('Newsletter uploaded and published to the website.');
    setTimeout(() => {
      window.location.hash = '#newsletter';
    }, 800);
  }

  async function renderPublicNewsletters(root) {
    const newsletters = await rows('newsletters', (q) => q.eq('status', 'published').order('published_on', { ascending: false }));
    const container = findGrid(root) || root.querySelector('.grid');
    if (!container) return;
    container.innerHTML = newsletters.length
      ? newsletters
        .map(
          (row) => `
        <a href="${html(row.pdf_url || '#')}" target="_blank" class="bg-white flex flex-col items-start justify-between rounded-[20px] shadow-[0px_4px_16px_rgba(0,0,0,0.04)] border border-gray-100 hover:border-[#d2dfce] hover:shadow-lg transition-all w-full min-h-[190px] shrink-0 group p-[24px]">
          <!-- Header and Content -->
          <div class="flex flex-col gap-[16px] items-start w-full">
            <div class="flex items-center justify-between w-full">
              <div class="bg-[#f1ffee] text-[#2d5a3d] font-['Inter'] font-bold text-[10px] px-[10px] py-[4px] rounded-full uppercase tracking-wider">
                ${html(row.month || '')} ${html(row.year || '')}
              </div>
              <div class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-[#677461] group-hover:bg-[#e2f5df] group-hover:text-[#2d5a3d] transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
            
            <div class="flex flex-col gap-[6px] items-start w-full">
              <p class="font-['Inter'] font-semibold text-[#a87f2a] text-[11px] uppercase tracking-wider">
                Published: ${html(formatDate(row.published_on))}
              </p>
              <h3 class="font-['Inter'] font-bold leading-snug text-[#1b3a28] text-[18px] m-0 group-hover:text-[#2d5a3d] transition-colors line-clamp-3">
                ${html(row.title)}
              </h3>
            </div>
          </div>
          <!-- Footer -->
          <div class="flex items-center gap-[6px] mt-[24px] pt-[16px] w-full border-t border-gray-100 group-hover:border-[#d2dfce] transition-colors">
            <span class="font-['Inter'] font-semibold text-[#2d5a3d] text-[13px]">Read Newsletter</span>
            <svg class="w-3.5 h-3.5 text-[#2d5a3d] transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
            </svg>
          </div>
        </a>`
        )
        .join('')
      : `<div class="w-full text-center py-16 text-[#677461] font-['Inter']"> No newsletters have been published yet.</div> `;
  }

  async function initStats(root) {
    const stats = await rows('site_stats', (q) => q.eq('scope', 'home').order('sort_order'));
    const inputs = Array.from(root.querySelectorAll('input[type="text"]')).slice(0, 4);
    stats.slice(0, 4).forEach((stat, index) => {
      if (inputs[index]) inputs[index].value = stat.value;
    });
    window.saveAllStats = async function () {
      const defaults = [
        ['incubated-startups', 'Incubated Startups'],
        ['institutions', 'Institutions'],
        ['investments', 'Investments'],
        ['ne-beneficiaries', 'North-East Beneficiaries']
      ];
      const payload = defaults.map(([id, label], index) => ({
        id,
        label,
        scope: 'home',
        sort_order: index + 1,
        value: clean(inputs[index] && inputs[index].value)
      }));
      const { error } = await supabase().from('site_stats').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      showToast('Homepage stats saved.');
    };
  }

  async function renderHomeStats(root) {
    const stats = await rows('site_stats', (q) => q.eq('scope', 'home').order('sort_order'));
    const values = Array.from(root.querySelectorAll('.stat-number'));
    stats.slice(0, values.length).forEach((stat, index) => {
      values[index].textContent = stat.value;
    });
  }

  async function renderAdminGallery(root) {
    const items = await galleryItems(root);
    const grid = root.querySelector('#gallery-grid');
    if (!grid) return;
    grid.innerHTML = items.length
      ? items
        .map(
          (item) => `
        <div class="gallery-card group relative bg-white rounded-[16px] overflow-hidden border border-[#e5e7ea] shadow-sm hover:shadow-md transition-all aspect-[4/3] flex flex-col">
        <img src="${html(item.image_url)}" alt="${html(item.title || item.caption || 'Gallery image')}" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            ${item.is_default_gallery
              ? `<span class="px-4 py-2 bg-white text-[#1b3a28] rounded-full shadow-lg font-['Manrope'] font-bold text-[12px] uppercase tracking-wide">Website image</span>`
              : `<button data-action="delete-gallery" data-id="${item.id}" class="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transform hover:scale-110 transition-all">Delete</button>`
            }
          </div>
        </div>`
        )
        .join('')
      : `<div class="col-span-full text-center py-16 text-[#677461] font-['Inter']"> No gallery images uploaded yet.</div> `;

    window.toggleUploadModal = function () {
      const modal = document.getElementById('upload-modal');
      if (modal) modal.classList.toggle('hidden');
    };
    window.performUpload = async function () {
      const input = document.getElementById('gallery-file');
      const captionInput = root.querySelector('#upload-modal input[type="text"]');
      const files = Array.from((input && input.files) || []);
      if (!files.length) {
        alert('Please select at least one image first.');
        return;
      }
      for (const file of files) {
        const url = await upload(file, 'gallery');
        await insertRow('gallery_items', {
          title: file.name,
          caption: clean(captionInput && captionInput.value),
          image_url: url
        });
      }
      markContentUpdated('gallery_items');
      window.toggleUploadModal();
      scheduleInit(true);
      showToast('Gallery updated.');
    };
  }

  async function renderPublicGallery(root) {
    const items = await galleryItems(root);
    const grid = root.querySelector('#public-gallery-grid') || root.querySelector('.grid') || findGrid(root);
    if (!grid) return;
    grid.innerHTML = items.length
      ? items
        .map(
          (item) => `
        <div class="w-full sm:w-[380px] shrink-0 overflow-hidden rounded-[20px] bg-white border border-gray-100 shadow-sm">
        <div class="aspect-[4/3] bg-gray-100">
          <img loading="lazy" src="${html(item.image_url)}" alt="${html(item.caption || item.title || 'NEST gallery')}" class="w-full h-full object-cover">
        </div>
          ${item.caption ? `<p class="p-4 text-[#677461] font-['Inter']">${html(item.caption)}</p>` : ''}
        </div> `
        )
        .join('')
      : `<div class="col-span-full text-center py-16 text-[#677461] font-['Inter']"> No gallery images yet.</div> `;
  }

  async function renderAdminHubs(root) {
    const hubs = await rows('hubs', (q) => q.order('created_at', { ascending: false }));
    const tbody = root.querySelector('#hub-nodes-list');
    if (!tbody) return;
    tbody.innerHTML = hubs.length
      ? hubs
        .map(
          (hub) => `
        <tr class="hover:bg-gray-50 transition-all group">
          <td class="px-[24px] py-[20px]"><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px]">${html(hub.name)}</span></td>
          <td class="px-[24px] py-[20px]"><span class="bg-[#f1ffee] text-[#2D5A3D] px-[12px] py-[4px] rounded-[12px] inline-block font-['Inter'] font-semibold text-[11px]">${html(hub.category)}</span></td>
          <td class="px-[24px] py-[20px] text-right"><button data-action="delete-hub" data-id="${hub.id}" class="text-gray-400 hover:text-red-600 transition-all p-2 rounded-lg hover:bg-red-50">Delete</button></td>
        </tr > `
        )
        .join('')
      : emptyRow(3, 'No hub nodes found.');
  }

  async function saveHub(root) {
    const name = clean(root.querySelector('#hub-name') && root.querySelector('#hub-name').value);
    const category = clean(root.querySelector('#hub-category') && root.querySelector('#hub-category').value);
    if (!name) throw new Error('Please enter a hub node name.');
    await insertRow('hubs', { name, category, status: 'active' });
    markContentUpdated('hubs');
    showToast('Hub node added.');
    window.location.hash = '#hub';
  }

  async function renderPublicHubs(root) {
    const [hubs, mous] = await Promise.all([
      rows('hubs', (q) => q.eq('status', 'active').order('category')),
      rows('mous', (q) => q.eq('status', 'active').order('created_at', { ascending: false }))
    ]);
    const map = {
      'State Universities': '#hub-list-state-universities',
      'NIT Network': '#hub-list-nit-network',
      'Industry Partner': '#hub-list-industry-partner',
      'Government Bodies': '#hub-list-government-bodies'
    };
    Object.entries(map).forEach(([category, selector]) => {
      const container = root.querySelector(selector);
      if (!container) return;
      const list = hubs.filter((hub) => hub.category === category);
      container.innerHTML = list
        .map(
          (hub) =>
            `<span class="bg-[#fff3db] text-[#7d6433] font-['Inter'] font-semibold text-[11px] px-[12px] py-[4px] rounded-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"> ${html(hub.name)}</span> `
        )
        .join('');
    });
    const mouHeading = Array.from(root.querySelectorAll('h2')).find((heading) => lower(text(heading)).includes('strategic partnerships'));
    const findMouGrid = () => {
      const explicitGrid = root.querySelector('#mou-list');
      if (explicitGrid) return explicitGrid;
      if (!mouHeading) return null;
      let section = mouHeading.parentElement;
      while (section && section !== root) {
        const gridInSection = section.querySelector('.grid');
        if (gridInSection) return gridInSection;
        section = section.parentElement;
      }
      return null;
    };
    const grid = findMouGrid();
    if (grid) {
      grid.innerHTML = mous
        .map(
          (mou) => `
    <a href = "${html(mou.document_url || '#')}" target = "_blank" class="bg-white flex flex-col gap-[14px] p-[24px] md:p-[32px] rounded-[14px] shadow-[0px_4px_16px_rgba(0,0,0,0.04)] border border-gray-100 min-h-[263px] items-start justify-center hover:-translate-y-1 transition-all">
          <h3 class="font-['Inter'] font-semibold text-black text-[20px] leading-tight">${html(mou.partner_name)}</h3>
          <div class="bg-[#2d5a3d] px-[16px] py-[6px] rounded-[50px] shadow-sm">
            <span class="font-['Inter'] font-medium text-white text-[12px] uppercase tracking-wider">${html(mou.association_type || 'MOU')}</span>
          </div>
          <p class="font-['Inter'] font-normal text-[#677461] text-[15px] leading-relaxed w-full">${html(mou.objective || 'Strategic partnership with NEST Cluster.')}</p>
          <div class="bg-[#3d5f4a] text-white flex gap-[12px] items-center justify-center px-[24px] py-[10px] rounded-[8px] w-full mt-1 shadow-md">
            <span class="font-['Inter'] font-bold text-[15px]">${mou.document_url ? 'View MOU' : 'MOU Added'}</span>
          </div>
        </a>`
        )
        .join('') || `<div class="col-span-full text-center py-16 text-[#677461] font-['Inter']"> No MOU associations have been added yet.</div>`;
    }
  }

  async function renderAdminMous(root) {
    const mous = await rows('mous', (q) => q.order('created_at', { ascending: false }));
    const tbody = root.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = mous.length
      ? mous
        .map(
          (mou) => `
    <tr class="hover:bg-gray-50 transition-all group">
          <td class="px-[24px] py-[20px]"><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px]">${html(mou.partner_name)}</span></td>
          <td class="px-[24px] py-[20px]"><span class="font-['Inter'] text-[#464E42] text-[13px] font-medium uppercase">${html(mou.association_type || '')}</span></td>
          <td class="px-[24px] py-[20px] text-right"><button data-action="delete-mou" data-id="${mou.id}" class="text-gray-400 hover:text-red-600 transition-all p-2 rounded-lg hover:bg-red-50">Delete</button></td>
        </tr > `
        )
        .join('')
      : emptyRow(3, 'No MOU associations found.');
  }

  async function saveMou(root) {
    const partnerName = clean(root.querySelector('#mou-partner-name') && root.querySelector('#mou-partner-name').value);
    const objective = clean(root.querySelector('#mou-objective') && root.querySelector('#mou-objective').value);
    const associationSelect = root.querySelector('#mou-association-type');
    const associationType = clean(associationSelect && associationSelect.value) ? selectedText(associationSelect) : '';
    const file = root.querySelector('#mou-document') || root.querySelector('input[type="file"]');
    const documentFile = file && file.files[0];
    if (!partnerName) throw new Error('Please enter the institution or industry name.');
    if (!associationType) throw new Error('Please select an association type.');
    if (documentFile && documentFile.type !== 'application/pdf' && !documentFile.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Only PDF files can be uploaded for MOU documents.');
    }
    if (documentFile && documentFile.size > 25 * 1024 * 1024) {
      throw new Error('MOU PDF must be less than 25mb.');
    }
    const documentUrl = documentFile ? await upload(documentFile, 'mous') : null;
    await insertRow('mous', {
      partner_name: partnerName,
      objective,
      association_type: associationType,
      document_url: documentUrl,
      status: 'active'
    });
    markContentUpdated('mous');
    showToast('MOU association added.');
    window.location.hash = '#hubmou';
  }

  async function renderAdminTeam(root) {
    const list = await rows('team_members', (q) => {
      let query = q.eq('team_type', teamState.team).order('sort_order').order('created_at');
      if (teamState.team === 'scientific') query = query.eq('scientific_category', teamState.category);
      return query;
    });
    renderTeamTabs();
    const container = root.querySelector('#members-list');
    const empty = root.querySelector('#empty-state');
    const title = root.querySelector('#current-view-title');
    if (title) title.textContent = teamState.team === 'scientific' ? `Scientific Team: ${titleCase(teamState.category)}` : `${titleCase(teamState.team)} Members`;
    if (!container) return;
    container.innerHTML = list
      .map(
        (member) => `
    <div class="bg-white border border-gray-100 rounded-[14px] p-4 flex items-center gap-4 group hover:shadow-md transition-all">
        <div class="w-14 h-14 rounded-full overflow-hidden shrink-0 bg-gray-50 border border-gray-200">
          <img src="${html(member.image_url || FALLBACK_AVATAR)}" class="w-full h-full object-cover" alt="${html(member.full_name)}">
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-['Manrope'] font-bold text-[#1b3a28] text-[15px] truncate">${html(member.full_name)}</h4>
          <p class="text-[#677461] text-[12px] truncate">${html(member.role_title)}</p>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button data-action="edit-team-member" data-id="${member.id}" class="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all">Edit</button>
          <button data-action="delete-team-member" data-id="${member.id}" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all">Delete</button>
        </div>
      </div> `
      )
      .join('');
    if (empty) {
      empty.classList.toggle('hidden', list.length > 0);
      empty.classList.toggle('flex', list.length === 0);
    }
    installTeamGlobals(root);
  }

  function renderTeamTabs() {
    ['leadership', 'scientific', 'executive'].forEach((team) => {
      const btn = document.getElementById(`tab-${team}`);
      if (!btn) return;
      btn.classList.toggle('bg-[#2d5a3d]', team === teamState.team);
      btn.classList.toggle('text-white', team === teamState.team);
      btn.classList.toggle('shadow-sm', team === teamState.team);
      btn.classList.toggle('text-[#677461]', team !== teamState.team);
    });
    const cats = document.getElementById('scientific-categories');
    if (cats) {
      cats.classList.toggle('hidden', teamState.team !== 'scientific');
      cats.classList.toggle('flex', teamState.team === 'scientific');
      ['grassroots', 'semiconductor', 'bamboo', 'waste'].forEach((cat) => {
        const catBtn = document.getElementById(`cat-${cat}`);
        if (!catBtn) return;
        const isActive = cat === teamState.category;
        catBtn.classList.toggle('border-[#2d5a3d]', isActive);
        catBtn.classList.toggle('bg-[#2d5a3d]', isActive);
        catBtn.classList.toggle('text-white', isActive);
        catBtn.classList.toggle('border-gray-200', !isActive);
        catBtn.classList.toggle('text-[#677461]', !isActive);
      });
    }
  }

  function installTeamGlobals(root) {
    window.switchTeam = function (team) {
      teamState.team = team;
      scheduleInit(true);
    };
    window.switchCategory = function (category) {
      teamState.category = category;
      scheduleInit(true);
    };
    window.openAddMemberModal = function () {
      teamState.editingId = null;
      teamState.photoFile = null;
      teamState.photoUrl = null;
      root.querySelector('#member-name').value = '';
      root.querySelector('#member-role').value = '';
      root.querySelector('#member-link').value = '';
      root.querySelector('#member-modal').classList.remove('hidden');
    };
    window.closeModal = function () {
      const modal = root.querySelector('#member-modal');
      if (modal) modal.classList.add('hidden');
    };
    window.previewMemberPhoto = function (input) {
      teamState.photoFile = input.files[0] || null;
      const preview = root.querySelector('#modal-photo-preview');
      const icon = root.querySelector('#modal-photo-icon');
      if (!teamState.photoFile || !preview) return;
      preview.src = URL.createObjectURL(teamState.photoFile);
      preview.classList.remove('hidden');
      if (icon) icon.classList.add('hidden');
    };
    window.saveMember = async function () {
      const name = clean(root.querySelector('#member-name').value);
      const role = clean(root.querySelector('#member-role').value);
      const link = clean(root.querySelector('#member-link').value);
      let imageUrl = teamState.photoUrl;
      if (teamState.photoFile) imageUrl = await upload(teamState.photoFile, 'team');
      const payload = {
        full_name: name,
        role_title: role,
        profile_url: link,
        image_url: imageUrl,
        team_type: teamState.team,
        scientific_category: teamState.team === 'scientific' ? teamState.category : null,
        is_visible: true
      };
      if (teamState.editingId) await updateRow('team_members', teamState.editingId, payload);
      else await insertRow('team_members', payload);
      window.closeModal();
      scheduleInit(true);
    };
  }

  async function editTeamMember(id) {
    const root = mainRoot();
    const member = await single('team_members', id);
    teamState.editingId = id;
    teamState.photoUrl = member.image_url;
    root.querySelector('#member-name').value = member.full_name || '';
    root.querySelector('#member-role').value = member.role_title || '';
    root.querySelector('#member-link').value = member.profile_url || '';
    const preview = root.querySelector('#modal-photo-preview');
    if (preview && member.image_url) {
      preview.src = member.image_url;
      preview.classList.remove('hidden');
    }
    root.querySelector('#member-modal').classList.remove('hidden');
  }

  async function renderPublicTeam(root, teamType) {
    const team = await rows('team_members', (q) => q.eq('team_type', teamType).eq('is_visible', true).order('sort_order').order('created_at'));
    if (teamType === 'leadership') {
      const container = root.querySelector('#leadership-container');
      if (container) container.innerHTML = team.map(publicLeaderCard).join('');
      return;
    }
    if (teamType === 'executive') {
      const container = root.querySelector('#executive-team-container');
      if (container) container.innerHTML = team.map(publicTeamCard).join('');
      return;
    }
    ['grassroots', 'semiconductor', 'bamboo', 'waste'].forEach((category) => {
      const container = root.querySelector(`#container-${category}`);
      if (container) {
        container.innerHTML = team.filter((member) => member.scientific_category === category).map(publicTeamCard).join('');
      }
    });
  }

  function publicLeaderCard(member) {
    const profileUrl = member.profile_url || 'javascript:void(0)';
    const target = member.profile_url ? 'target="_blank" rel="noopener noreferrer"' : '';
    return `
    <a href="${html(profileUrl)}" ${target} class="relative w-full max-w-[320px] sm:max-w-[400px] aspect-square rounded-[24px] overflow-hidden shrink-0 group cursor-pointer shadow-sm hover:shadow-lg transition-shadow duration-300 block mx-auto">
      <img src="${html(member.image_url || FALLBACK_AVATAR)}" alt="${html(member.full_name)}" class="absolute inset-0 w-full h-full object-cover" />
      <div class="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 bg-white/95 backdrop-blur-sm rounded-[10px] p-3 flex items-center justify-between transition-colors duration-300 group-hover:bg-[#1b3a28]">
        <div class="flex flex-col gap-[2px] w-[80%] text-left">
          <p class="font-['Inter',sans-serif] font-semibold text-[#1b3a28] text-[16px] sm:text-[20px] transition-colors duration-300 group-hover:text-white truncate">${html(member.full_name)}</p>
          <p class="font-['Inter',sans-serif] font-normal text-[#464e42] text-[13px] sm:text-[14px] transition-colors duration-300 group-hover:text-white/80 truncate">${html(member.role_title)}</p>
        </div>
        <div class="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-[#1b3a28] group-hover:bg-[#2d5a3d] transition-colors duration-300 shrink-0">
          <svg class="w-5 h-5 sm:w-6 sm:h-6 text-white transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
        </div>
      </div>
    </a>
  `;
  }

  function publicTeamCard(member) {
    const profileUrl = member.profile_url || 'javascript:void(0)';
    const target = member.profile_url ? 'target="_blank" rel="noopener noreferrer"' : '';
    return `
    <a href="${html(profileUrl)}" ${target} class="relative w-full max-w-[280px] aspect-square rounded-[16.8px] overflow-hidden shrink-0 group cursor-pointer shadow-sm hover:shadow-lg transition-shadow duration-300 block mx-auto">
      <img src="${html(member.image_url || FALLBACK_AVATAR)}" alt="${html(member.full_name)}" class="absolute inset-0 w-full h-full object-cover" />
      <div class="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm rounded-[10px] p-[10px] flex items-center justify-between transition-colors duration-300 group-hover:bg-[#1b3a28]">
        <div class="flex flex-col gap-[2px] w-[75%] text-left">
          <p class="font-['Inter',sans-serif] font-semibold text-[#1b3a28] text-[14px] sm:text-[16px] transition-colors duration-300 group-hover:text-white truncate">${html(member.full_name)}</p>
          <p class="font-['Inter',sans-serif] font-normal text-[#464e42] text-[12px] sm:text-[13px] transition-colors duration-300 group-hover:text-white/80 truncate">${html(member.role_title)}</p>
        </div>
        <div class="w-[32px] h-[32px] flex items-center justify-center rounded-full bg-[#1b3a28] group-hover:bg-[#2d5a3d] transition-colors duration-300 shrink-0">
          <svg class="w-4 h-4 text-white transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
        </div>
      </div>
    </a>
  `;
  }

  async function submitRegistration(form) {
    validateRegistrationForm(form);
    const fields = collectLabeledFields(form, { includeHidden: true });
    const id = form.id || '';
    const formText = lower(text(form.closest('section') || form));
    const role = formText.includes('artisan registration')
      ? 'artisan'
      : formText.includes('trainee registration') || id.includes('traniee')
        ? 'trainee'
        : formText.includes('startup registration')
          ? 'startup'
          : formText.includes('entrepreneur registration') || id.includes('entrepreneur')
            ? 'entrepreneur'
            : 'startup';
    const currentUser = rememberCurrentUser(role, fields);
    const profile = await insertRow('profiles', {
      full_name: currentUser.name,
      email: fields.email_address || '',
      phone: fields.phone_number || '',
      role,
      organization: fields.startup_name || fields.shop_name_optional || '',
      status: 'pending',
      metadata: fields
    });

    if (role === 'entrepreneur' || role === 'startup') {
      const startupName =
        fields.startup_name ||
        fields.organization ||
        (fields.brief_idea_description ? `${currentUser.name} 's Startup Idea` : '') ||
        `${currentUser.name}'s Startup`;
      const startup = await insertRow('startups', {
        name: startupName,
        founder_name: fields.founder_owner_name || fields.full_name || currentUser.name,
        email: fields.email_address || '',
        phone: fields.phone_number || '',
        website_url: fields.website_link ? `https://${fields.website_link.replace(/^https?:\/\//i, '')}` : '',
        category: fields.industry_type || fields.vertical || (role === 'entrepreneur' ? 'Entrepreneur Idea' : 'Startup'),
        state: fields.state_region || fields.location || '',
        team_size: fields.team_size || '',
        funding_raised: fields.funding_raised_inr || fields.budget || '',
        overview: fields.startup_overview || fields.brief_idea_description || '',
        status: 'pending',
        metadata: {
          ...fields,
          submitted_as: role,
          profile_id: profile.id
        }
      });
      const request = await insertRow('requests', {
        request_type: 'startup_registration',
        title: startup.name,
        requester_name: profile.full_name,
        requester_email: profile.email,
        requester_role: role,
        related_table: 'startups',
        related_id: startup.id,
        payload: {
          ...fields,
          profile_id: profile.id,
          startup_id: startup.id
        }
      });
      writeStore('nest_startup_application', {
        role,
        email: profile.email,
        profileId: profile.id,
        startupId: startup.id,
        requestId: request.id
      });
      showToast('Startup application sent to admin. Status is pending.');
      setTimeout(() => {
        window.location.href = role === 'entrepreneur' ? 'entrepreneur.html#myidea' : 'startup.html#mystartup';
      }, 900);
      return;
    }

    await insertRow('requests', {
      request_type: 'user_registration',
      title: `${titleCase(role)} registration`,
      requester_name: profile.full_name,
      requester_email: profile.email,
      requester_role: role,
      related_table: 'profiles',
      related_id: profile.id,
      payload: fields
    });
    showToast('Registration saved and sent to admin for approval.');
    window.location.hash = '#login';
  }

  async function refreshNotifications() {
    if (!supabase()) return;
    const notifications = await rows('notifications', (q) => q.eq('is_active', true).order('sort_order'));
    localStorage.setItem(
      'nest_notification_config',
      JSON.stringify(notifications.map((item) => ({ text: item.text, pdfUrl: item.pdf_url })))
    );
    const bar = document.getElementById('notification-bar');
    if (bar && (window.location.hash === '' || window.location.hash === '#home')) {
      window.dispatchEvent(new Event('hashchange'));
    }
  }

  async function initLoadedContent(root, force) {
    if (!root || !supabase()) return;
    const key = detectPage(root);
    if (!key) return;
    if (!force && currentPageKey === key && root.dataset.nestSupabasePage === key) return;
    currentPageKey = key;
    root.dataset.nestSupabasePage = key;
    try {
      if (key === 'admin-dashboard') await renderAdminDashboard(root);
      if (key === 'program-form') await initProgramForm(root);
      if (key === 'admin-programs') await renderAdminPrograms(root);
      if (key === 'public-programs') await renderPublicPrograms(root);
      if (key === 'public-program-detail') await renderPublicProgramDetail(root);
      if (key === 'admin-startups') await renderAdminStartups(root);
      if (key === 'public-startups') await renderPublicStartups(root);
      if (key === 'public-market') await renderPublicMarket(root);
      if (key === 'dashboard-marketplace') await renderDashboardMarketplace(root);
      if (key === 'dashboard-startup-status') await renderDashboardStartupStatus(root);
      if (key === 'dashboard-profile-status') await renderDashboardProfileStatus(root);
      if (key === 'admin-requests') await renderAdminRequests(root);
      if (key === 'admin-newsletters') await renderAdminNewsletters(root);
      if (key === 'public-newsletters') await renderPublicNewsletters(root);
      if (key === 'admin-stats') await initStats(root);
      if (key === 'home') await renderHomeStats(root);
      if (key === 'admin-gallery') await renderAdminGallery(root);
      if (key === 'public-gallery') await renderPublicGallery(root);
      if (key === 'admin-hubs') await renderAdminHubs(root);
      if (key === 'public-hubs') await renderPublicHubs(root);
      if (key === 'admin-mous') await renderAdminMous(root);
      if (key === 'admin-team') await renderAdminTeam(root);
      if (key === 'public-team-leadership') await renderPublicTeam(root, 'leadership');
      if (key === 'public-team-scientific') await renderPublicTeam(root, 'scientific');
      if (key === 'public-team-executive') await renderPublicTeam(root, 'executive');
      if (key === 'dashboard-programs') await renderDashboardPrograms(root);
    } catch (error) {
      console.error('Supabase render error:', error);
      showToast(error.message || 'Supabase operation failed.', 'error');
    }
  }

  function scheduleInit(force) {
    clearTimeout(initTimer);
    initTimer = setTimeout(() => initLoadedContent(mainRoot(), force), 10);
  }

  async function handleAction(action, id) {
    if (action === 'close-request-modal') {
      closeRequestDetailModal();
      return;
    }
    if (action === 'view-request') return showRequestDetail(id);
    if (action === 'edit-program') {
      sessionStorage.setItem('nest_edit_program_id', id);
      window.location.hash = '#edit-program';
      return;
    }
    if (action === 'view-program') {
      window.location.href = 'index.html#programs';
      return;
    }
    if (action === 'delete-program') {
      await deleteRow('programs', id);
      markContentUpdated('programs');
    }
    if (action === 'delete-startup') await deleteRow('startups', id);
    if (action === 'delete-product') await deleteRow('marketplace_products', id);
    if (action === 'approve-request') return decideRequest(id, 'approved');
    if (action === 'reject-request') return decideRequest(id, 'rejected');
    if (action === 'view-newsletter') {
      const newsletter = await single('newsletters', id);
      if (newsletter.pdf_url) window.open(newsletter.pdf_url, '_blank');
      else showToast('No PDF has been uploaded for this newsletter.', 'error');
      return;
    }
    if (action === 'delete-newsletter') await deleteRow('newsletters', id);
    if (action === 'delete-gallery') {
      await deleteRow('gallery_items', id);
      markContentUpdated('gallery_items');
    }
    if (action === 'delete-hub') {
      await deleteRow('hubs', id);
      markContentUpdated('hubs');
    }
    if (action === 'delete-mou') {
      await deleteRow('mous', id);
      markContentUpdated('mous');
    }
    if (action === 'edit-team-member') return editTeamMember(id);
    if (action === 'delete-team-member') await deleteRow('team_members', id);
    showToast('Updated successfully.');
    scheduleInit(true);
  }

  function clickHandler(event) {
    const root = mainRoot();
    const key = root && root.dataset.nestSupabasePage;
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleAction(actionButton.dataset.action, actionButton.dataset.id).catch((error) => {
        console.error(error);
        showToast(error.message || 'Action failed.', 'error');
      });
      return;
    }
    const programLink = event.target.closest('[data-program-id]');
    if (programLink && programLink.dataset.programId) {
      sessionStorage.setItem('nest_selected_program_id', programLink.dataset.programId);
    }
    const button = event.target.closest('button');
    if (!button || !key) return;
    const label = lower(text(button));
    if (key === 'registration-form' && button.id === 'next-btn') {
      try {
        const form = root.querySelector('form');
        if (form) validateRegistrationForm(form, { visibleOnly: true });
      } catch (error) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showToast(error.message || 'Please fill all required fields.', 'error');
        return;
      }
    }
    if (key === 'login' && label === 'login') {
      const form = root.querySelector('#auth-form');
      if (!form) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      demoLogin(form).catch((error) => showToast(error.message || 'Login failed.', 'error'));
      return;
    }
    const intercept =
      (key === 'program-form' && (button.id === 'create-program-btn' || label === 'create program' || label === 'save changes')) ||
      (key === 'newsletter-form' && (button.id === 'upload-newsletter-btn' || label === 'upload')) ||
      (key === 'startup-application' && (button.id === 'apply-btn' || button.id === 'apply-btn-top')) ||
      (key === 'product-form' && (button.id === 'save-product-btn-top' || button.id === 'save-product-btn-bottom')) ||
      ((key === 'hub-form' || root.querySelector('#add-hub-form')) && (button.type === 'submit' || label.includes('add node'))) ||
      ((key === 'mou-form' || root.querySelector('#add-mou-form')) && (button.type === 'submit' || button.id === 'submit-mou-btn' || label.includes('submit mou') || label.includes('upload')));
    if (!intercept) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const map = {
      'program-form': () => saveProgram(root),
      'newsletter-form': () => saveNewsletter(root),
      'startup-application': () => submitStartupApplication(root),
      'product-form': () => submitProduct(root),
      'hub-form': () => saveHub(root),
      'mou-form': () => saveMou(root)
    };
    const handlerKey = key === 'hub-form' || root.querySelector('#add-hub-form') ? 'hub-form' : key;
    const finalHandlerKey = handlerKey === 'mou-form' || root.querySelector('#add-mou-form') ? 'mou-form' : handlerKey;
    map[finalHandlerKey]().catch((error) => {
      console.error(error);
      showToast(error.message || 'Save failed.', 'error');
    });
  }

  function submitHandler(event) {
    const form = event.target;
    const root = mainRoot();
    const key = root && root.dataset.nestSupabasePage;
    if (form.id === 'auth-form') {
      event.preventDefault();
      event.stopImmediatePropagation();
      demoLogin(form).catch((error) => showToast(error.message || 'Login failed.', 'error'));
      return;
    }
    if (form.id === 'add-hub-form') {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveHub(root).catch((error) => showToast(error.message || 'Save failed.', 'error'));
      return;
    }
    if (form.matches('#artisan-form, #traniee-form, #entrepreneur-form')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      submitRegistration(form).catch((error) => showToast(error.message || 'Registration failed.', 'error'));
      return;
    }
    if (form.id === 'add-mou-form') {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveMou(root).catch((error) => showToast(error.message || 'Save failed.', 'error'));
      return;
    }
    if (key === 'mou-form') {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveMou(root).catch((error) => showToast(error.message || 'Save failed.', 'error'));
    }
  }

  function startRealtime() {
    if (realtimeStarted || !supabase()) return;
    realtimeStarted = true;
    const channel = supabase().channel('nest-public-realtime');
    REALTIME_TABLES.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (table === 'notifications') refreshNotifications().catch(console.error);
        scheduleInit(true);
      });
    });
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') console.warn('Supabase realtime channel could not connect.');
    });
  }

  function getDashboardUrl(role) {
    if (role === 'admin') return 'admin.html#dashboard';
    if (role === 'entrepreneur') return 'entrepreneur.html#myidea';
    if (role === 'artisan') return 'artisan.html#marketplace';
    if (role === 'startup') return 'startup.html#mystartup';
    if (role === 'trainee') return 'trainee.html#programs';
    return 'index.html';
  }

  function updateNavbarAuthState() {
    const currentUser = readStore('nest_current_user', null);
    if (!currentUser) return;

    // Desktop Actions
    const desktopActions = document.querySelector('#navbar .hidden.lg\\:flex.items-center.gap-\\[8px\\]');
    if (desktopActions && desktopActions.querySelector('a[href*="login"]')) {
      const dashboardUrl = getDashboardUrl(currentUser.role);
      const name = html(currentUser.name);
      const email = html(currentUser.email || '');
      const initial = name ? name.charAt(0).toUpperCase() : 'U';

      desktopActions.innerHTML = `
        <a href="${dashboardUrl}" style="background-color: #f8f9fa; border: 1px solid #e5e7eb;" class="flex items-center gap-[10px] px-[10px] py-[6px] rounded-full hover:shadow-md transition-all duration-200">
          <div style="background-color: #e2e8f0; color: #1e293b;" class="w-[38px] h-[38px] rounded-full flex items-center justify-center font-['Inter'] font-bold text-[16px] shrink-0">
            ${initial}
          </div>
          <span class="font-['Inter'] font-semibold text-[#111827] text-[15px] pr-[4px] whitespace-nowrap">${name}</span>
        </a>
      `;
    }

    // Mobile Actions
    const mobileActions = document.querySelector('#navbar .mt-4.pt-4.border-t.border-gray-100.flex.flex-col.gap-3');
    if (mobileActions && mobileActions.querySelector('a[href*="login"]')) {
      const dashboardUrl = getDashboardUrl(currentUser.role);
      const name = html(currentUser.name);
      const email = html(currentUser.email || '');
      const initial = name ? name.charAt(0).toUpperCase() : 'U';

      mobileActions.innerHTML = `
        <a href="${dashboardUrl}" style="background-color: #f8f9fa; border: 1px solid #e5e7eb;" class="flex items-center gap-[12px] px-[10px] py-[10px] rounded-[16px] hover:shadow-md transition-all">
          <div style="background-color: #e2e8f0; color: #1e293b;" class="w-[40px] h-[40px] rounded-full flex items-center justify-center font-['Inter'] font-bold text-[16px] shrink-0">
            ${initial}
          </div>
          <span class="font-['Inter'] font-semibold text-[#111827] text-[15px] flex-1">${name}</span>
        </a>
      `;
    }
  }

  function init() {
    if (!supabase()) {
      console.warn('NEST Supabase client not available. Did you load @supabase/supabase-js first?');
      return;
    }
    document.addEventListener('click', clickHandler, true);
    document.addEventListener('submit', submitHandler, true);
    window.addEventListener('storage', (event) => {
      if (event.key === 'nest_content_updated_at') scheduleInit(true);
      if (event.key === 'nest_current_user') updateNavbarAuthState();
    });
    window.addEventListener('focus', () => scheduleInit(false));

    // Observe body for navbar injections
    const bodyObserver = new MutationObserver(() => updateNavbarAuthState());
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    updateNavbarAuthState();

    const root = mainRoot();
    if (root) {
      const observer = new MutationObserver(() => scheduleInit(true));
      observer.observe(root, { childList: true });
      scheduleInit(true);
    }
    refreshNotifications().catch(console.error);
    startRealtime();
  }

  window.NESTSupabaseApp = {
    refresh: () => scheduleInit(true),
    approveRequest: (id) => decideRequest(id, 'approved'),
    rejectRequest: (id) => decideRequest(id, 'rejected')
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
