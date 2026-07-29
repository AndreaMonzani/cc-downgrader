import './style.css';
import { processFile } from './core/fileRouter.js';

// --- ELEMENTI DOM ---
const viewHome = document.getElementById('view-home');
const viewAdvanced = document.getElementById('view-advanced');
const toggleBtn = document.getElementById('toggle-mode-btn');
const dropzoneHome = document.getElementById('dropzone-home');
const dropzoneAe = document.getElementById('dropzone-ae');
const dropzonePr = document.getElementById('dropzone-pr');

const errorOverlay = document.getElementById('error-overlay');
const errorCountdown = document.getElementById('error-countdown');

const advancedModal = document.getElementById('advanced-modal');
const coffeeModal = document.getElementById('coffee-modal');
const metadataBox = document.getElementById('file-metadata');
const versionSelector = document.getElementById('version-selector');
const executeAdvancedBtn = document.getElementById('execute-advanced-btn');
const closeButtons = document.querySelectorAll('.close-modal');

// --- STATO GLOBALE ---
let isAdvancedMode = false;
let currentPendingFile = null;
let currentTargetVersion = null;
let errorTimer = null;

// --- 1. CURSORE CUSTOM & SFONDO DINAMICO ---
const dot = document.getElementById('cursor-dot');
const ring = document.getElementById('cursor-ring');
let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
let ringX = mouseX, ringY = mouseY;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX; 
  mouseY = e.clientY;
  
  if(dot) {
    dot.style.left = `${mouseX}px`; 
    dot.style.top = `${mouseY}px`;
  }

  document.documentElement.style.setProperty('--mouse-x', `${mouseX}px`);
  document.documentElement.style.setProperty('--mouse-y', `${mouseY}px`);
});

function renderCursor() {
  ringX += (mouseX - ringX) * 0.15;
  ringY += (mouseY - ringY) * 0.15;
  if(ring) {
    ring.style.left = `${ringX}px`; 
    ring.style.top = `${ringY}px`;
  }
  requestAnimationFrame(renderCursor);
}
requestAnimationFrame(renderCursor);

// Hover magnetico
document.querySelectorAll('button, a, .split-pane, .dropzone-giant, .nav-link').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
});

// --- 2. TOGGLE VIEWS (HOME <=> ADVANCED) ---
toggleBtn.addEventListener('click', () => {
  isAdvancedMode = !isAdvancedMode;
  if(isAdvancedMode) {
    viewHome.classList.remove('active');
    viewAdvanced.classList.remove('hidden');
    setTimeout(() => viewAdvanced.classList.add('active'), 50);
    toggleBtn.querySelector('.text').innerText = "Back to Quick Drop";
  } else {
    viewAdvanced.classList.remove('active');
    setTimeout(() => viewAdvanced.classList.add('hidden'), 500);
    viewHome.classList.add('active');
    toggleBtn.querySelector('.text').innerText = "I'm a pro, let's go to advanced mode!";
  }
});

// --- 3. BUBBLE NAV MODALE (VERSION SELECTOR) ---
function renderModalBubbleNav(type) {
  versionSelector.innerHTML = '';
  const options = type === 'ae' ? 
    [{ val: '24', label: 'AE 2024' }, { val: '23', label: 'AE 2023' }] : 
    [{ val: '1', label: 'Legacy Auto (Universal)' }];
  
  options.forEach((opt, idx) => {
    const a = document.createElement('a');
    a.href = '#'; 
    a.dataset.val = opt.val; 
    a.innerText = opt.label;
    
    if(idx === 0) { 
      a.classList.add('active'); 
      currentTargetVersion = opt.val; 
    }
    
    a.addEventListener('click', (e) => {
      e.preventDefault();
      versionSelector.querySelectorAll('a').forEach(n => n.classList.remove('active'));
      a.classList.add('active');
      currentTargetVersion = a.dataset.val;
      updateModalBubble();
    });
    versionSelector.appendChild(a);
  });
  
  setTimeout(updateModalBubble, 50);
}

function updateModalBubble() {
  const activeLink = versionSelector.querySelector('a.active');
  const bubble = document.querySelector('.modal-bubble');
  if(activeLink && bubble) {
    bubble.style.width = `${activeLink.offsetWidth}px`;
    bubble.style.transform = `translateX(${activeLink.offsetLeft}px)`;
  }
}

// --- 4. BUBBLE HOVER PER LA TOP NAV (HEADER) ---
const headerNav = document.getElementById('header-nav');
const topBubble = document.querySelector('.top-bubble');

if(headerNav && topBubble) {
  headerNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('mouseenter', () => {
      topBubble.style.opacity = '1';
      topBubble.style.width = `${link.offsetWidth}px`;
      topBubble.style.transform = `translateX(${link.offsetLeft}px)`;
    });
  });

  headerNav.addEventListener('mouseleave', () => {
    topBubble.style.opacity = '0';
  });
}

// --- 5. ERROR STATE & COUNTDOWN ---
function showErrorState() {
  errorOverlay.classList.remove('hidden');
  let count = 5;
  errorCountdown.innerText = count;
  clearInterval(errorTimer);
  
  errorTimer = setInterval(() => {
    count--;
    errorCountdown.innerText = count;
    if(count <= 0) {
      clearInterval(errorTimer);
      errorOverlay.classList.add('hidden');
    }
  }, 1000);
}

// --- 6. DRAG & DROP ENGINE ---
function setupDropzone(el, onDropCb) {
  if(!el) return;
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if(!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if(!['prproj', 'aep', 'aepx'].includes(ext)) {
      showErrorState();
      return;
    }
    onDropCb(file, ext);
  });
}

// Quick Drop su HOME
setupDropzone(dropzoneHome, async (file, ext) => {
  const isAe = ['aep', 'aepx'].includes(ext);
  const version = isAe ? "24" : "1";
  await triggerEngine(file, isAe ? version : null, !isAe ? version : null);
});

// Drop su ADVANCED (AE)
setupDropzone(dropzoneAe, (file, ext) => {
  if(!['aep', 'aepx'].includes(ext)) { showErrorState(); return; }
  openAdvancedModal(file, 'ae');
});

// Drop su ADVANCED (PR)
setupDropzone(dropzonePr, (file, ext) => {
  if(ext !== 'prproj') { showErrorState(); return; }
  openAdvancedModal(file, 'pr');
});

// --- 7. MODAL & ESECUZIONE ---
function openAdvancedModal(file, type) {
  currentPendingFile = file;
  
  const sizeMb = (file.size / (1024*1024)).toFixed(2);
  const date = new Date(file.lastModified).toLocaleString();
  metadataBox.innerHTML = `
    <strong>Name:</strong> ${file.name}<br>
    <strong>Size:</strong> ${sizeMb} MB<br>
    <strong>Last Modified:</strong> ${date}
  `;

  renderModalBubbleNav(type);
  advancedModal.classList.remove('hidden');
}

closeButtons.forEach(btn => btn.addEventListener('click', () => {
  advancedModal.classList.add('hidden');
  coffeeModal.classList.add('hidden');
}));

executeAdvancedBtn.addEventListener('click', async () => {
  advancedModal.classList.add('hidden');
  const ext = currentPendingFile.name.split('.').pop().toLowerCase();
  const isAe = ['aep', 'aepx'].includes(ext);
  
  const aeVer = isAe ? currentTargetVersion : null;
  const prVer = !isAe ? currentTargetVersion : null;
  
  await triggerEngine(currentPendingFile, aeVer, prVer);
});

// --- 8. CONVERSIONE E DONAZIONI ---
async function triggerEngine(file, aeVersion, prVersion) {
  if(ring) ring.style.borderColor = "#08B2E3";
  document.body.style.cursor = "wait";

  try {
    const result = await processFile(file, { aeVersion, prVersion });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(result.blob);
    a.download = result.filename;
    a.click();

    let count = parseInt(localStorage.getItem('downgrade_count') || '0');
    count++;
    localStorage.setItem('downgrade_count', count.toString());

    if(count % 3 === 0) {
      setTimeout(() => coffeeModal.classList.remove('hidden'), 1000);
    }
  } catch (error) {
    console.error(error);
    alert("Conversion error: " + error.message);
  } finally {
    if(ring) ring.style.borderColor = "rgba(207, 150, 253, 0.5)";
    document.body.style.cursor = "none";
  }
}

// --- 9. COOKIE BANNER & GA4 CONSENT ---
const cookieBanner = document.getElementById('cookie-banner');

if (!localStorage.getItem('cookies_accepted')) {
  document.getElementById('accept-cookies').addEventListener('click', () => {
    localStorage.setItem('cookies_accepted', 'true');
    if (cookieBanner) cookieBanner.style.display = 'none';
    
    // Sblocca il tracciamento di Google Analytics dopo il consenso
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        'analytics_storage': 'granted'
      });
    }
  });
} else {
  if (cookieBanner) cookieBanner.style.display = 'none';
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      'analytics_storage': 'granted'
    });
  }
}