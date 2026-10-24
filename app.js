const progressBar = document.querySelector('#reading-progress');
const soundToggle = document.querySelector('#sound-toggle');
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const lightboxClose = document.querySelector('#lightbox-close');
const chapterLinks = [...document.querySelectorAll('.chapter-nav a')];
const book = document.querySelector('#story-book');
const bookPages = [...book.querySelectorAll(':scope > section')];
const previousPage = document.querySelector('#previous-page');
const nextPage = document.querySelector('#next-page');
const pageName = document.querySelector('#page-name');
const pageCount = document.querySelector('#page-count');

const pageNames = {
  cover: 'Cover',
  beginning: 'Prologue',
  firsts: 'The firsts',
  entrance: 'The Entrance',
  between: 'Nights like home',
  jervis: 'Jervis Bay',
  goodbye: 'The platform',
  distance: 'Long distance',
  growth: 'Learning to stay',
  letter: 'A letter to us',
  japan: 'Narita'
};

const chapterForPage = {
  between: 'entrance',
  goodbye: 'jervis',
  letter: 'growth'
};

let soundEnabled = false;
let audioContext;
let currentPageIndex = 0;
let bookScrollFrame;
let turnAnimationTimer;
let pageSettleTimer;
let pendingPageIndex = null;

function playClick(frequency = 520) {
  if (!soundEnabled) return;

  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.68, now + 0.08);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.1);
}

soundToggle?.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.textContent = soundEnabled ? 'sound on' : 'sound off';
  playClick(650);
});

function updateReadingProgress() {
  const activePage = bookPages[currentPageIndex];
  const pageScrollRange = activePage.scrollHeight - activePage.clientHeight;
  const pageProgress = pageScrollRange > 0 ? activePage.scrollTop / pageScrollRange : 0;
  const percent = ((currentPageIndex + pageProgress) / bookPages.length) * 100;
  progressBar.style.width = `${percent}%`;
}

function nearestPageIndex() {
  return bookPages.reduce((nearest, page, index) => (
    Math.abs(page.offsetLeft - book.scrollLeft) < Math.abs(bookPages[nearest].offsetLeft - book.scrollLeft)
      ? index
      : nearest
  ), 0);
}

function updatePageInterface(index) {
  currentPageIndex = Math.max(0, Math.min(bookPages.length - 1, index));
  const activePage = bookPages[currentPageIndex];
  const activeChapter = chapterForPage[activePage.id] ?? activePage.id;

  bookPages.forEach((page, pageIndex) => page.classList.toggle('is-current-page', pageIndex === currentPageIndex));
  chapterLinks.forEach((link) => link.classList.toggle('active', link.hash === `#${activeChapter}`));
  previousPage.disabled = currentPageIndex === 0;
  nextPage.disabled = currentPageIndex === bookPages.length - 1;
  pageName.textContent = pageNames[activePage.id] ?? activePage.id;
  pageCount.textContent = `${String(currentPageIndex + 1).padStart(2, '0')} / ${String(bookPages.length).padStart(2, '0')}`;
  updateReadingProgress();
}

function turnToPage(index, options = {}) {
  const targetIndex = Math.max(0, Math.min(bookPages.length - 1, index));
  const targetPage = bookPages[targetIndex];
  const outgoingPage = bookPages[currentPageIndex];
  const direction = targetIndex > currentPageIndex ? 'forward' : 'back';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (targetIndex !== currentPageIndex && !reduceMotion) {
    clearTimeout(turnAnimationTimer);
    outgoingPage.classList.add(`page-turning-${direction}`);
    turnAnimationTimer = setTimeout(() => outgoingPage.classList.remove('page-turning-forward', 'page-turning-back'), 470);
  }

  pendingPageIndex = targetIndex;
  clearTimeout(pageSettleTimer);
  pageSettleTimer = setTimeout(() => {
    pendingPageIndex = null;
    updatePageInterface(nearestPageIndex());
  }, options.instant || reduceMotion ? 0 : 900);

  targetPage.scrollTop = 0;
  book.scrollTo({ left: targetPage.offsetLeft, behavior: options.instant || reduceMotion ? 'auto' : 'smooth' });
  updatePageInterface(targetIndex);

  if (options.updateHash !== false) history.replaceState(null, '', `#${targetPage.id}`);
  playClick(direction === 'forward' ? 540 : 410);
}

function syncPageFromScroll() {
  cancelAnimationFrame(bookScrollFrame);
  bookScrollFrame = requestAnimationFrame(() => {
    if (pendingPageIndex !== null) {
      const targetLeft = bookPages[pendingPageIndex].offsetLeft;
      if (Math.abs(book.scrollLeft - targetLeft) > 2) return;
      pendingPageIndex = null;
    }
    updatePageInterface(nearestPageIndex());
  });
}

book.addEventListener('scroll', syncPageFromScroll, { passive: true });
bookPages.forEach((page) => page.addEventListener('scroll', updateReadingProgress, { passive: true }));

previousPage.addEventListener('click', () => turnToPage(currentPageIndex - 1));
nextPage.addEventListener('click', () => turnToPage(currentPageIndex + 1));

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.hash);
    const targetIndex = bookPages.indexOf(target);
    if (targetIndex < 0) return;
    event.preventDefault();
    turnToPage(targetIndex);
  });
});

document.addEventListener('keydown', (event) => {
  const activeTag = document.activeElement?.tagName;
  if (lightbox.open || ['INPUT', 'TEXTAREA', 'SELECT', 'VIDEO'].includes(activeTag)) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault();
    turnToPage(currentPageIndex + 1);
  }
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault();
    turnToPage(currentPageIndex - 1);
  }
});

const initialId = window.location.hash.slice(1);
const initialPage = bookPages.find((page) => page.id === initialId) ?? bookPages[0];
requestAnimationFrame(() => turnToPage(bookPages.indexOf(initialPage), { instant: true, updateHash: false }));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.13, rootMargin: '0px 0px -7% 0px' });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

chapterLinks.forEach((link) => link.addEventListener('click', () => playClick(420)));

document.querySelectorAll('.photo-button').forEach((button) => {
  button.addEventListener('click', () => {
    const preview = button.querySelector('img');
    lightboxImage.src = button.dataset.image;
    lightboxImage.alt = preview?.alt ?? '';
    lightbox.showModal();
    playClick(760);
  });
});

function closeLightbox() {
  lightbox.close();
  lightboxImage.removeAttribute('src');
  playClick(430);
}

lightboxClose?.addEventListener('click', closeLightbox);
lightbox?.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});

function pad(value) {
  return String(value).padStart(2, '0');
}

function updateCountdowns() {
  const countdownZone = document.querySelector('.countdown-zone');
  if (!countdownZone) return;

  const target = new Date(countdownZone.dataset.target).getTime();
  const remaining = Math.max(0, target - Date.now());
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);

  document.querySelectorAll('[data-days]').forEach((node) => { node.textContent = pad(days); });
  document.querySelectorAll('[data-hours]').forEach((node) => { node.textContent = pad(hours); });
  document.querySelectorAll('[data-minutes]').forEach((node) => { node.textContent = pad(minutes); });
  document.querySelectorAll('[data-seconds]').forEach((node) => { node.textContent = pad(seconds); });

  if (remaining === 0) {
    document.querySelectorAll('.timezone span').forEach((node) => { node.textContent = 'WE ARE TOGETHER'; });
  }
}

updateCountdowns();
setInterval(updateCountdowns, 1_000);
