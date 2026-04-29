(function () {
  const FALLBACK_IMAGE = 'https://placehold.co/800x480/f1ffee/2d5a3d?text=NEST';
  const FALLBACK_AVATAR = '/assets/logo/depositphotos_239470246-stock-illustration-user-sign-icon-person-symbol.jpg';
  const REALTIME_TABLES = [
    'programs',
    'program_registrations',
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
      phone: '+919876543201',
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
      phone: '+919876543202',
      redirect: 'trainee.html#programs'
    }
  };
  const PHONE_OTP_ROLES = new Set([]);
  const EMAIL_OTP_ROLES = new Set(['startup', 'entrepreneur', 'artisan', 'trainee', 'admin']);
  const SINGLE_EMAIL_ROLES = new Set(['startup', 'entrepreneur', 'artisan', 'trainee']);
  const OTP_COOLDOWN_MS = 60 * 1000;
  const AUTH_REQUEST_TIMEOUT_MS = 30000;
  const PROFILE_PHOTO_MAX_SOURCE_BYTES = 15 * 1024 * 1024;
  const PROFILE_PHOTO_TARGET_BYTES = 450 * 1024;
  const PROFILE_PHOTO_MAX_DIMENSION = 640;
  const USER_SCOPED_STORE_KEYS = ['nest_startup_application', 'nest_user_registration_application', 'nest_marketplace_products', 'nest_demo_session'];

  let currentPageKey = '';
  let initTimer = null;
  let realtimeStarted = false;
  let loginOtpState = null;
  let registrationOtpState = null;
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

  function isDashboardPage() {
    return !!document.body.dataset.dashboardRole;
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

  function formatFundingCompact(value) {
    if (!value) return 'NA';
    const num = Number(value.toString().replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num === 0) return html(value);

    if (num >= 10000000) { // 1 Crore
      return (num / 10000000).toFixed(1).replace(/\.0$/, '') + ' Cr';
    } else if (num >= 100000) { // 1 Lakh
      return (num / 100000).toFixed(1).replace(/\.0$/, '') + ' lac';
    }
    return num.toLocaleString('en-IN');
  }

  async function uploadFile(bucket, path, file) {
    const targetBucket = bucket === 'uploads' ? 'nest-assets' : bucket;
    const { data, error } = await supabase().storage.from(targetBucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });
    if (error) throw error;
    const { data: { publicUrl } } = supabase().storage.from(targetBucket).getPublicUrl(path);
    return publicUrl;
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

  function removeStore(key) {
    localStorage.removeItem(key);
  }

  function userSignature(user) {
    return `${lower(user && user.role)}|${lower(user && user.email)}`;
  }

  function clearUserScopedStores() {
    USER_SCOPED_STORE_KEYS.forEach(removeStore);
  }

  function persistCurrentUser(user) {
    const previous = readStore('nest_current_user', null);
    if (previous && userSignature(previous) && userSignature(previous) !== userSignature(user)) {
      clearUserScopedStores();
    }
    writeStore('nest_current_user', user);
    return user;
  }

  function rememberCurrentUser(role, fields) {
    const user = {
      role,
      name: fields.full_name || fields.founder_owner_name || fields.startup_name || fields.email_address || `${titleCase(role)} User`,
      email: lower(fields.email_address || ''),
      phone: normalizePhone(fields.phone_number || fields.mobile_number || fields.contact_number || fields.phone || '')
    };
    return persistCurrentUser(user);
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
      const control = wrapper && wrapper.querySelector('input, textarea, select');
      if (!control || control.type === 'password' || (!includeHidden && control.closest('.hidden'))) return;
      const key = toKey(text(label));
      if (control.type === 'file') {
        return;
      } else {
        fields[key] = control.tagName === 'SELECT' ? selectedText(control) : clean(control.value);
      }
    });
    return fields;
  }

  function installDocumentUploadInputs(root) {
    root.querySelectorAll('.document-card').forEach((card, index) => {
      const title = text(card.querySelector('.font-bold')) || `Document ${index + 1}`;
      const button = card.querySelector('.select-file-btn');
      const input = card.querySelector('input[type="file"]') || document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      if (!input.classList.contains('hidden')) input.classList.add('hidden');
      input.dataset.nestDocumentInput = 'true';
      input.dataset.documentTitle = title;
      input.multiple = true;
      if (!input.parentElement && button) button.insertAdjacentElement('afterend', input);
      if (button && button.tagName === 'BUTTON') button.type = 'button';
      if (button) button.removeAttribute('onclick');
    });
  }

  function selectedDocumentFiles(form) {
    const seen = new Set();
    const inputs = Array.from(form.querySelectorAll('.document-card input[type="file"], input[type="file"][data-nest-document-input]'))
      .filter((input) => {
        if (seen.has(input)) return false;
        seen.add(input);
        return input.dataset.nestDocumentInput === 'true' || (input.files && input.files.length);
      });
    return inputs.flatMap((input) =>
      Array.from(input.files || []).map((file, index) => ({
        file,
        title: input.dataset.documentTitle || text(input.closest('.document-card') && input.closest('.document-card').querySelector('.font-bold')) || `Document ${index + 1}`
      }))
    );
  }

  async function uploadRegistrationDocuments(form, role) {
    const docs = [];
    const selectedFiles = selectedDocumentFiles(form);
    for (const item of selectedFiles) {
      const file = item.file;
      if (!file) continue;
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error(`${item.title} must be a PDF file.`);
      }
      if (file.size > 25 * 1024 * 1024) {
        throw new Error(`${item.title} must be less than 25 MB.`);
      }
      const url = await upload(file, `registration-documents/${role}`);
      docs.push({
        title: item.title,
        name: file.name,
        url,
        size: file.size,
        type: file.type || 'application/pdf'
      });
    }
    return docs;
  }

  function documentFileLabel(value, title, name) {
    const raw = clean(value);
    if (clean(name)) return clean(name);
    if (/^https?:\/\//i.test(raw)) return decodeURIComponent(raw.split('/').pop() || title || 'Document').replace(/^\d+-/, '');
    if (raw.match(/\.(pdf|docx?|png|jpe?g|webp)$/i)) return raw;
    return title || 'Document';
  }

  function documentPreviewUrl(value) {
    const raw = clean(value);
    return /^(https?:|blob:|data:|\/|assets\/|uploads\/|pages\/)/i.test(raw) ? raw : '';
  }

  function collectDocumentItems(sources) {
    const docs = [];
    const seen = new Set();
    const skipKey = /password|profile_id|startup_id|product_id|image_url|logo_url|avatar|photo/i;
    const docKey = /(document|file|pdf|deck|certificate|proposal|mou)/i;
    const addDoc = (doc, fallbackTitle) => {
      if (!doc) return;
      if (Array.isArray(doc)) {
        doc.forEach((item, index) => addDoc(item, fallbackTitle || `Document ${index + 1}`));
        return;
      }
      if (typeof doc === 'object') {
        const value = clean(doc.url || doc.value || doc.href || doc.publicUrl || doc.public_url || doc.path || doc.file_url || doc.download_url);
        if (value) {
          if (/\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(value)) return;
          const title = clean(doc.title || doc.label || doc.document_title || fallbackTitle || doc.name || doc.file_name || 'Document');
          const name = clean(doc.name || doc.file_name || doc.original_name || '');
          const signature = `${value}|${title}|${name}`;
          if (seen.has(signature)) return;
          seen.add(signature);
          docs.push({
            title,
            value,
            name,
            label: documentFileLabel(value, title, name)
          });
          return;
        }
        Object.keys(doc).forEach((key) => {
          if (skipKey.test(key)) return;
          const value = doc[key];
          if (docKey.test(key) || Array.isArray(value) || (value && typeof value === 'object')) addDoc(value, titleCase(key));
        });
        return;
      }
      const value = clean(doc);
      if (!value) return;
      if (/\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(value)) return;
      const title = clean(fallbackTitle) || 'Document';
      const signature = `${value}|${title}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      docs.push({
        title,
        value,
        name: '',
        label: documentFileLabel(value, title, '')
      });
    };
    (sources || []).forEach((source) => {
      const data = payloadObject(source);
      Object.keys(data).forEach((key) => {
        const rawValue = data[key];
        if (!rawValue || skipKey.test(key)) return;
        if (docKey.test(key)) addDoc(rawValue, titleCase(key));
      });
    });
    return docs;
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
    control.classList.add('!ring-2', '!ring-red-500', '!border-red-500');
    const removeInvalid = () => {
      control.classList.remove('!ring-2', '!ring-red-500', '!border-red-500');
      control.removeEventListener('input', removeInvalid);
      control.removeEventListener('change', removeInvalid);
    };
    control.addEventListener('input', removeInvalid);
    control.addEventListener('change', removeInvalid);
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
    const missing = candidates.filter(controlIsEmpty);
    if (missing.length > 0) {
      missing.forEach(markInvalidControl);
      const err = new Error('Please fill all required registration fields before continuing.');
      err.isSilent = true;
      throw err;
    }
    const passwords = candidates.filter((control) => control.type === 'password');
    const confirm = passwords.find((control) => /confirm/i.test(`${control.id || ''} ${control.name || ''} ${control.placeholder || ''} ${controlLabel(control)}`));
    const password = passwords.find((control) => control !== confirm);
    if (password && confirm && clean(password.value) !== clean(confirm.value)) {
      markInvalidControl(confirm);
      throw new Error('Password and confirm password must match.');
    }
  }

  function registrationPassword(form) {
    const passwords = Array.from(form.querySelectorAll('input[type="password"]'));
    const confirm = passwords.find((control) => /confirm/i.test(`${control.id || ''} ${control.name || ''} ${control.placeholder || ''} ${controlLabel(control)}`));
    const password = passwords.find((control) => control !== confirm);
    const value = clean(password && password.value);
    if (!value) throw new Error('Please create a password for this account.');
    if (value.length < 8) throw new Error('Password must be at least 8 characters.');
    if (confirm && value !== clean(confirm.value)) throw new Error('Password and confirm password must match.');
    return value;
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
    if (row.dashboard_registration_status) {
      const registeredAt = row.dashboard_registered_at ? ` on ${formatDate(row.dashboard_registered_at)}` : '';
      return `${titleCase(row.dashboard_registration_status)}${registeredAt}`;
    }
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

  function missingProgramRegistrationTable(error) {
    const message = lower(error && (error.message || error.details || error.hint || error.code));
    return message.includes('program_registrations') || message.includes('schema cache') || message.includes('relation') || message.includes('pgrst');
  }

  async function currentUserProgramRegistrations(user) {
    if (!user || !user.email) return [];
    try {
      return await rows('program_registrations', (q) =>
        q
          .ilike('user_email', user.email)
          .eq('user_role', lower(user.role))
          .order('registered_at', { ascending: false })
      );
    } catch (error) {
      if (missingProgramRegistrationTable(error)) {
        console.warn('program_registrations table is not available yet. Run the latest supabase/schema.sql to enable program registrations.');
        return [];
      }
      throw error;
    }
  }

  async function currentUserProfile(user) {
    if (!user || !user.email || !user.role) return null;
    const matches = await rows('profiles', (q) =>
      q
        .ilike('email', lower(user.email))
        .eq('role', lower(user.role))
        .order('created_at', { ascending: false })
        .limit(1)
    );
    return matches[0] || null;
  }

  function setProfileControl(root, labels, value, fallback) {
    const wanted = new Set(labels.map(toKey));
    const label = Array.from(root.querySelectorAll('label')).find((item) => wanted.has(toKey(text(item))));
    const wrapper = label && (label.closest('div') || label.parentElement);
    const control = wrapper && wrapper.querySelector('input:not([type="password"]), textarea, select');
    if (!control) return;
    const finalValue = clean(value) || fallback || '';
    if (control.tagName === 'SELECT') setSelect(control, finalValue);
    else control.value = finalValue;
  }

  function avatarUrl(name) {
    const label = encodeURIComponent(clean(name) || 'NEST User');
    return `https://ui-avatars.com/api/?name=${label}&background=2D5A3D&color=fff&size=512`;
  }

  function profileAvatarUrl(sources, name) {
    return requestValue(sources, ['avatar_url', 'avatarUrl', 'profile_photo_url', 'profile_image_url', 'photo_url', 'image_url'], '') || avatarUrl(name);
  }

  function ensureProfilePhotoInput(root) {
    const avatar = root.querySelector('#user-avatar');
    const avatarWrap = avatar && avatar.closest('.relative');
    const button =
      (avatarWrap && avatarWrap.querySelector('button')) ||
      root.querySelector('button[onclick*="simulateAvatarChange"]');
    if (button) {
      button.id = 'profile-avatar-btn';
      button.type = 'button';
      button.removeAttribute('onclick');
      button.title = 'Upload profile photo';
      button.setAttribute('aria-label', 'Upload profile photo');
    }
    let input = root.querySelector('[data-nest-profile-photo-input]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp';
      input.className = 'hidden';
      input.dataset.nestProfilePhotoInput = 'true';
      root.appendChild(input);
    }
    return input;
  }

  function loadImageForCompression(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('The selected image could not be read.'));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('This browser could not compress the selected image.'));
        },
        type,
        quality
      );
    });
  }

  async function compressProfilePhoto(file) {
    const image = await loadImageForCompression(file);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    const scale = Math.min(1, PROFILE_PHOTO_MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);

    let blob = null;
    let outputType = 'image/webp';
    for (let quality = 0.82; quality >= 0.5; quality -= 0.08) {
      try {
        blob = await canvasToBlob(canvas, outputType, quality);
      } catch (error) {
        blob = null;
      }
      if (blob && blob.type && blob.type !== outputType) blob = null;
      if (blob && blob.size <= PROFILE_PHOTO_TARGET_BYTES) break;
    }

    if (!blob) {
      outputType = 'image/jpeg';
      const jpegContext = canvas.getContext('2d');
      jpegContext.globalCompositeOperation = 'destination-over';
      jpegContext.fillStyle = '#ffffff';
      jpegContext.fillRect(0, 0, width, height);
      blob = await canvasToBlob(canvas, outputType, 0.78);
    }

    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const baseName = (clean(file.name).replace(/\.[^.]+$/, '') || 'profile-photo').slice(0, 80);
    return new File([blob], `${baseName}.${extension}`, {
      type: blob.type || outputType,
      lastModified: Date.now()
    });
  }

  function profileDetailKey(key) {
    const normalized = toKey(key);
    const aliases = {
      full_name: 'identity_name',
      founder_owner_name: 'identity_name',
      requester_name: 'identity_name',
      name: 'startup_name',
      startup_name: 'startup_name',
      idea_name: 'startup_name',
      business_name: 'startup_name',
      email: 'email',
      email_address: 'email',
      phone: 'phone',
      phone_number: 'phone',
      mobile_number: 'phone',
      contact_number: 'phone',
      user_role: 'role',
      role: 'role',
      status: 'status',
      organization: 'organization',
      state: 'state_region',
      state_region: 'state_region',
      location: 'state_region',
      complete_full_address: 'address',
      workshop_residence_address: 'address',
      address: 'address',
      industry_type: 'industry_type',
      category: 'industry_type',
      shop_name_optional: 'shop_name',
      shop_name: 'shop_name',
      gst_number_optional: 'gst_number',
      gst_number: 'gst_number',
      website_link_optional: 'website_link',
      website_link: 'website_link',
      website_url: 'website_link',
      funding_raised_inr: 'funding_raised',
      funding_raised: 'funding_raised',
      estimated_budget: 'budget',
      budget: 'budget',
      brief_idea_description: 'idea_description',
      startup_overview: 'startup_overview',
      overview: 'startup_overview'
    };
    return aliases[normalized] || normalized;
  }

  function profileDetailLabel(key) {
    const labels = {
      state_region: 'State / Region',
      address: 'Address',
      industry_type: 'Industry / Type',
      shop_name: 'Shop Name',
      gst_number: 'GST Number',
      website_link: 'Website Link',
      funding_raised: 'Funding Raised',
      idea_description: 'Idea Description',
      startup_overview: 'Startup Overview',
      team_size: 'Team Size',
      date_of_birth: 'Date of Birth'
    };
    return labels[key] || titleCase(key);
  }

  function profileDetailRows(sources) {
    const skip = /(^id$|_id$|created_at|updated_at|metadata|password|confirm|otp|token|profile_id|startup_id|request_id|product_id|submitted_as|auth|avatar|profile_photo|profile_image|photo_url)/i;
    const skipKeys = new Set(['identity_name', 'startup_name', 'email', 'phone', 'role', 'status', 'organization']);
    const seen = new Set();
    const seenValues = new Set();
    const rowsList = [];
    sources.forEach((source) => {
      const data = payloadObject(source);
      Object.keys(data).forEach((key) => {
        if (data[key] && typeof data[key] === 'object') return;
        const normalized = profileDetailKey(key);
        const value = clean(data[key]);
        const valueKey = lower(value).replace(/\s+/g, ' ');
        if (!value || skip.test(normalized) || skipKeys.has(normalized) || seen.has(normalized) || seenValues.has(valueKey)) return;
        seen.add(normalized);
        seenValues.add(valueKey);
        rowsList.push([profileDetailLabel(normalized), value]);
      });
    });
    return rowsList;
  }

  function renderProfileDetailsCard(root, sources) {
    const rowsList = profileDetailRows(sources).slice(0, 12);
    const old = root.querySelector('[data-nest-profile-details]');
    if (old) old.remove();
    if (!rowsList.length) return;
    const overview = root.querySelector('#user-avatar') && root.querySelector('#user-avatar').closest('.w-full.bg-white');
    if (!overview) return;
    overview.insertAdjacentHTML(
      'afterend',
      `<div data-nest-profile-details class="w-full bg-white rounded-[10px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] border border-gray-100 p-8">
        <h3 class="font-['Manrope'] font-bold text-[18px] text-[#1b3a28] mb-5">Registration Details</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          ${rowsList
        .map(
          ([label, value]) => `
                <div class="rounded-[10px] bg-[#f9fafb] border border-gray-100 p-4">
                  <span class="block font-['Manrope'] font-bold text-[11px] text-[#677461] uppercase tracking-wider mb-1">${html(label)}</span>
                  <span class="block font-['Inter'] font-semibold text-[#1b3a28] text-[14px] break-words">${html(value)}</span>
                </div>`
        )
        .join('')}
        </div>
      </div>`
    );
  }

  function mergedProfileMetadata(profile, fields, phone) {
    return {
      ...payloadObject(profile && profile.metadata),
      ...fields,
      phone_number: phone
    };
  }

  async function renderDashboardUserProfile(root) {
    const user = readStore('nest_current_user', {});
    const profile = await currentUserProfile(user);
    const startup = lower(user.role) === 'startup' || lower(user.role) === 'entrepreneur' ? await getStoredStartup() : null;
    const sources = [startup || {}, payloadObject(startup && startup.metadata), profile || {}, payloadObject(profile && profile.metadata), user || {}];
    const role = lower((profile && profile.role) || user.role || document.body.dataset.dashboardRole || 'user');
    const displayName =
      role === 'startup'
        ? requestValue(sources, ['startup_name', 'name'], (profile && profile.full_name) || user.name || 'Startup')
        : requestValue(sources, ['full_name', 'founder_owner_name', 'requester_name'], (profile && profile.full_name) || user.name || `${titleCase(role)} User`);
    const email = requestValue(sources, ['email', 'email_address'], (profile && profile.email) || user.email || '');
    const phone = requestValue(sources, ['phone', 'phone_number', 'mobile_number', 'contact_number'], (profile && profile.phone) || user.phone || '');
    const startupName = requestValue(sources, ['startup_name', 'name', 'idea_name', 'business_name'], startup && startup.name);
    const status = requestValue(sources, ['status'], (profile && profile.status) || (startup && startup.status) || user.status || '');

    const profileTitle = root.querySelector('#user-avatar') && root.querySelector('#user-avatar').closest('.w-full.bg-white')?.querySelector('h2');
    if (profileTitle) profileTitle.textContent = displayName;
    const roleBadge = root.querySelector('#user-avatar') && root.querySelector('#user-avatar').closest('.w-full.bg-white')?.querySelector('span');
    if (roleBadge) roleBadge.textContent = status ? `${titleCase(role)} - ${titleCase(status)}` : titleCase(role);
    const avatar = root.querySelector('#user-avatar');
    if (avatar) {
      avatar.src = profileAvatarUrl(sources, displayName);
      avatar.alt = `${displayName} Profile`;
    }
    ensureProfilePhotoInput(root);

    setProfileControl(root, ['Full Name'], displayName, `${titleCase(role)} User`);
    setProfileControl(root, ['Startup Name'], startupName || displayName, 'Not provided');
    setProfileControl(root, ['Email Address'], email, '');
    setProfileControl(root, ['Phone Number'], phone, 'Not provided');
    setProfileControl(root, ['Specialization'], requestValue(sources, ['specialization', 'craft_specialization', 'shop_name_optional', 'shop_name', 'industry_type', 'category'], ''), 'Not provided');
    setProfileControl(root, ['Workshop / Residence Address', 'Complete Full Address'], requestValue(sources, ['complete_full_address', 'address', 'workshop_residence_address'], ''), 'Not provided');
    setProfileControl(root, ['Designation'], requestValue(sources, ['designation', 'organization'], role === 'admin' ? 'Admin' : titleCase(role)), titleCase(role));

    const detailCard = root.querySelector('[data-nest-profile-details]');
    if (detailCard) detailCard.remove();
    const otpModal = root.querySelector('#otp-modal');
    if (otpModal) otpModal.remove();

    if (profile && user.email) {
      persistCurrentUser({
        ...user,
        name: displayName,
        email,
        phone,
        role,
        profileId: profile.id,
        status: profile.status
      });
      updateNavbarAuthState();
    }
  }

  async function saveDashboardUserProfile(root) {
    const user = readStore('nest_current_user', {});
    const profile = await currentUserProfile(user);
    if (!profile) throw new Error('No profile record was found for this account.');

    const fields = collectLabeledFields(root, { includeHidden: true });
    const role = lower(profile.role || user.role || document.body.dataset.dashboardRole || '');
    const startup = role === 'startup' || role === 'entrepreneur' ? await getStoredStartup() : null;
    const profileMetadata = payloadObject(profile.metadata);
    const startupMetadata = payloadObject(startup && startup.metadata);
    const sources = [fields, startup || {}, startupMetadata, profile, profileMetadata, user || {}];
    const email = lower(fields.email_address || profile.email || user.email || '');
    const phone = normalizePhone(fields.phone_number || profile.phone || user.phone || '');
    const displayName =
      role === 'startup'
        ? requestValue(sources, ['startup_name', 'name'], profile.full_name || user.name || 'Startup')
        : requestValue(sources, ['full_name', 'founder_owner_name', 'requester_name'], profile.full_name || user.name || `${titleCase(role)} User`);
    const startupName = requestValue(sources, ['startup_name', 'name', 'idea_name', 'business_name'], startup && startup.name);

    const profilePatch = {
      full_name: displayName,
      email,
      phone,
      organization: fields.designation || profile.organization || null,
      metadata: mergedProfileMetadata(profile, fields, phone)
    };
    await updateRow('profiles', profile.id, profilePatch);

    if (startup && (role === 'startup' || role === 'entrepreneur')) {
      await updateRow('startups', startup.id, {
        name: startupName || startup.name || displayName,
        email,
        phone,
        category: fields.specialization || fields.industry_type || startup.category || null,
        overview: fields.startup_overview || fields.brief_idea_description || startup.overview || null,
        metadata: {
          ...startupMetadata,
          ...fields,
          phone_number: phone
        }
      });
      const storedApp = readStore('nest_startup_application', null);
      if (storedApp && storedApp.startupId === startup.id) {
        writeStore('nest_startup_application', {
          ...storedApp,
          email,
          role,
          startupId: startup.id
        });
      }
    }

    persistCurrentUser({
      ...user,
      name: displayName,
      email,
      phone,
      role,
      profileId: profile.id,
      startupId: startup && startup.id,
      status: profile.status
    });
    updateNavbarAuthState();
    if (typeof window.toggleEditMode === 'function') window.toggleEditMode(false);
    await renderDashboardUserProfile(root);
    markContentUpdated('profiles');
    if (startup) markContentUpdated('startups');
    showToast('Profile details saved.');
  }

  async function uploadDashboardProfilePhoto(root, file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      throw new Error('Please choose a PNG, JPG, or WebP image.');
    }
    if (file.size > PROFILE_PHOTO_MAX_SOURCE_BYTES) {
      throw new Error('Please choose an image smaller than 15 MB. It will be compressed automatically.');
    }

    const user = readStore('nest_current_user', {});
    const profile = await currentUserProfile(user);
    if (!profile) throw new Error('No profile record was found for this account.');

    const button = root.querySelector('#profile-avatar-btn');
    if (button) button.disabled = true;
    try {
      const compressedFile = await compressProfilePhoto(file);
      const photoUrl = await upload(compressedFile, 'profile-photos');
      const metadata = {
        ...payloadObject(profile.metadata),
        avatar_url: photoUrl,
        avatar_original_size: file.size,
        avatar_compressed_size: compressedFile.size
      };
      await updateRow('profiles', profile.id, { metadata });
      const avatar = root.querySelector('#user-avatar');
      if (avatar) avatar.src = photoUrl;
      persistCurrentUser({
        ...user,
        avatarUrl: photoUrl,
        profileId: profile.id,
        status: profile.status
      });
      markContentUpdated('profiles');
      updateNavbarAuthState();
      showToast('Profile photo updated.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function registerForProgram(programId) {
    const user = readStore('nest_current_user', {});
    if (!user.email || !user.role) {
      showToast('Please login or register before joining a program.', 'error');
      setTimeout(() => {
        window.location.href = 'index.html#login';
      }, 700);
      return;
    }

    const program = await single('programs', programId);
    if (!program || program.published === false) throw new Error('This program is not available for registration.');

    const registrations = await currentUserProgramRegistrations(user);
    if (registrations.some((item) => item.program_id === programId)) {
      showToast('You are already registered for this program.');
      return;
    }

    const profile = await currentUserProfile(user);
    try {
      await insertRow('program_registrations', {
        program_id: programId,
        profile_id: profile && profile.id,
        user_email: lower(user.email),
        user_role: lower(user.role),
        status: 'registered',
        metadata: {
          program_title: program.title || '',
          user_name: user.name || (profile && profile.full_name) || ''
        }
      });
    } catch (error) {
      if (missingProgramRegistrationTable(error)) {
        throw new Error('Run the updated supabase/schema.sql once to enable program registrations.');
      }
      if (String(error.code || '').includes('23505')) {
        showToast('You are already registered for this program.');
        return;
      }
      throw error;
    }

    const registerButton = document.querySelector(`[data-action="register-program"][data-id="${programId}"]`);
    if (registerButton) registerButton.textContent = 'Registered';
    markContentUpdated('program_registrations');
    showToast('Program registered. It will appear in your dashboard.');
  }

  function setDashboardProgramCounts(root, counts) {
    ['upcoming', 'ongoing', 'completed'].forEach((status) => {
      const count = root.querySelector(`#tab-${status} .js-tab-count`);
      if (count) count.textContent = String(counts[status] || 0);
    });
  }

  function dashboardProgramsEmptyHtml(message, actionText) {
    return `
      <div class="w-full max-w-[1073px] mx-auto bg-white rounded-[18px] border border-gray-100 p-8 text-center font-['Inter'] text-[#677461]">
        <h2 class="font-['Manrope'] font-bold text-[#1b3a28] text-[22px] mb-2">No registered programs yet</h2>
        <p>${html(message)}</p>
        <a href="index.html#programs" class="inline-flex items-center justify-center mt-5 px-6 py-3 rounded-[10px] bg-[#2d5a3d] text-white font-['Manrope'] font-bold text-[14px] hover:bg-[#1b3a28] transition-all">${html(actionText || 'Browse Programs')}</a>
      </div>`;
  }

  function startupCard(row) {
    return `
      <div class="bg-white border border-[#f3f4f6] flex flex-col gap-[28px] items-center justify-between p-[24px] rounded-[32px] shadow-[0px_4px_20px_rgba(0,0,0,0.03)] w-full sm:w-[calc(50%-18px)] lg:w-[calc(33.333%-24px)] max-w-[390px] hover:shadow-xl transition-all duration-300">
        <div class="flex flex-col gap-[12px] items-center w-full">
          <h3 class="font-['Inter'] font-bold leading-tight text-[#1b3a28] text-[24px] text-center">${html(row.name)}</h3>
          <div class="bg-[#f1ffee] flex items-center justify-center px-[16px] py-[6px] rounded-[23px]">
            <span class="font-['Inter'] font-medium text-[#2d5a3d] text-[15px] text-center whitespace-nowrap">${html(row.category || 'Startup')}</span>
          </div>
        </div>
        <div class="flex-1 flex items-center justify-center overflow-hidden w-full min-h-[120px] bg-[#f1ffee]/30 rounded-[12px] p-6">
          <img src="${html(row.logo_url || FALLBACK_IMAGE)}" alt="${html(row.name)} logo" class="max-h-[80px] w-auto max-w-full object-contain pointer-events-none">
        </div>
        <div class="flex items-center justify-between w-full max-w-[320px] px-2">
          <div class="flex flex-col gap-[6px] items-center justify-center flex-1">
            <span class="font-['Inter'] font-semibold text-[#677461] text-[13px] opacity-80">Established</span>
            <span class="font-['Inter'] font-bold text-[#1b3a28] text-[20px] leading-none">${html(row.established_year || 'NA')}</span>
          </div>
          <div class="bg-gray-200 h-[32px] w-[1.5px] mx-1"></div>
          <div class="flex flex-col gap-[6px] items-center justify-center flex-1">
            <span class="font-['Inter'] font-semibold text-[#677461] text-[13px] opacity-80 text-center">Funding Raised</span>
            <span class="font-['Inter'] font-bold text-[#1b3a28] text-[20px] leading-none">${html(formatFundingCompact(row.funding_raised))}</span>
          </div>
          <div class="bg-gray-200 h-[32px] w-[1.5px] mx-1"></div>
          <div class="flex flex-col gap-[6px] items-center justify-center flex-1">
            <span class="font-['Inter'] font-semibold text-[#677461] text-[13px] opacity-80">State</span>
            <span class="font-['Inter'] font-bold text-[#1b3a28] text-[20px] leading-none truncate max-w-[90px]">${html(row.state || 'NA')}</span>
          </div>
        </div>
        <a href="${html(row.website_url || '#')}" target="_blank" class="bg-[#335340] flex items-center justify-center px-[26px] py-[16px] rounded-[12px] w-full hover:bg-[#213a2b] transition-all mt-2 shadow-sm group">
          <span class="font-['Inter'] font-bold text-[18px] text-white whitespace-nowrap flex items-center gap-2">
            Visit Website <span class="group-hover:translate-x-1 transition-transform">→</span>
          </span>
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
    const docs = collectDocumentItems(sources);
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
      .map(
        (doc, index) => {
          const fileLabel = doc.label || doc.title;
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
            documentPreviewUrl(doc.value)
              ? `<a href="${html(documentPreviewUrl(doc.value))}" target="_blank" rel="noopener noreferrer" class="font-['Inter'] font-bold text-[#2d5a3d] text-[12px]">Preview</a>`
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
    const documentsBlock = isProduct
      ? ''
      : `<div class="flex flex-col gap-[16px]">
          <h4 class="font-['Inter'] font-bold text-[#677461] text-[12px] uppercase tracking-[0.1em]">Documents</h4>
          <div class="flex flex-col gap-3">${requestDocumentsHtml(sources)}</div>
        </div>`;
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
                  ${pending
        ? `<button data-action="reject-request" data-id="${row.id}" class="bg-[#b04a4a] text-white px-10 py-4 rounded-[16px] font-['Manrope'] font-bold text-[16px] shadow-lg hover:bg-[#8e3b3b] transform hover:-translate-y-1 transition-all">Reject Request</button>
                         <button data-action="approve-request" data-id="${row.id}" class="bg-[#1b3a28] text-white px-10 py-4 rounded-[16px] font-['Manrope'] font-bold text-[16px] shadow-lg hover:bg-[#142c1e] transform hover:-translate-y-1 transition-all">Approve Request</button>`
        : `<div class="rounded-[16px] bg-[#f0f2f0] px-8 py-4 font-['Manrope'] font-bold text-[#677461] text-[16px]">Request already ${html(row.status || 'reviewed')}</div>`
      }
                </div>
              </div>
              <div class="flex flex-col gap-[32px]">
                ${documentsBlock}
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

  function startupDetailModal(row) {
    const sources = [row, payloadObject(row.metadata)];
    const title = row.name || 'Startup';
    const founder = requestValue(sources, ['founder_name', 'founder_owner_name', 'full_name'], row.founder_name || 'Founder not provided');
    const overview = requestValue(sources, ['overview', 'startup_overview', 'brief_idea_description', 'description'], 'No overview was entered.');
    const details = [
      ['Founded Date', requestValue(sources, ['founded_date', 'established_year', 'year'], row.established_year || '')],
      ['Registration Type', requestValue(sources, ['registration_type', 'company_type', 'startup_type'], row.category || 'Startup')],
      ['Team size', requestValue(sources, ['team_size'], row.team_size || '')],
      ['Funding', formatBudgetText(requestValue(sources, ['funding_raised', 'funding_raised_inr', 'budget'], row.funding_raised || ''))]
    ];
    return `
      <div id="request-detail-modal" class="fixed inset-0 items-start justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm py-[60px]" style="position: fixed; inset: 0; z-index: 2147483647; display: flex; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(4px);">
        <div class="fixed inset-0 z-0" data-action="close-request-modal"></div>
        <div class="relative z-10 bg-white rounded-[32px] shadow-[0px 20px 60px rgba(0,0,0,0.1)] p-[32px] md:p-[40px] w-full max-w-[1140px]" style="position: relative; z-index: 1; width: min(1140px, calc(100vw - 32px));">
          <button data-action="close-request-modal" class="absolute top-8 right-8 text-gray-400 hover:text-red-600 transition-all" aria-label="Close startup detail">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div class="flex flex-col gap-[32px]">
            <div class="flex flex-col gap-[8px] pr-12">
              <h2 class="font-['Manrope'] font-bold text-[#1b3a28] text-[28px] leading-tight max-w-[80%] uppercase tracking-tight">${html(title).toUpperCase()}</h2>
              <p class="font-['Inter'] text-[#677461] text-[16px]">${html(founder)} &bull; ${html(row.category || 'Startup')}</p>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-[40px]">
              <div class="lg:col-span-2 flex flex-col gap-[32px]">
                <div class="flex flex-col gap-[16px]">
                  <h4 class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px]">Overview</h4>
                  <p class="font-['Inter'] text-[#464E42] text-[15px] leading-relaxed">${html(overview)}</p>
                </div>
                <div class="bg-[#f9f8f4] rounded-[20px] p-[28px] md:p-[32px] flex flex-col gap-[24px]">
                  <h4 class="font-['Inter'] font-bold text-[#677461] text-[12px] uppercase tracking-[0.1em]">Establishment & Roots</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[24px]">
                    ${details.map(([label, value]) => requestDetailItem(label, value)).join('')}
                  </div>
                </div>
              </div>
              <div class="flex flex-col gap-[32px]">
                <div class="flex flex-col gap-[16px]">
                  <h4 class="font-['Inter'] font-bold text-[#677461] text-[12px] uppercase tracking-[0.1em]">Documents & Assets</h4>
                  <div class="flex flex-col gap-3">${requestDocumentsHtml(sources)}</div>
                </div>
                <div class="bg-[#f1fff6] rounded-[20px] p-[24px] flex flex-col gap-[20px]" style="background: #f1fff6;">
                  <div class="flex flex-col gap-[4px]">
                    <span class="font-['Inter'] text-[#677461] text-[12px]">Official Email</span>
                    <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[15px] break-words">${html(requestValue(sources, ['email', 'email_address'], row.email || '') || 'Not provided')}</span>
                  </div>
                  <div class="flex flex-col gap-[4px]">
                    <span class="font-['Inter'] text-[#677461] text-[12px]">Phone Number</span>
                    <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[15px]">${html(requestValue(sources, ['phone', 'phone_number'], row.phone || '') || 'Not provided')}</span>
                  </div>
                  <div class="flex flex-col gap-[4px]">
                    <span class="font-['Inter'] text-[#677461] text-[12px]">Headquarters</span>
                    <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[15px]">${html(requestValue(sources, ['headquarters', 'state', 'state_region', 'location'], row.state || '') || 'Not provided')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  async function showStartupDetail(id) {
    const startup = await single('startups', id);
    closeRequestDetailModal();
    document.body.insertAdjacentHTML('beforeend', startupDetailModal(startup));
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
            ${pending
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
    if (root.querySelector('#user-avatar') && heading.includes('profile')) return 'dashboard-user-profile';
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
    installProgramFileInputs(root);
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

  function programFileInputs(root) {
    const inputs = Array.from(root.querySelectorAll('input[type="file"]'));
    return {
      image: root.querySelector('[data-program-file="image"]') || inputs[0] || null,
      brochure: root.querySelector('[data-program-file="brochure"]') || inputs[1] || null
    };
  }

  function programFileName(file) {
    if (!file) return '';
    const sizeMb = file.size ? ` ${(file.size / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB` : '';
    return `${file.name}${sizeMb ? ` - ${sizeMb}` : ''}`;
  }

  function updateProgramFileLabel(input) {
    const zone = input && input.closest('[data-nest-program-file-zone]');
    if (!zone) return;
    const selected = zone.querySelector('[data-nest-program-selected]');
    const file = input.files && input.files[0];
    if (selected) {
      selected.textContent = file ? programFileName(file) : 'No file selected';
      selected.classList.toggle('text-[#2d5a3d]', Boolean(file));
      selected.classList.toggle('text-[#677461]', !file);
    }
  }

  function setProgramDropFile(input, file) {
    if (!file || !window.DataTransfer) return false;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    updateProgramFileLabel(input);
    return true;
  }

  function installProgramFileInputs(root) {
    const { image, brochure } = programFileInputs(root);
    [
      { input: image, type: 'image', accept: 'image/*', empty: 'No banner image selected' },
      { input: brochure, type: 'brochure', accept: 'application/pdf,.pdf', empty: 'No brochure PDF selected' }
    ].forEach(({ input, type, accept, empty }) => {
      if (!input) return;
      input.dataset.programFile = type;
      input.dataset.nestProgramFile = 'true';
      input.accept = accept;
      const zone = input.closest('.border-dashed') || input.parentElement;
      if (!zone) return;
      zone.dataset.nestProgramFileZone = type;
      zone.setAttribute('role', 'button');
      zone.setAttribute('tabindex', '0');
      if (!zone.querySelector('[data-nest-program-selected]')) {
        input.insertAdjacentHTML(
          'beforebegin',
          `<span data-nest-program-selected class="font-['Inter'] text-[#677461] text-[12px] max-w-full text-center break-words">${empty}</span>`
        );
      }
      if (zone.dataset.programFileReady !== 'true') {
        zone.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            input.click();
          }
        });
        zone.addEventListener('dragover', (event) => {
          event.preventDefault();
          zone.classList.add('border-[#2D5A3D]', 'bg-[#f1ffee]/30');
        });
        zone.addEventListener('dragleave', () => {
          zone.classList.remove('border-[#2D5A3D]', 'bg-[#f1ffee]/30');
        });
        zone.addEventListener('drop', (event) => {
          event.preventDefault();
          zone.classList.remove('border-[#2D5A3D]', 'bg-[#f1ffee]/30');
          const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
          if (file && !setProgramDropFile(input, file)) {
            showToast('Please click the upload box and select the file.', 'error');
          }
        });
        zone.dataset.programFileReady = 'true';
      }
      updateProgramFileLabel(input);
    });
  }

  function validateProgramAsset(file, type) {
    if (!file) return;
    if (type === 'image' && !/^image\//i.test(file.type || '')) {
      throw new Error('Please upload a JPG, PNG, or WEBP image for the program banner.');
    }
    if (type === 'brochure') {
      const isPdf = /pdf/i.test(file.type || '') || /\.pdf$/i.test(file.name || '');
      if (!isPdf) throw new Error('Please upload the brochure as a PDF file.');
      if (file.size > 25 * 1024 * 1024) throw new Error('Program brochure PDF must be less than 25 MB.');
    }
  }

  async function uploadProgramAsset(file, folder, type) {
    validateProgramAsset(file, type);
    return upload(file, folder);
  }

  async function saveProgram(root) {
    const list = controls(root);
    installProgramFileInputs(root);
    const programFiles = programFileInputs(root);
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
    if (programFiles.image && programFiles.image.files[0]) {
      payload.image_url = await uploadProgramAsset(programFiles.image.files[0], 'programs', 'image');
    }
    if (programFiles.brochure && programFiles.brochure.files[0]) {
      payload.brochure_url = await uploadProgramAsset(programFiles.brochure.files[0], 'brochures', 'brochure');
    }

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

    const registerButton = Array.from(root.querySelectorAll('button')).find((button) => lower(text(button)).includes('register now'));
    if (registerButton) {
      const user = readStore('nest_current_user', {});
      const isRegistered = user.email
        ? (await currentUserProgramRegistrations(user)).some((item) => item.program_id === program.id)
        : false;
      registerButton.dataset.action = 'register-program';
      registerButton.dataset.id = program.id;
      registerButton.textContent = isRegistered ? 'Registered' : 'Register Now';
    }
  }

  async function renderDashboardPrograms(root) {
    const container = root.querySelector('#program-list');
    if (!container) return;
    const user = readStore('nest_current_user', {});
    const emptyCounts = { upcoming: 0, ongoing: 0, completed: 0 };
    if (!user.email) {
      setDashboardProgramCounts(root, emptyCounts);
      container.innerHTML = dashboardProgramsEmptyHtml('Log in or register first to see programs linked to your account.', 'Go to Login');
      const link = container.querySelector('a');
      if (link) link.href = 'index.html#login';
      return;
    }

    const registrations = await currentUserProgramRegistrations(user);
    const programIds = [...new Set(registrations.map((item) => item.program_id).filter(Boolean))];
    if (!programIds.length) {
      setDashboardProgramCounts(root, emptyCounts);
      container.innerHTML = dashboardProgramsEmptyHtml('Your dashboard will show only the programs you register for. Public programs stay available on the website.', 'Browse Programs');
      return;
    }

    const registrationByProgram = new Map(registrations.map((item) => [item.program_id, item]));
    const programs = (await rows('programs', (q) => q.in('id', programIds).eq('published', true).order('created_at', { ascending: false }))).map((row) => ({
      ...row,
      status: normalizeProgramStatus(row),
      dashboard_registration_status: registrationByProgram.get(row.id) && registrationByProgram.get(row.id).status,
      dashboard_registered_at: registrationByProgram.get(row.id) && registrationByProgram.get(row.id).registered_at
    }));
    const counts = {
      upcoming: programs.filter((row) => row.status === 'upcoming').length,
      ongoing: programs.filter((row) => row.status === 'ongoing').length,
      completed: programs.filter((row) => row.status === 'completed').length
    };
    setDashboardProgramCounts(root, counts);
    const activeStatus = counts.upcoming ? 'upcoming' : counts.ongoing ? 'ongoing' : counts.completed ? 'completed' : 'upcoming';
    const ordered = ['upcoming', 'ongoing', 'completed'].flatMap((status) => sortProgramsForStatus(programs.filter((row) => row.status === status), status));
    container.innerHTML = ordered.length
      ? ordered.map((row) => dashboardProgramCard(row, activeStatus)).join('')
      : dashboardProgramsEmptyHtml('Your dashboard will show only the programs you register for. Public programs stay available on the website.', 'Browse Programs');

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
    const user = readStore('nest_current_user', {});
    const app = readStore('nest_startup_application', null);
    if (app && app.startupId) {
      const sameUser = (!app.email || lower(app.email) === lower(user.email)) && (!app.role || lower(app.role) === lower(user.role));
      if (!sameUser) {
        removeStore('nest_startup_application');
      } else {
        try {
          return await single('startups', app.startupId);
        } catch (error) {
          console.warn('Could not load stored startup application:', error);
        }
      }
    }
    if (user.email) {
      const matches = await rows('startups', (q) => q.eq('email', user.email).order('created_at', { ascending: false }).limit(1));
      if (matches[0]) return matches[0];
    }
    return null;
  }

  async function startupRequestRows(startup, user) {
    const requests = [];
    const seen = new Set();
    const addRequests = (items) => {
      (items || []).forEach((item) => {
        if (!item || seen.has(item.id)) return;
        seen.add(item.id);
        requests.push(item);
      });
    };

    const app = readStore('nest_startup_application', null);
    if (app && app.requestId) {
      try {
        const request = await single('requests', app.requestId);
        addRequests([request]);
      } catch (error) {
        console.warn('Could not load stored startup request:', error);
      }
    }

    if (startup && startup.id) {
      try {
        addRequests(await rows('requests', (q) => q.eq('related_id', startup.id).order('submitted_at', { ascending: false }).limit(10)));
      } catch (error) {
        console.warn('Could not load startup requests:', error);
      }
    }

    const email = lower((startup && startup.email) || (user && user.email) || '');
    if (email) {
      try {
        addRequests(
          await rows('requests', (q) =>
            q.eq('requester_email', email).eq('request_type', 'startup_registration').order('submitted_at', { ascending: false }).limit(10)
          )
        );
      } catch (error) {
        console.warn('Could not load startup requests by email:', error);
      }
    }

    return requests;
  }

  async function startupDocumentSources(startup, user) {
    const requests = await startupRequestRows(startup, user);
    return [
      startup,
      payloadObject(startup && startup.metadata),
      ...requests.flatMap((request) => [request, payloadObject(request.payload)])
    ];
  }

  function isStartupStatusDashboardRoute(root) {
    const hash = lower(window.location.hash || '');
    if (hash) return hash.includes('myidea') || hash.includes('mystartup');
    const heading = lower(text(root && root.querySelector('h1')));
    return heading.includes('my idea overview') || heading.includes('startup management') || heading.includes('my startup request');
  }

  function startupVentureBadge(status) {
    const value = lower(status || 'pending');
    const config = {
      approved: ['bg-green-50', 'text-green-700', 'border-green-100', 'Approved Venture'],
      rejected: ['bg-red-50', 'text-[#b04a4a]', 'border-red-100', 'Rejected Venture'],
      pending: ['bg-orange-50', 'text-[#EA580C]', 'border-orange-100', 'Pending Review']
    }[value] || ['bg-gray-50', 'text-[#677461]', 'border-gray-100', titleCase(value)];
    return `<span class="px-3 py-1 ${config[0]} ${config[1]} text-[11px] font-bold uppercase rounded-full border ${config[2]}">${html(config[3])}</span>`;
  }

  function formatTeamSizeText(value) {
    const raw = clean(value);
    if (!raw) return 'Pending';
    if (/member|pending|not provided/i.test(raw)) return raw;
    return /^\d+$/.test(raw) ? `${raw} Members` : raw;
  }

  function startupDashboardDocumentsHtml(sources) {
    const docs = collectDocumentItems(sources);
    if (!docs.length) {
      return `
        <div class="p-4 bg-gray-50 rounded-[8px] border border-dashed border-gray-200">
          <span class="font-['Manrope'] text-[14px] text-[#677461]">No registration document was uploaded.</span>
        </div>`;
    }
    return docs
      .map(
        (doc, index) => {
          const colorClass = index % 2 === 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600';
          const previewUrl = documentPreviewUrl(doc.value);
          const tag = previewUrl ? 'a' : 'div';
          const href = previewUrl ? ` href="${html(previewUrl)}" target="_blank" rel="noopener noreferrer"` : '';
          return `
            <${tag}${href} class="flex items-center justify-between p-3 bg-gray-50 rounded-[8px] border border-gray-200 hover:bg-white hover:border-[#2D5A3D] transition-all group">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 ${colorClass} rounded flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                </div>
                <span class="font-['Manrope'] text-[14px] text-[#464E42] truncate">${html(doc.label || doc.title)}</span>
              </div>
              ${previewUrl ? `<svg class="text-gray-400 group-hover:text-[#2D5A3D] shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>` : ''}
            </${tag}>`;
        }
      )
      .join('');
  }

  async function renderDashboardStartupStatus(root) {
    if (!isStartupStatusDashboardRoute(root)) return;
    const startup = await getStoredStartup();
    if (!isStartupStatusDashboardRoute(root)) return;
    const user = readStore('nest_current_user', {});
    const currentHash = lower(window.location.hash || '');
    const currentHeading = lower(text(root.querySelector('h1')));
    const isIdeaPage = currentHash.includes('myidea') || currentHeading.includes('my idea overview') || (!currentHash && lower(user.role).includes('entrepreneur'));
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
    const sources = await startupDocumentSources(startup, user);
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
    const teamSize = formatTeamSizeText(requestValue(sources, ['team_size', 'team_member_size', 'team_members'], startup.team_size || ''));
    const funding = formatBudgetText(requestValue(sources, ['funding_raised', 'funding_raised_inr', 'budget'], startup.funding_raised || ''));
    const region = requestValue(sources, ['region_of_operation', 'state', 'state_region', 'location'], startup.state || 'Not provided');
    const registeredSince = requestValue(sources, ['registered_since', 'founded_date', 'established_year'], startup.established_year || '') || formatDate(startup.created_at);
    const gst = requestValue(sources, ['gst_number', 'gstin', 'gst', 'registration_number', 'company_registration_number'], 'Not provided');
    const mission = requestValue(sources, ['mission_overview', 'overview', 'startup_overview', 'brief_idea_description', 'description'], 'No mission overview was provided.');
    const incubationStatus = lower(startup.status) === 'approved' ? 'Active in NEST Cluster' : statusMessage(startup.status, 'Startup application');
    root.innerHTML = `
      <div class="flex flex-col gap-[24px] items-start w-full pb-10">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full mb-[8px]">
          <div class="flex flex-col items-start shrink-0">
            <h1 class="font-['Cormorant_Garamond'] font-bold text-[#1b3a28] text-[36px] leading-[normal]">Startup Management</h1>
            <p class="font-['Manrope'] text-[#677461] text-[14px]">Operational details for your registered venture</p>
          </div>
          <div class="flex gap-3">
            <button onclick="toggleEditMetrics(true)" id="edit-metrics-btn" class="flex items-center gap-2 bg-white text-[#2D5A3D] border-2 border-[#2D5A3D] px-8 py-2.5 rounded-[8px] font-['Manrope'] font-bold text-[14px] shadow-sm hover:bg-[#f1ffee] transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Update Metrics
            </button>
            <button onclick="saveMetrics()" id="save-metrics-btn" class="hidden flex items-center gap-2 bg-[#2D5A3D] text-white px-8 py-2.5 rounded-[8px] font-['Manrope'] font-bold text-[14px] shadow-sm hover:bg-[#1b3a28] transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              </svg>
              Save Metrics
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-[24px] w-full mt-2">
          <div class="lg:col-span-1 space-y-[24px]">
            <div class="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-gray-100 p-8 space-y-6">
              <h3 class="font-['Manrope'] font-bold text-[18px] text-[#1b3a28] border-b pb-4">Operational Metrics</h3>
              <div class="space-y-4">
                <div class="space-y-2">
                  <label class="block font-['Manrope'] font-bold text-[13px] text-[#1b3a28] uppercase tracking-wider">Team Member Size</label>
                  <input type="text" id="team-size" value="${html(teamSize)}" disabled class="metric-input w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-[10px] outline-none focus:border-[#2D5A3D] font-['Manrope'] transition-all text-gray-500 cursor-not-allowed">
                  <p class="text-[11px] text-[#677461]">Excluding founders</p>
                </div>
                <div class="space-y-2">
                  <label class="block font-['Manrope'] font-bold text-[13px] text-[#1b3a28] uppercase tracking-wider">Funding Raised (INR)</label>
                  <input type="text" id="funding-raised" value="${html(funding)}" disabled class="metric-input w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-[10px] outline-none focus:border-[#2D5A3D] font-['Manrope'] transition-all text-gray-500 cursor-not-allowed">
                  <p class="text-[11px] text-[#677461]">Total external capital</p>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-gray-100 p-8 space-y-6">
              <h3 class="font-['Manrope'] font-bold text-[18px] text-[#1b3a28] border-b pb-4">Registration Documents</h3>
              <div class="space-y-3">${startupDashboardDocumentsHtml(sources)}</div>
            </div>
          </div>

          <div class="lg:col-span-2 space-y-[24px]">
            <div class="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden">
              <div class="px-8 py-5 border-b border-[#f1f2f4] bg-[#fdfdfd] flex items-center justify-between gap-4">
                <h3 class="font-['Manrope'] font-bold text-[18px] text-[#1b3a28]">Startup Identity</h3>
                ${startupVentureBadge(startup.status)}
              </div>
              <div class="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-1">
                  <p class="text-[12px] font-bold text-[#677461] uppercase tracking-wider">Startup Name</p>
                  <p class="font-['Manrope'] text-[16px] text-[#1b3a28] font-bold">${html(startup.name || 'Not provided')}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-[12px] font-bold text-[#677461] uppercase tracking-wider">Vertical / Industry</p>
                  <p class="font-['Manrope'] text-[16px] text-[#1b3a28] font-bold">${html(startup.category || 'Not provided')}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-[12px] font-bold text-[#677461] uppercase tracking-wider">GST Number</p>
                  <p class="font-['Manrope'] text-[16px] text-[#1b3a28] font-bold">${html(gst)}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-[12px] font-bold text-[#677461] uppercase tracking-wider">Region of Operation</p>
                  <p class="font-['Manrope'] text-[16px] text-[#1b3a28] font-bold">${html(region)}</p>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-gray-100 p-8 space-y-6">
              <h3 class="font-['Manrope'] font-bold text-[18px] text-[#1b3a28] border-b pb-4">Mission Overview</h3>
              <div class="space-y-4">
                <div class="p-5 bg-gray-50 rounded-[12px] border border-gray-100">
                  <p class="font-['Manrope'] text-[#464E42] text-[15px] leading-relaxed italic">"${html(mission)}"</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 bg-[#f1ffee] text-[#2D5A3D] rounded-full flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div>
                      <p class="text-[13px] font-bold text-[#1b3a28]">Incubation Status</p>
                      <p class="text-[13px] text-[#677461]">${html(incubationStatus)}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 bg-[#f1ffee] text-[#2D5A3D] rounded-full flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </div>
                    <div>
                      <p class="text-[13px] font-bold text-[#1b3a28]">Registered Since</p>
                      <p class="text-[13px] text-[#677461]">${html(registeredSince)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  async function renderDashboardProfileStatus(root) {
    const startup = await getStoredStartup();
    const hash = lower(window.location.hash || '');
    if (hash && !hash.includes('profile')) return;
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
          <td data-action="view-startup" data-id="${row.id}" class="px-[24px] py-[20px] cursor-pointer"><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px]">${html(row.name)}</span></td>
          <td data-action="view-startup" data-id="${row.id}" class="px-[24px] py-[20px] cursor-pointer"><span class="font-['Inter'] text-[#464E42] text-[14px]">${html(row.category || 'Startup')}</span></td>
          <td data-action="view-startup" data-id="${row.id}" class="px-[24px] py-[20px] cursor-pointer"><span class="font-['Inter'] text-[#464E42] text-[14px]">${html(row.established_year || 'NA')}</span></td>
          <td data-action="view-startup" data-id="${row.id}" class="px-[24px] py-[20px] cursor-pointer"><span class="font-['Inter'] text-[#464E42] text-[14px]">${html(row.state || 'NA')}</span></td>
          <td class="px-[24px] py-[20px] text-right">
            <div class="flex items-center justify-end gap-[16px]">
              <button data-action="view-startup" data-id="${row.id}" class="text-[#677461] hover:text-[#1b3a28] transition-all">View</button>
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
    const contactEmail = lower(fields.email_address || '');
    const contactPhone = normalizePhone(fields.phone_number || '');
    const website = fields.website_link ? `https://${fields.website_link.replace(/^https?:\/\//i, '')}` : '';
    const startup = await insertRow('startups', {
      name: fields.startup_name || 'Untitled Startup',
      founder_name: fields.founder_owner_name || fields.founder_name || currentUser.name,
      email: contactEmail,
      phone: contactPhone,
      website_url: website,
      category: fields.industry_type || '',
      state: fields.state_region || '',
      team_size: fields.team_size || '',
      funding_raised: fields.funding_raised || fields.funding_raised_inr || '',
      overview: fields.startup_overview || '',
      status: 'pending',
      metadata: { ...fields, phone_number: contactPhone }
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

  function normalizePhone(value) {
    const raw = clean(value);
    if (!raw) return '';
    const compact = raw.replace(/[^\d+]/g, '');
    if (compact.startsWith('+')) return compact;
    const digits = compact.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return digits ? `+${digits}` : '';
  }

  function loginRoleUsesPhone(role) {
    return PHONE_OTP_ROLES.has(lower(role));
  }

  function isDemoEmail(email) {
    return lower(email).endsWith('@nest.test');
  }

  function isSingleEmailRole(role) {
    return SINGLE_EMAIL_ROLES.has(lower(role));
  }

  async function memberProfilesForEmail(email) {
    const normalized = lower(email);
    if (!normalized) return [];
    const matches = await rows('profiles', (q) => q.ilike('email', normalized).order('created_at', { ascending: false }).limit(20));
    return matches.filter((profile) => isSingleEmailRole(profile.role));
  }

  async function assignedMemberRoleForEmail(email) {
    const matches = await memberProfilesForEmail(email);
    return matches[0] || null;
  }

  async function assertEmailRoleAvailable(email, desiredRole, options) {
    const role = lower(desiredRole);
    if (!isSingleEmailRole(role)) return null;
    const existing = await assignedMemberRoleForEmail(email);
    if (!existing) return null;
    const existingRole = lower(existing.role);
    const allowSameRole = options && options.allowSameRole;
    if (allowSameRole && existingRole === role) return existing;
    if (existingRole === role) {
      throw new Error(`This email is already registered as ${titleCase(existingRole)}. Please login instead of registering again.`);
    }
    throw new Error(`This email is already registered as ${titleCase(existingRole)}. One email can be used for only one role, so please login as ${titleCase(existingRole)} or use a different email.`);
  }

  function registrationRole(form) {
    const id = form.id || '';
    const formText = lower(text(form.closest('section') || form));
    return formText.includes('artisan registration')
      ? 'artisan'
      : formText.includes('trainee registration') || id.includes('traniee')
        ? 'trainee'
        : formText.includes('startup registration')
          ? 'startup'
          : formText.includes('entrepreneur registration') || id.includes('entrepreneur')
            ? 'entrepreneur'
            : 'startup';
  }

  function otpCooldownKey(scope, contact) {
    return `nest_${scope}_otp_cooldown_${lower(contact)}`;
  }

  function otpCooldownSeconds(scope, contact) {
    const until = Number(localStorage.getItem(otpCooldownKey(scope, contact)) || 0);
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }

  function markOtpCooldown(scope, contact) {
    localStorage.setItem(otpCooldownKey(scope, contact), String(Date.now() + OTP_COOLDOWN_MS));
  }

  function assertOtpCooldown(scope, contact) {
    const seconds = otpCooldownSeconds(scope, contact);
    if (seconds > 0) throw new Error(`Please wait ${seconds} seconds before requesting another OTP for this email.`);
  }

  function otpRequestError(error, scope, contact) {
    const message = error && error.message ? error.message : 'OTP could not be sent.';
    if (/rate limit|too many/i.test(message)) {
      markOtpCooldown(scope, contact);
      return new Error('Request rate limit exceeded. Please wait 60 seconds, then request a new OTP once.');
    }
    if (/database error saving new user/i.test(message)) {
      return new Error('Supabase Auth is still blocked by the old user-created database trigger. Run the updated supabase/schema.sql once, then try OTP again.');
    }
    return error;
  }

  function withAuthTimeout(promise, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), AUTH_REQUEST_TIMEOUT_MS);
      })
    ]);
  }

  function demoAccountForLogin(form) {
    const email = lower(form.querySelector('#login-email') && form.querySelector('#login-email').value);
    const phone = normalizePhone(form.querySelector('#login-phone') && form.querySelector('#login-phone').value);
    if (email && DEMO_USERS[email]) return { email, account: DEMO_USERS[email] };
    return Object.entries(DEMO_USERS).reduce((match, [demoEmail, account]) => {
      if (match) return match;
      return account.phone && normalizePhone(account.phone) === phone ? { email: demoEmail, account } : null;
    }, null);
  }

  async function finishDemoLogin(email, account) {
    const user = {
      email,
      role: account.role,
      name: account.name,
      phone: account.phone || '',
      loggedInAt: new Date().toISOString(),
      isDemo: true
    };
    persistCurrentUser(user);
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

  async function demoLogin(form) {
    const selectedRole = lower(form.querySelector('#login-role') && form.querySelector('#login-role').value);
    const passwordInput = form.querySelector('#login-password') || form.querySelector('#state-login input[type="password"]') || form.querySelector('input[type="password"]');
    const password = passwordInput ? passwordInput.value : '';
    const match = demoAccountForLogin(form);
    if (!match || match.account.password !== password) {
      showToast('Invalid testing credential. Use one of the demo emails/phones and passwords shown on this page.', 'error');
      return;
    }
    if (selectedRole && selectedRole !== match.account.role) {
      showToast(`Selected role must be ${titleCase(match.account.role)} for this testing credential.`, 'error');
      return;
    }
    await finishDemoLogin(match.email, match.account);
  }

  function readLoginOtpCode(root) {
    const direct = root.querySelector('#login-otp-code');
    if (direct && clean(direct.value)) return clean(direct.value);
    return Array.from(root.querySelectorAll('#login-otp-boxes input')).map((input) => clean(input.value)).join('');
  }

  async function profileForLogin(role, contact, channel) {
    const targetRole = lower(role);
    if (channel === 'email') {
      const matches = await rows('profiles', (q) => q.ilike('email', lower(contact)).eq('role', targetRole).order('created_at', { ascending: false }).limit(1));
      return matches[0] || null;
    }
    const normalized = normalizePhone(contact);
    const direct = await rows('profiles', (q) => q.eq('phone', normalized).eq('role', targetRole).order('created_at', { ascending: false }).limit(1));
    if (direct[0]) return direct[0];
    const matches = await rows('profiles', (q) => q.eq('role', targetRole).order('created_at', { ascending: false }).limit(50));
    return matches.find((profile) => normalizePhone(profile.phone) === normalized) || null;
  }

  async function profileForEmailPasswordLogin(email) {
    const matches = await rows('profiles', (q) => q.ilike('email', lower(email)).order('created_at', { ascending: false }).limit(20));
    if (!matches.length) return null;
    return matches.find((profile) => isSingleEmailRole(profile.role)) || matches.find((profile) => lower(profile.role) === 'admin') || matches[0];
  }

  function loginAuthError(error) {
    const message = error && error.message ? error.message : 'Login failed.';
    if (/invalid login credentials/i.test(message)) {
      return new Error('Invalid email or password. Use the password created during registration.');
    }
    if (/email not confirmed/i.test(message)) {
      return new Error('This email is not confirmed in Supabase Auth. Disable email confirmations in Supabase Auth settings or confirm the user email first.');
    }
    return error;
  }

  function setLoginOtpStep(root, visible, channel, contact) {
    const login = root.querySelector('#state-login');
    const otp = root.querySelector('#state-login-otp');
    const title = root.querySelector('#login-title');
    const subtitle = root.querySelector('#login-subtitle');
    if (!login || !otp) return;
    login.classList.toggle('hidden', visible);
    otp.classList.toggle('hidden', !visible);
    if (title) title.textContent = visible ? 'Verify OTP' : 'Login';
    if (subtitle) {
      subtitle.textContent = visible
        ? `Enter the 6 digit code sent to your ${channel === 'phone' ? 'phone number' : 'email address'} ${contact}.`
        : 'Select your role and receive a secure OTP.';
    }
    if (visible) {
      const first = otp.querySelector('input');
      if (first) first.focus();
    }
  }

  function installPasswordLoginUi(root) {
    const roleSelect = root.querySelector('#login-role');
    const emailWrap = root.querySelector('#login-email-wrap');
    const phoneWrap = root.querySelector('#login-phone-wrap');
    const otp = root.querySelector('#state-login-otp');
    const title = root.querySelector('#login-title');
    const subtitle = root.querySelector('#login-subtitle');
    const submitButton = root.querySelector('#login-submit-btn') || root.querySelector('#send-otp-btn');
    const email = root.querySelector('#login-email');
    const password = root.querySelector('#login-password');
    const roleWrap = roleSelect && (roleSelect.closest('[class*="space-y-1"]') || roleSelect.parentElement);
    if (roleWrap) roleWrap.classList.add('hidden');
    if (phoneWrap) phoneWrap.classList.add('hidden');
    if (otp) otp.classList.add('hidden');
    if (emailWrap) emailWrap.classList.remove('hidden');
    if (email) email.required = true;
    if (password) password.required = true;
    if (submitButton) submitButton.textContent = 'Login';
    if (title) title.textContent = 'Login';
    if (subtitle) subtitle.textContent = 'Enter your email and password. Your dashboard opens automatically.';

    const otpInputs = root.querySelectorAll('#login-otp-boxes input');
    otpInputs.forEach((input, index) => {
      input.addEventListener('input', (event) => {
        event.target.value = event.target.value.replace(/\D/g, '').slice(0, 1);
        if (event.target.value && index < otpInputs.length - 1) otpInputs[index + 1].focus();
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Backspace' && !event.target.value && index > 0) otpInputs[index - 1].focus();
      });
      input.addEventListener('paste', (event) => {
        const pasted = (event.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        event.preventDefault();
        otpInputs.forEach((box, boxIndex) => {
          box.value = pasted[boxIndex] || '';
        });
        const next = otpInputs[Math.min(pasted.length, otpInputs.length) - 1];
        if (next) next.focus();
      });
    });
  }

  async function startPasswordLogin(form) {
    const email = lower(form.querySelector('#login-email') && form.querySelector('#login-email').value);
    const password = clean(form.querySelector('#login-password') && form.querySelector('#login-password').value);
    if (!email) throw new Error('Please enter your email address.');
    if (!password) throw new Error('Please enter your password.');

    const demoMatch = demoAccountForLogin(form);
    if (demoMatch && demoMatch.account.password === password) {
      await finishDemoLogin(demoMatch.email, demoMatch.account);
      return;
    }
    if (isDemoEmail(email)) {
      throw new Error('Invalid demo password for this testing account.');
    }

    const { data, error } = await withAuthTimeout(
      supabase().auth.signInWithPassword({ email, password }),
      'Supabase did not respond while logging in. Check your internet connection, then try again.'
    );
    if (error) throw loginAuthError(error);

    const profile = await profileForEmailPasswordLogin(email);
    if (!profile) throw new Error('Login succeeded, but no profile was found for this email. Please complete registration first.');

    const user = {
      email: profile.email || email,
      role: profile.role,
      name: profile.full_name || profile.organization || titleCase(profile.role),
      phone: profile.phone || '',
      profileId: profile.id,
      status: profile.status || '',
      auth: 'password',
      authUserId: data && data.user && data.user.id,
      loggedInAt: new Date().toISOString()
    };
    persistCurrentUser(user);
    if (profile.role === 'startup' || profile.role === 'entrepreneur') {
      const startups = await rows('startups', (q) => q.ilike('email', lower(user.email)).order('created_at', { ascending: false }).limit(1));
      if (startups[0]) {
        const requests = await rows('requests', (q) => q.eq('related_id', startups[0].id).order('submitted_at', { ascending: false }).limit(1));
        writeStore('nest_startup_application', {
          role: profile.role,
          email: user.email,
          profileId: profile.id,
          startupId: startups[0].id,
          requestId: requests[0] && requests[0].id
        });
      }
    }
    updateNavbarAuthState();
    showToast(`Logged in as ${titleCase(profile.role)}.`);
    setTimeout(() => {
      window.location.href = getDashboardUrl(profile.role);
    }, 300);
  }

  async function startRoleOtpLogin(form) {
    const root = mainRoot();
    const role = lower(form.querySelector('#login-role') && form.querySelector('#login-role').value);
    const password = clean(form.querySelector('#login-password') && form.querySelector('#login-password').value);
    const demoMatch = password ? demoAccountForLogin(form) : null;
    if (demoMatch && demoMatch.account.password === password) {
      if (role && role !== demoMatch.account.role) {
        throw new Error(`Selected role must be ${titleCase(demoMatch.account.role)} for this testing credential.`);
      }
      await finishDemoLogin(demoMatch.email, demoMatch.account);
      return;
    }
    if (!EMAIL_OTP_ROLES.has(role) && !PHONE_OTP_ROLES.has(role)) {
      await demoLogin(form);
      return;
    }

    const channel = loginRoleUsesPhone(role) ? 'phone' : 'email';
    const contact = channel === 'phone'
      ? normalizePhone(form.querySelector('#login-phone') && form.querySelector('#login-phone').value)
      : lower(form.querySelector('#login-email') && form.querySelector('#login-email').value);
    if (!contact) throw new Error(channel === 'phone' ? 'Please enter a phone number.' : 'Please enter an email address.');
    if (channel === 'email' && isDemoEmail(contact)) {
      throw new Error('Demo @nest.test emails cannot receive OTP. Enter the testing password for demo login, or use a real registered email address.');
    }
    if (channel === 'phone' && !/^\+\d{10,15}$/.test(contact)) throw new Error('Please enter phone number with country code, for example +919876543210.');
    assertOtpCooldown('login', contact);
    if (channel === 'email') await assertEmailRoleAvailable(contact, role, { allowSameRole: true });

    const profile = await profileForLogin(role, contact, channel);
    if (!profile) throw new Error(`No ${titleCase(role)} account was found for this ${channel === 'phone' ? 'phone number' : 'email address'}.`);

    const payload = channel === 'phone'
      ? { phone: contact, options: { shouldCreateUser: true, data: { role } } }
      : { email: contact, options: { shouldCreateUser: true, data: { role } } };
    const { error } = await withAuthTimeout(
      supabase().auth.signInWithOtp(payload),
      'Supabase did not respond while sending OTP. Check your internet connection and Supabase Auth email/SMPP settings, then try again.'
    );
    if (error) throw otpRequestError(error, 'login', contact);

    markOtpCooldown('login', contact);
    loginOtpState = { role, channel, contact, profileId: profile.id };
    setLoginOtpStep(root, true, channel, contact);
    showToast(`OTP sent to ${contact}.`);
  }

  async function verifyRoleOtp(root) {
    if (!loginOtpState) throw new Error('Please request an OTP first.');
    const token = readLoginOtpCode(root);
    if (!/^\d{6}$/.test(token)) throw new Error('Please enter the 6 digit OTP.');
    const payload = loginOtpState.channel === 'phone'
      ? { phone: loginOtpState.contact, token, type: 'sms' }
      : { email: loginOtpState.contact, token, type: 'email' };
    const { error } = await withAuthTimeout(
      supabase().auth.verifyOtp(payload),
      'Supabase did not respond while verifying OTP. Please try again.'
    );
    if (error) throw error;

    const profile = await profileForLogin(loginOtpState.role, loginOtpState.contact, loginOtpState.channel);
    if (!profile) throw new Error('Your OTP was verified, but no profile record was found.');
    const user = {
      email: profile.email || '',
      role: profile.role,
      name: profile.full_name || profile.organization || titleCase(profile.role),
      phone: profile.phone || '',
      loggedInAt: new Date().toISOString(),
      auth: 'otp'
    };
    persistCurrentUser(user);
    showToast(`Logged in as ${titleCase(profile.role)}.`);
    setTimeout(() => {
      window.location.href = getDashboardUrl(profile.role);
    }, 300);
  }

  function readRegistrationOtpCode(form) {
    return Array.from(form.querySelectorAll('[id$="-otp-inputs"] input')).map((input) => clean(input.value)).join('');
  }

  async function startRegistrationOtp(form) {
    const fields = collectLabeledFields(form, { includeHidden: true });
    const email = lower(fields.email_address || '');
    const role = registrationRole(form);
    if (!email) throw new Error('Please enter an email address before requesting OTP.');
    if (isDemoEmail(email)) throw new Error('Demo @nest.test emails cannot receive OTP. Use a real email address for registration OTP.');
    await assertEmailRoleAvailable(email, role);
    assertOtpCooldown('registration', email);
    const { error } = await withAuthTimeout(
      supabase().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            role,
            registration_flow: true
          }
        }
      }),
      'Supabase did not respond while sending registration OTP. Check your SMTP/Auth settings, then try again.'
    );
    if (error) throw otpRequestError(error, 'registration', email);
    markOtpCooldown('registration', email);
    registrationOtpState = {
      email,
      role,
      formId: form.id || '',
      verified: false
    };
    showToast(`Registration OTP sent to ${email}.`);
  }

  async function verifyRegistrationOtp(form) {
    const fields = collectLabeledFields(form, { includeHidden: true });
    const email = lower(fields.email_address || '');
    const role = registrationRole(form);
    assertRegistrationOtpVerified(email, role, { allowPending: true });
    if (registrationOtpState.verified) return;
    const token = readRegistrationOtpCode(form);
    if (!/^\d{6}$/.test(token)) throw new Error('Please enter the 6 digit OTP sent to your email.');
    const { error } = await withAuthTimeout(
      supabase().auth.verifyOtp({ email, token, type: 'email' }),
      'Supabase did not respond while verifying registration OTP. Please try again.'
    );
    if (error) throw error;
    registrationOtpState.verified = true;
    registrationOtpState.verifiedAt = Date.now();
  }

  function assertRegistrationOtpVerified(email, role, options = {}) {
    const normalizedEmail = lower(email || '');
    const normalizedRole = lower(role || '');
    const otpMatches =
      registrationOtpState &&
      registrationOtpState.email === normalizedEmail &&
      registrationOtpState.role === normalizedRole;
    if (!otpMatches) {
      throw new Error('Please request a registration OTP for this email before submitting.');
    }
    if (!options.allowPending && registrationOtpState.verified !== true) {
      throw new Error('Please verify the OTP sent to this email before creating the account.');
    }
  }

  async function saveRegistrationAuthPassword(form, email, role) {
    const password = registrationPassword(form);
    const { data: userData } = await supabase().auth.getUser();
    if (!userData || !userData.user || lower(userData.user.email) !== lower(email)) {
      throw new Error('Please verify the registration OTP again before saving your password.');
    }
    const { error } = await withAuthTimeout(
      supabase().auth.updateUser({
        password,
        data: {
          role,
          registration_flow: true
        }
      }),
      'Supabase did not respond while saving your password. Please try again.'
    );
    if (error && !/same password/i.test(error.message || '')) throw error;
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
      const patch = { status };
      if (req.related_table === 'startups') {
        try {
          const startup = await single('startups', req.related_id);
          patch.metadata = {
            ...payloadObject(startup.metadata),
            ...payloadObject(req.payload)
          };
        } catch (error) {
          console.warn('Could not merge startup request payload:', error);
        }
      }
      await updateRow(req.related_table, req.related_id, patch);
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
        <a href="${html(row.pdf_url || '#')}" target="_blank" class="bg-white flex flex-col items-start justify-between rounded-[20px] shadow-[0px 4px 16px rgba(0,0,0,0.04)] border border-gray-100 hover:border-[#d2dfce] hover:shadow-lg transition-all w-full min-h-[190px] shrink-0 group p-[24px]">
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
            `<span class="bg-[#fff3db] text-[#7d6433] font-['Inter'] font-semibold text-[11px] px-[12px] py-[4px] rounded-[12px] shadow-[0px 1px 2px 0px rgba(0,0,0,0.05)]"> ${html(hub.name)}</span> `
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
    <a href = "${html(mou.document_url || '#')}" target = "_blank" class="bg-white flex flex-col gap-[14px] p-[24px] md:p-[32px] rounded-[14px] shadow-[0px 4px 16px rgba(0,0,0,0.04)] border border-gray-100 min-h-[263px] items-start justify-center hover:-translate-y-1 transition-all">
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

    // Process File Uploads
    for (const key in fields) {
      if (fields[key] instanceof File) {
        try {
          const file = fields[key];
          const ext = file.name.split('.').pop();
          const path = `registration/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          fields[key] = await uploadFile('uploads', path, file);
        } catch (err) {
          console.error(`Failed to upload ${key}:`, err);
          fields[key] = null;
        }
      }
    }

    const role = registrationRole(form);
    const contactEmail = lower(fields.email_address || '');
    assertRegistrationOtpVerified(contactEmail, role);
    await assertEmailRoleAvailable(contactEmail, role);
    await saveRegistrationAuthPassword(form, contactEmail, role);
    const uploadedDocuments = await uploadRegistrationDocuments(form, role);
    if (uploadedDocuments.length) fields.registration_documents = uploadedDocuments;
    const currentUser = rememberCurrentUser(role, fields);
    const contactPhone = normalizePhone(fields.phone_number || fields.mobile_number || fields.contact_number || '');
    const profile = await insertRow('profiles', {
      full_name: currentUser.name,
      email: contactEmail,
      phone: contactPhone,
      role,
      organization: fields.startup_name || fields.shop_name_optional || '',
      status: 'pending',
      metadata: { ...fields, phone_number: contactPhone }
    });
    persistCurrentUser({ ...currentUser, profileId: profile.id, status: profile.status });

    if (role === 'entrepreneur' || role === 'startup') {
      const startupName =
        fields.startup_name ||
        fields.organization ||
        (fields.brief_idea_description ? `${currentUser.name} 's Startup Idea` : '') ||
        `${currentUser.name}'s Startup`;
      const startupPayload = {
        name: startupName,
        founder_name: fields.founder_owner_name || fields.full_name || currentUser.name,
        email: contactEmail,
        phone: contactPhone || null,
        category: fields.industry_type || fields.vertical || (role === 'entrepreneur' ? 'Entrepreneur Idea' : 'Startup'),
        website_url: (fields.website_link || '').trim() ? `https://${fields.website_link.replace(/^https?:\/\//i, '')}` : null,
        state: (fields.state_region || fields.location || '').trim() ? (fields.state_region || fields.location) : null,
        team_size: (fields.team_size || '').trim() ? fields.team_size : null,
        funding_raised: (fields.funding_raised || fields.funding_raised_inr || fields.budget || fields.estimated_budget || '').toString().trim() ? (fields.funding_raised || fields.funding_raised_inr || fields.budget || fields.estimated_budget) : null,
        overview: (fields.startup_overview || fields.brief_idea_description || '').trim() ? (fields.startup_overview || fields.brief_idea_description) : null,
        established_year: (fields.established_year || fields.founded_date || fields.year || '').toString().trim() ? (fields.established_year || fields.founded_date || fields.year) : null,
        status: 'pending',
        metadata: {
          ...fields,
          phone_number: contactPhone,
          submitted_as: role,
          profile_id: profile.id
        }
      };

      const startup = await insertRow('startups', startupPayload);
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
      persistCurrentUser({ ...currentUser, profileId: profile.id, startupId: startup.id, status: profile.status });
      registrationOtpState = null;
      showToast('Startup application sent to admin. Status is pending.');
      setTimeout(() => {
        window.location.href = role === 'entrepreneur' ? 'entrepreneur.html#myidea' : 'startup.html#mystartup';
      }, 900);
      return;
    }

    if (role === 'trainee' || role === 'artisan') {
      await updateRow('profiles', profile.id, { status: 'active' });
      persistCurrentUser({ ...currentUser, profileId: profile.id, status: 'active' });
      registrationOtpState = null;
      showToast('Registration successful! Redirecting to dashboard...');
      setTimeout(() => {
        window.location.href = getDashboardUrl(role);
      }, 900);
      return;
    }

    const request = await insertRow('requests', {
      request_type: 'user_registration',
      title: `${titleCase(role)} registration`,
      requester_name: profile.full_name,
      requester_email: profile.email,
      requester_role: role,
      related_table: 'profiles',
      related_id: profile.id,
      payload: fields
    });
    writeStore('nest_user_registration_application', {
      role,
      email: profile.email,
      profileId: profile.id,
      requestId: request.id
    });
    registrationOtpState = null;
    showToast('Registration saved and sent to admin for approval.');
    setTimeout(() => {
      window.location.href = getDashboardUrl(role);
    }, 900);
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
      if (key === 'dashboard-user-profile') {
        await renderDashboardUserProfile(root);
        await renderDashboardProfileStatus(root);
      }
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
      if (key === 'registration-form') installDocumentUploadInputs(root);
      if (key === 'login') installPasswordLoginUi(root);
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
    if (action === 'verify-login-otp') return verifyRoleOtp(mainRoot());
    if (action === 'register-program') return registerForProgram(id);
    if (action === 'back-to-login') {
      loginOtpState = null;
      setLoginOtpStep(mainRoot(), false);
      return;
    }
    if (action === 'view-request') return showRequestDetail(id);
    if (action === 'view-startup') return showStartupDetail(id);
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
    const key = root && (root.dataset.nestSupabasePage || detectPage(root));
    if (root && key && root.dataset.nestSupabasePage !== key) root.dataset.nestSupabasePage = key;
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
    if (key === 'program-form') {
      const uploadZone = event.target.closest('[data-nest-program-file-zone]');
      if (uploadZone) {
        const input = uploadZone.querySelector('input[type="file"][data-nest-program-file]');
        if (input && event.target !== input) {
          event.preventDefault();
          event.stopImmediatePropagation();
          input.click();
          return;
        }
      }
    }
    const button = event.target.closest('button');
    if (!button) return;
    const buttonForm = button.closest('form');
    const isRegistrationButton = buttonForm && buttonForm.matches('#artisan-form, #traniee-form, #entrepreneur-form');
    const isLoginButton = buttonForm && buttonForm.id === 'auth-form';
    if (!key && !isRegistrationButton && !isLoginButton) return;
    const label = lower(text(button));
    if ((key === 'registration-form' || isRegistrationButton) && button.classList.contains('select-file-btn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (root) installDocumentUploadInputs(root);
      const card = button.closest('.document-card');
      const input = card && card.querySelector('input[type="file"][data-nest-document-input]');
      if (input) input.click();
      return;
    }
    const avatarUploadButton = button.id === 'profile-avatar-btn' || (button.getAttribute('onclick') || '').includes('simulateAvatarChange');
    if (key === 'dashboard-user-profile' && avatarUploadButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      ensureProfilePhotoInput(root).click();
      return;
    }
    if (key === 'dashboard-user-profile' && button.id === 'save-btn') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const previousLabel = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="flex items-center gap-2">Saving...</span>';
      saveDashboardUserProfile(root)
        .catch((error) => showToast(error.message || 'Profile could not be saved.', 'error'))
        .finally(() => {
          button.disabled = false;
          button.innerHTML = previousLabel;
        });
      return;
    }
    if ((key === 'registration-form' || isRegistrationButton) && button.id === 'next-btn') {
      try {
        const form = buttonForm || root.querySelector('form');
        if (form) validateRegistrationForm(form, { visibleOnly: true });
      } catch (error) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!error.isSilent) {
          showToast(error.message || 'Please fill all required fields.', 'error');
        }
        return;
      }
      if (label.includes('get otp') && button.dataset.registrationOtpReady !== 'true') {
        const form = buttonForm || root.querySelector('form');
        if (!form) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        button.disabled = true;
        button.dataset.previousLabel = text(button);
        button.textContent = 'Sending OTP...';
        startRegistrationOtp(form)
          .then(() => {
            button.dataset.registrationOtpReady = 'true';
            button.disabled = false;
            button.textContent = button.dataset.previousLabel || 'Get OTP';
            delete button.dataset.previousLabel;
            button.click();
            setTimeout(() => {
              delete button.dataset.registrationOtpReady;
            }, 0);
          })
          .catch((error) => {
            button.disabled = false;
            button.textContent = button.dataset.previousLabel || 'Get OTP';
            delete button.dataset.previousLabel;
            showToast(error.message || 'OTP could not be sent.', 'error');
          });
        return;
      }
    }
    if ((key === 'registration-form' || isRegistrationButton) && button.id === 'resend-otp-btn') {
      const form = buttonForm || root.querySelector('form');
      if (!form) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      startRegistrationOtp(form)
        .then(() => {
          if (typeof window.startResendTimer === 'function') window.startResendTimer();
        })
        .catch((error) => showToast(error.message || 'OTP could not be resent.', 'error'));
      return;
    }
    if ((key === 'login' || isLoginButton) && label === 'login') {
      const form = buttonForm || root.querySelector('#auth-form');
      if (!form) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      button.disabled = true;
      startPasswordLogin(form)
        .catch((error) => showToast(error.message || 'Login failed.', 'error'))
        .finally(() => {
          button.disabled = false;
        });
      return;
    }
    if ((key === 'login' || isLoginButton) && (button.id === 'send-otp-btn' || label.includes('send otp'))) {
      const form = buttonForm || root.querySelector('#auth-form');
      if (!form) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      button.disabled = true;
      startPasswordLogin(form)
        .catch((error) => showToast(error.message || 'Login failed.', 'error'))
        .finally(() => {
          button.disabled = false;
        });
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

  function changeHandler(event) {
    const input = event.target;
    if (input.matches('[data-nest-program-file]')) {
      updateProgramFileLabel(input);
      return;
    }
    if (input.matches('[data-nest-document-input]')) {
      const card = input.closest('.document-card');
      const button = card && card.querySelector('.select-file-btn');
      const files = Array.from(input.files || []);
      if (button) {
        const buttonText = button.querySelector('.btn-text') || button;
        buttonText.textContent = files.length ? `${files.length} FILE${files.length > 1 ? 'S' : ''} SELECTED` : 'SELECT FILE';
        button.classList.toggle('bg-[#2d5a3d]', files.length > 0);
        button.classList.toggle('text-white', files.length > 0);
      }
      const fileNameDisplay = card && card.querySelector('.file-name-display');
      if (fileNameDisplay) {
        fileNameDisplay.innerHTML = files.map((file) => html(file.name)).join('<br>');
        fileNameDisplay.classList.toggle('hidden', files.length === 0);
      }
      const previous = card && card.querySelector('[data-nest-selected-docs]');
      if (previous) previous.remove();
      if (card && files.length) {
        card.insertAdjacentHTML(
          'beforeend',
          `<div data-nest-selected-docs class="mt-2 max-w-full text-[11px] text-[#2d5a3d] font-['Inter'] leading-snug break-words">${files
            .map((file) => html(file.name))
            .join('<br>')}</div>`
        );
      }
      return;
    }
    if (!input.matches('[data-nest-profile-photo-input]')) return;
    const root = mainRoot();
    const file = input.files && input.files[0];
    uploadDashboardProfilePhoto(root, file)
      .catch((error) => showToast(error.message || 'Profile photo could not be uploaded.', 'error'))
      .finally(() => {
        input.value = '';
      });
  }

  function submitHandler(event) {
    const form = event.target;
    const root = mainRoot();
    const key = root && root.dataset.nestSupabasePage;
    if (form.id === 'auth-form') {
      event.preventDefault();
      event.stopImmediatePropagation();
      startPasswordLogin(form).catch((error) => showToast(error.message || 'Login failed.', 'error'));
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
      verifyRegistrationOtp(form)
        .then(() => submitRegistration(form))
        .catch((error) => {
          if (!error.isSilent) {
            showToast(error.message || 'Registration failed.', 'error');
          }
        });
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

    const name = html(currentUser.name);
    const initial = name ? name.charAt(0).toUpperCase() : 'U';
    const dashboardUrl = getDashboardUrl(currentUser.role);

    const avatarHtml = currentUser.image_url
      ? `<img src="${html(currentUser.image_url)}" class="w-[38px] h-[38px] rounded-full object-cover shrink-0 shadow-sm border border-gray-100">`
      : `<div style="background-color: #e2e8f0; color: #1e293b;" class="w-[38px] h-[38px] rounded-full flex items-center justify-center font-['Inter'] font-bold text-[16px] shrink-0">${initial}</div>`;

    // Desktop Actions
    const desktopActions = document.querySelector('#navbar .hidden.lg\\:flex.items-center.gap-\\[8px\\]');
    if (desktopActions && desktopActions.querySelector('a[href*="login"]')) {
      desktopActions.innerHTML = `
        <a href="${dashboardUrl}" style="background-color: #f8f9fa; border: 1px solid #e5e7eb;" class="flex items-center gap-[10px] px-[10px] py-[6px] rounded-full hover:shadow-md transition-all duration-200">
          ${avatarHtml}
          <span class="font-['Inter'] font-semibold text-[#111827] text-[15px] pr-[4px] whitespace-nowrap">${name}</span>
        </a>
      `;
    }

    // Mobile Actions
    const mobileActions = document.querySelector('#navbar .mt-4.pt-4.border-t.border-gray-100.flex.flex-col.gap-3');
    if (mobileActions && mobileActions.querySelector('a[href*="login"]')) {
      const mobileAvatarHtml = currentUser.image_url
        ? `<img src="${html(currentUser.image_url)}" class="w-[40px] h-[40px] rounded-full object-cover shrink-0 shadow-sm border border-gray-100">`
        : `<div style="background-color: #e2e8f0; color: #1e293b;" class="w-[40px] h-[40px] rounded-full flex items-center justify-center font-['Inter'] font-bold text-[16px] shrink-0">${initial}</div>`;

      mobileActions.innerHTML = `
        <a href="${dashboardUrl}" style="background-color: #f8f9fa; border: 1px solid #e5e7eb;" class="flex items-center gap-[12px] px-[10px] py-[10px] rounded-[16px] hover:shadow-md transition-all">
          ${mobileAvatarHtml}
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
    document.addEventListener('change', changeHandler, true);
    document.addEventListener('submit', submitHandler, true);
    window.addEventListener('storage', (event) => {
      if (event.key === 'nest_content_updated_at') scheduleInit(true);
      if (event.key === 'nest_current_user') {
        updateNavbarAuthState();
        // Redirect if user logged out from another tab and we are on a dashboard
        if (!event.newValue && isDashboardPage()) {
          window.location.href = 'index.html';
        }
      }
    });
    window.addEventListener('focus', () => scheduleInit(false));

    // Observe body for navbar injections
    const bodyObserver = new MutationObserver(() => updateNavbarAuthState());
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    updateNavbarAuthState();

    const root = mainRoot();
    if (root) {
      const observer = new MutationObserver(() => scheduleInit(false));
      observer.observe(root, { childList: true });
      scheduleInit(true);
    }
    refreshNotifications().catch(console.error);
    startRealtime();
  }

  window.NESTSupabaseApp = {
    refresh: () => scheduleInit(true),
    approveRequest: (id) => decideRequest(id, 'approved'),
    rejectRequest: (id) => decideRequest(id, 'rejected'),
    uploadFile: (bucket, path, file) => uploadFile(bucket, path, file),
    updateRow: (table, id, payload) => updateRow(table, id, payload),
    currentUser: () => readStore('nest_current_user')
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
