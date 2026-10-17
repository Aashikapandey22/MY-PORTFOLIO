const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const intro = $('#intro');
const curtain = $('#curtain');
const openCurtains = () => {
  if (!curtain) return;
  curtain.classList.add('open');
  window.setTimeout(() => intro?.classList.add('done'), 650);
};

if (intro) {
  window.setTimeout(() => intro.classList.add('done'), 2100);
  $$('[data-skip]').forEach((button) => button.addEventListener('click', () => intro.classList.add('done')));
  $$('[data-open]').forEach((button) => button.addEventListener('click', openCurtains));
  $('#pullString')?.addEventListener('click', openCurtains);
}

const modeToggle = $('#modeToggle');
const applyTheme = (night) => {
  document.body.classList.toggle('night', night);
  if (!modeToggle) return;
  const label = night ? 'night mode' : 'day mode';
  const text = $('b', modeToggle);
  if (text) text.textContent = label;
  modeToggle.classList.toggle('is-night', night);
  modeToggle.setAttribute('aria-label', night ? 'Switch to day mode' : 'Switch to night mode');
  modeToggle.setAttribute('aria-pressed', String(night));
};
if (modeToggle) {
  applyTheme(localStorage.getItem('aashika-theme') === 'night');
  modeToggle.addEventListener('click', () => {
    const night = !document.body.classList.contains('night');
    localStorage.setItem('aashika-theme', night ? 'night' : 'day');
    applyTheme(night);
  });
}

const dialog = $('#projectDialog');
$$('[data-project]').forEach((button) => button.addEventListener('click', () => {
  if (!dialog) return;
  const title = $('#dialogTitle');
  if (title) title.textContent = button.dataset.project || 'Project';
  dialog.showModal();
}));
$('.dialog-close')?.addEventListener('click', () => dialog?.close());
$('.dialog-close-button')?.addEventListener('click', () => dialog?.close());
$('#dialogBack')?.addEventListener('click', () => dialog?.close());

$$('.window-close, .window-bar button[aria-label*="Close"]').forEach((control) => {
  control.addEventListener('click', () => {
    const windowElement = control.closest('.retro-window');
    if (!windowElement) return;
    const minimized = windowElement.classList.toggle('is-minimized');
    control.textContent = minimized ? '+' : '×';
    control.setAttribute('aria-label', minimized ? 'Reopen window' : 'Minimize window');
  });
});

$('#guestbookForm')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get('name');
  const note = $('#formNote');
  if (note) note.textContent = `thank you, ${name} ♡ your note is saved in this browser for now.`;
  event.currentTarget.reset();
});

$('#contactForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const note = $('#contactNote');
  const submit = form.querySelector('button[type="submit"]');
  if (!form.checkValidity()) {
    form.reportValidity();
    if (note) note.textContent = 'please fill in your name, email, and message first.';
    return;
  }
  if (submit) { submit.disabled = true; submit.dataset.originalLabel = submit.innerHTML; submit.innerHTML = 'sending…'; }
  if (note) note.textContent = 'saving your message…';
  try {
    const payload = Object.fromEntries(new FormData(form));
    payload.formStartedAt = form.dataset.startedAt || String(Date.now());
    const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Message could not be saved.');
    if (note) note.textContent = result.notification === 'sent' ? 'message saved — notification sent. ♡' : 'message saved locally on the server. Email notification is not configured yet. ♡';
    form.reset();
    form.dataset.startedAt = String(Date.now());
  } catch (error) {
    if (note) note.textContent = error.message.includes('not configured') ? 'the contact service is not configured yet — no message was sent.' : error.message;
  } finally {
    if (submit) { submit.disabled = false; submit.innerHTML = submit.dataset.originalLabel || 'prepare message ↗'; }
  }
});

const contactForm = $('#contactForm');
if (contactForm) contactForm.dataset.startedAt = String(Date.now());

const projectList = $('#projectList');
if (projectList) {
  const projectStatus = $('#projectStatus');
  const projectFallback = $('#projectFallback');
  const safeExternalUrl = (value) => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''; } catch { return ''; } };
  const renderProject = (project) => {
    const card = document.createElement('article');
    card.className = 'api-project-card';
    const art = document.createElement('div'); art.className = 'api-project-art';
    const imageUrl = safeExternalUrl(project.image_url); if (imageUrl) { const image = document.createElement('img'); image.src = imageUrl; image.alt = `${project.title} preview`; image.loading = 'lazy'; image.onerror = () => { image.remove(); art.classList.add('image-missing'); }; art.append(image); }
    const copy = document.createElement('div'); copy.className = 'api-project-copy';
    const category = document.createElement('small'); category.textContent = project.category || 'project archive';
    const title = document.createElement('h2'); title.textContent = project.title;
    const description = document.createElement('p'); description.textContent = project.description;
    const tags = document.createElement('div'); tags.className = 'api-project-tags'; (project.technologies || []).forEach((technology) => { const tag = document.createElement('span'); tag.textContent = technology; tags.append(tag); });
    const actions = document.createElement('div'); actions.className = 'api-project-actions';
    for (const [label, url] of [['live demo ↗', project.live_url], ['GitHub ↗', project.github_url]]) { const safeUrl = safeExternalUrl(url); if (!safeUrl) continue; const link = document.createElement('a'); link.className = 'text-link'; link.href = safeUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = label; actions.append(link); }
    copy.append(category, title, description, tags, actions); card.append(art, copy); return card;
  };
  fetch('/api/projects').then(async (response) => { const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'Project archive unavailable.'); return payload; }).then(({ data }) => { projectList.replaceChildren(...data.map(renderProject)); projectList.hidden = data.length === 0; if (projectFallback) projectFallback.hidden = data.length > 0; if (projectStatus) projectStatus.textContent = data.length ? `${data.length} published project${data.length === 1 ? '' : 's'} in the archive.` : 'No published projects yet.'; }).catch((error) => { if (projectStatus) projectStatus.textContent = error.message; if (projectFallback) projectFallback.hidden = false; });
}

$$('[data-filter]').forEach((filter) => filter.addEventListener('click', () => {
  $$('[data-filter]').forEach((button) => button.classList.toggle('active', button === filter));
  const category = filter.dataset.filter;
  $$('[data-category]').forEach((card) => { card.hidden = category !== 'all' && card.dataset.category !== category; });
}));

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) intro?.classList.add('done');

const cursorDot = $('#cursorDot');
if (cursorDot && window.matchMedia('(pointer:fine)').matches) {
  window.addEventListener('pointermove', (event) => { cursorDot.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`; });
  $$('a, button').forEach((item) => {
    item.addEventListener('mouseenter', () => cursorDot.classList.add('hover'));
    item.addEventListener('mouseleave', () => cursorDot.classList.remove('hover'));
  });
}

const root = document.documentElement;
const progress = document.createElement('div');
progress.className = 'scroll-progress';
progress.setAttribute('aria-hidden', 'true');
document.body.append(progress);
const backToTop = document.createElement('button');
backToTop.className = 'back-to-top';
backToTop.type = 'button';
backToTop.textContent = 'back to top ↑';
backToTop.setAttribute('aria-label', 'Back to top');
document.body.append(backToTop);
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

const updateScrollUI = () => {
  const max = root.scrollHeight - window.innerHeight;
  const amount = max > 0 ? window.scrollY / max : 0;
  progress.style.transform = `scaleX(${amount})`;
  backToTop.classList.toggle('visible', window.scrollY > window.innerHeight * .65);
};
window.addEventListener('scroll', updateScrollUI, { passive: true });
updateScrollUI();

root.classList.add('js-ready');
const revealItems = $$('.hero-copy, .about-section, .work-section, .guestbook-section, .about-desktop > .retro-window, .archive-card, .archive-empty, .contact-intro, .contact-panel, .contact-socials, footer');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  revealItems.forEach((item, index) => { item.classList.add('scroll-reveal'); item.style.transitionDelay = `${Math.min(index * 45, 240)}ms`; });
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); currentObserver.unobserve(entry.target); } });
  }, { threshold: .12 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

const marqueeToggle = $('#skillsMarqueeToggle');
if (marqueeToggle) {
  marqueeToggle.addEventListener('click', () => {
    const skillsWindow = marqueeToggle.closest('.skills-window');
    const paused = skillsWindow.classList.toggle('marquee-paused');
    marqueeToggle.textContent = paused ? 'resume marquee' : 'pause marquee';
    marqueeToggle.setAttribute('aria-pressed', String(paused));
  });
}

if (window.matchMedia('(pointer:fine)').matches) {
  let highestWindow = 30;
  $$('.retro-window').forEach((windowElement) => {
    const titleBar = $('.window-bar', windowElement);
    if (!titleBar) return;
    windowElement.classList.add('is-draggable');
    const bringToFront = () => { windowElement.style.zIndex = String(++highestWindow); };
    windowElement.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button, a, input, textarea, select')) { bringToFront(); return; }
      if (!event.target.closest('.window-bar')) { bringToFront(); return; }
      bringToFront();
      const rect = windowElement.getBoundingClientRect();
      const startX = Number(windowElement.dataset.dragX || 0);
      const startY = Number(windowElement.dataset.dragY || 0);
      const pointerX = event.clientX;
      const pointerY = event.clientY;
      windowElement.classList.add('is-dragging');
      titleBar.setPointerCapture?.(event.pointerId);
      const move = (moveEvent) => {
        const desiredLeft = rect.left + moveEvent.clientX - pointerX;
        const desiredTop = rect.top + moveEvent.clientY - pointerY;
        const left = Math.max(10, Math.min(window.innerWidth - rect.width - 10, desiredLeft));
        const top = Math.max(10, Math.min(window.innerHeight - rect.height - 10, desiredTop));
        const nextX = startX + left - rect.left;
        const nextY = startY + top - rect.top;
        windowElement.dataset.dragX = String(nextX);
        windowElement.dataset.dragY = String(nextY);
        windowElement.style.translate = `${nextX}px ${nextY}px`;
      };
      const stop = () => {
        windowElement.classList.remove('is-dragging');
        titleBar.releasePointerCapture?.(event.pointerId);
        titleBar.removeEventListener('pointermove', move);
        titleBar.removeEventListener('pointerup', stop);
        titleBar.removeEventListener('pointercancel', stop);
      };
      titleBar.addEventListener('pointermove', move);
      titleBar.addEventListener('pointerup', stop);
      titleBar.addEventListener('pointercancel', stop);
    });
  });
}
