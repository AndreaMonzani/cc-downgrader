import './style.css';
import { animate, stagger, inView } from 'motion';
import anime from 'animejs';
import { inspectFile, processFile } from './core/fileRouter.js';

// --- DOM REFERENCES ---
const viewHome = document.getElementById('view-home');
const viewAdvanced = document.getElementById('view-advanced');
const modeQuickBtn = document.getElementById('mode-quick-btn');
const modeProBtn = document.getElementById('mode-pro-btn');
const modeThumb = document.getElementById('mode-thumb');

const dropzoneHome = document.getElementById('dropzone-home');
const dropzoneIdleState = document.getElementById('dropzone-idle-state');
const dropzoneTelemetryState = document.getElementById('dropzone-telemetry-state');
const dropzoneAe = document.getElementById('dropzone-ae');
const dropzonePr = document.getElementById('dropzone-pr');

const studioToast = document.getElementById('studio-toast');
const toastMessage = document.getElementById('toast-message');

const advancedModal = document.getElementById('advanced-modal');
const coffeeModal = document.getElementById('coffee-modal');
const adblockModal = document.getElementById('adblock-modal');
const closeAdblockBtn = document.getElementById('close-adblock');
const understandAdblockBtn = document.getElementById('understand-adblock-btn');

const metadataBox = document.getElementById('file-metadata');
const versionSelector = document.getElementById('version-selector');
const modalVersionThumb = document.getElementById('modal-version-thumb');
const executeAdvancedBtn = document.getElementById('execute-advanced-btn');
const closeButtons = document.querySelectorAll('.close-modal');

const trickWarning = document.getElementById('trick-warning');
const trickDetails = document.getElementById('trick-details');
const customFileNameInput = document.getElementById('custom-file-name');
const fileExtLabel = document.getElementById('file-ext-label');

// --- STATE ---
let isAdvancedMode = false;
let currentPendingFile = null;
let currentTargetVersion = null;
let currentFileExt = '';
let toastTimeout = null;

// --- 1. MOTION.DEV ENTRANCE CHOREOGRAPHY ---
function runEntranceAnimations() {
  const heroItems = document.querySelectorAll('.hero-animate');
  if (heroItems.length) {
    animate(
      heroItems,
      {
        opacity: [0, 1],
        transform: ['translateY(18px)', 'translateY(0px)']
      },
      {
        duration: 0.65,
        delay: stagger(0.09),
        easing: [0.22, 1, 0.36, 1]
      }
    );
  }

  inView('.seo-card, .seo-faq-section', (entry) => {
    animate(
      entry.target,
      {
        opacity: [0, 1],
        transform: ['translateY(20px)', 'translateY(0px)']
      },
      {
        duration: 0.55,
        easing: [0.22, 1, 0.36, 1]
      }
    );
  }, { amount: 0.15 });
}

// --- 2. ANIME.JS DROPZONE PERIMETER BEAM & RETICLES ---
function initAnimeDropzoneEffects() {
  const beamRect = document.getElementById('dropzone-beam-rect');
  if (beamRect) {
    anime({
      targets: beamRect,
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: 'linear',
      duration: 3800,
      loop: true
    });
  }

  if (dropzoneHome) {
    dropzoneHome.addEventListener('mouseenter', () => {
      anime({
        targets: '.reticle',
        scale: [1, 1.15, 1],
        duration: 380,
        easing: 'easeOutQuad'
      });
    });
  }
}

// --- 3. PARTICLE BURST ENGINE (ANIME.JS) ---
function spawnParticles(x, y) {
  const colors = ['#C084FC', '#818CF8', '#E9D5FF', '#38BDF8'];
  const count = 16;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('span');
    particle.className = 'koko-particle';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.backgroundColor = colors[i % colors.length];
    document.body.appendChild(particle);

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const distance = 36 + Math.random() * 48;

    anime({
      targets: particle,
      translateX: Math.cos(angle) * distance,
      translateY: Math.sin(angle) * distance,
      scale: [1, 0],
      opacity: [1, 0],
      duration: 620 + Math.random() * 200,
      easing: 'easeOutExpo',
      complete: () => particle.remove()
    });
  }
}

document.querySelectorAll('.particle-trigger').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX || rect.left + rect.width / 2;
    const y = e.clientY || rect.top + rect.height / 2;
    spawnParticles(x, y);
  });
});

// --- 4. SPOTLIGHT BENTO CARDS ---
document.querySelectorAll('.spotlight-card').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  });
});

// --- 5. STUDIO TOAST FEEDBACK ---
function showToast(message, isError = false) {
  if (!studioToast || !toastMessage) return;
  clearTimeout(toastTimeout);

  toastMessage.textContent = message;
  studioToast.classList.toggle('is-error', isError);
  studioToast.classList.remove('hidden');

  animate(
    studioToast,
    {
      opacity: [0, 1],
      transform: ['translate(-50%, -10px)', 'translate(-50%, 0px)']
    },
    { duration: 0.25, easing: 'easeOut' }
  );

  if (isError && dropzoneHome) {
    animate(
      dropzoneHome,
      {
        transform: ['translateX(0px)', 'translateX(-7px)', 'translateX(7px)', 'translateX(-4px)', 'translateX(0px)']
      },
      { duration: 0.35 }
    );
  }

  toastTimeout = setTimeout(() => {
    animate(
      studioToast,
      { opacity: [1, 0], transform: ['translate(-50%, 0px)', 'translate(-50%, -8px)'] },
      { duration: 0.2 }
    ).finished.then(() => {
      studioToast.classList.add('hidden');
    });
  }, 3600);
}

// --- 6. SEGMENTED MODE SWITCHER ---
function updateModeThumb(activeBtn) {
  if (!modeThumb || !activeBtn) return;
  animate(
    modeThumb,
    {
      width: `${activeBtn.offsetWidth}px`,
      transform: `translateX(${activeBtn.offsetLeft - 3}px)`
    },
    { duration: 0.28, easing: [0.22, 1, 0.36, 1] }
  );
}

function setAdvancedMode(enable) {
  if (isAdvancedMode === enable) return;
  isAdvancedMode = enable;

  modeQuickBtn.classList.toggle('active', !enable);
  modeQuickBtn.setAttribute('aria-selected', String(!enable));
  modeProBtn.classList.toggle('active', enable);
  modeProBtn.setAttribute('aria-selected', String(enable));
  updateModeThumb(enable ? modeProBtn : modeQuickBtn);

  const outgoing = enable ? viewHome : viewAdvanced;
  const incoming = enable ? viewAdvanced : viewHome;

  animate(
    outgoing,
    { opacity: [1, 0], transform: ['translateY(0px)', 'translateY(8px)'] },
    { duration: 0.2 }
  ).finished.then(() => {
    outgoing.classList.add('hidden');
    outgoing.classList.remove('active');
    incoming.classList.remove('hidden');
    incoming.classList.add('active');
    animate(
      incoming,
      { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0px)'] },
      { duration: 0.32, easing: [0.22, 1, 0.36, 1] }
    );
  });
}

modeQuickBtn?.addEventListener('click', () => setAdvancedMode(false));
modeProBtn?.addEventListener('click', () => setAdvancedMode(true));

// --- 7. TOP NAV PILL HOVER (getBoundingClientRect FIX FOR DROPDOWN) ---
const headerNav = document.getElementById('header-nav');
const navThumb = document.getElementById('nav-thumb');

if (headerNav && navThumb) {
  headerNav.querySelectorAll('.nav-link:not(.support-cta)').forEach((link) => {
    link.addEventListener('mouseenter', () => {
      const navRect = headerNav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      const leftOffset = linkRect.left - navRect.left;

      animate(
        navThumb,
        {
          opacity: 1,
          width: `${linkRect.width}px`,
          transform: `translateX(${leftOffset}px)`
        },
        { duration: 0.22, easing: [0.22, 1, 0.36, 1] }
      );
    });
  });

  headerNav.addEventListener('mouseleave', () => {
    animate(navThumb, { opacity: 0 }, { duration: 0.18 });
  });
}

// --- 8. MOBILE SWIPE GESTURE ---
let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

window.addEventListener('touchend', (e) => {
  const diffX = e.changedTouches[0].screenX - touchStartX;
  const diffY = e.changedTouches[0].screenY - touchStartY;
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 65) {
    if (diffX < 0 && !isAdvancedMode) setAdvancedMode(true);
    if (diffX > 0 && isAdvancedMode) setAdvancedMode(false);
  }
}, { passive: true });

// --- 9. DRAG & DROP HANDLERS ---
function isValidProjectFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  return ['prproj', 'aep', 'aepx'].includes(ext) ? ext : null;
}

function setupDropzone(el, onFileAccepted) {
  if (!el) return;

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('drag-over');
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over');
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    const ext = isValidProjectFile(file);
    if (!ext) {
      showToast('Unsupported format. Please drop .prproj, .aep, or .aepx files.', true);
      return;
    }
    onFileAccepted(file, ext);
  });

  const openPicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.prproj,.aep,.aepx';
    input.onchange = (evt) => {
      const file = evt.target.files?.[0];
      if (!file) return;
      const ext = isValidProjectFile(file);
      if (!ext) {
        showToast('Unsupported format. Please select .prproj, .aep, or .aepx files.', true);
        return;
      }
      onFileAccepted(file, ext);
    };
    input.click();
  };

  el.addEventListener('click', openPicker);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  });
}

setupDropzone(dropzoneHome, async (file, ext) => {
  const isAe = ['aep', 'aepx'].includes(ext);
  await triggerEngine(file, isAe ? '24' : null, !isAe ? '1' : null);
});

setupDropzone(dropzoneAe, (file, ext) => {
  const isPr = ext === 'prproj';
  openAdvancedModal(file, isPr ? 'pr' : 'ae', isPr);
});

setupDropzone(dropzonePr, (file, ext) => {
  const isAe = ['aep', 'aepx'].includes(ext);
  openAdvancedModal(file, isAe ? 'ae' : 'pr', isAe);
});

// --- 10. PRO STUDIO MODAL & VERSION PILLS (23-27) ---
function updateModalVersionThumb(activeBtn) {
  if (!modalVersionThumb || !activeBtn) return;
  animate(
    modalVersionThumb,
    {
      width: `${activeBtn.offsetWidth}px`,
      transform: `translateX(${activeBtn.offsetLeft - 4}px)`
    },
    { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
  );
}

function renderModalVersions(type) {
  versionSelector.innerHTML = '';
  const options = type === 'ae'
    ? [
        { val: '27', label: 'AE 27' },
        { val: '26', label: 'AE 26' },
        { val: '25', label: 'AE 25' },
        { val: '24', label: 'AE 24' },
        { val: '23', label: 'AE 23' }
      ]
    : [
        { val: '45', label: 'PR 27' },
        { val: '44', label: 'PR 26' },
        { val: '43', label: 'PR 25' },
        { val: '42', label: 'PR 24' },
        { val: '41', label: 'PR 23' },
        { val: '1',  label: 'Legacy' }
      ];

  const defaultIdx = 3;

  options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ver-pill-btn';
    btn.dataset.val = opt.val;
    btn.textContent = opt.label;

    if (idx === defaultIdx) {
      btn.classList.add('active');
      currentTargetVersion = opt.val;
    }

    btn.addEventListener('click', () => {
      versionSelector.querySelectorAll('.ver-pill-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTargetVersion = btn.dataset.val;
      updateModalVersionThumb(btn);
    });

    versionSelector.appendChild(btn);
  });

  requestAnimationFrame(() => {
    const active = versionSelector.querySelector('.ver-pill-btn.active');
    updateModalVersionThumb(active);
  });
}

function openModalAnimated(overlay) {
  overlay.classList.remove('hidden');
  const card = overlay.querySelector('.studio-modal');
  if (card) {
    animate(
      card,
      { opacity: [0, 1], transform: ['scale(0.96) translateY(10px)', 'scale(1) translateY(0px)'] },
      { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
    );
  }
}

function closeModalAnimated(overlay) {
  const card = overlay.querySelector('.studio-modal');
  if (card) {
    animate(
      card,
      { opacity: [1, 0], transform: ['scale(1)', 'scale(0.97)'] },
      { duration: 0.16 }
    ).finished.then(() => overlay.classList.add('hidden'));
  } else {
    overlay.classList.add('hidden');
  }
}

async function openAdvancedModal(file, actualType, autoSwitched = false) {
  currentPendingFile = file;

  const lastDotIdx = file.name.lastIndexOf('.');
  const baseName = lastDotIdx !== -1 ? file.name.substring(0, lastDotIdx) : file.name;
  currentFileExt = lastDotIdx !== -1 ? file.name.substring(lastDotIdx) : (actualType === 'ae' ? '.aep' : '.prproj');

  customFileNameInput.value = `${baseName}_downgraded`;
  fileExtLabel.textContent = currentFileExt;

  if (autoSwitched) {
    const label = actualType === 'ae' ? 'After Effects' : 'Premiere Pro';
    trickDetails.textContent = `Auto-routed to ${label} engine based on file header signature.`;
    trickWarning.classList.remove('hidden');
  } else {
    trickWarning.classList.add('hidden');
  }

  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  let detectedInfo = 'Inspecting header...';

  try {
    const info = await inspectFile(file);
    detectedInfo = info.detectedFullLabel;
  } catch {
    detectedInfo = actualType === 'ae' ? 'After Effects Binary' : 'Premiere Pro XML';
  }

  metadataBox.innerHTML = `
    <strong>Source File:</strong> ${file.name}<br>
    <strong>Detected Build:</strong> ${detectedInfo}<br>
    <strong>Payload Size:</strong> ${sizeMb} MB
  `;

  renderModalVersions(actualType);
  openModalAnimated(advancedModal);
}

closeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const overlay = btn.closest('.modal-overlay');
    if (overlay) closeModalAnimated(overlay);
  });
});

closeAdblockBtn?.addEventListener('click', () => closeModalAnimated(adblockModal));
understandAdblockBtn?.addEventListener('click', () => closeModalAnimated(adblockModal));

executeAdvancedBtn?.addEventListener('click', async () => {
  if (!currentPendingFile) return;
  closeModalAnimated(advancedModal);

  const ext = currentPendingFile.name.split('.').pop().toLowerCase();
  const isAe = ['aep', 'aepx'].includes(ext);

  let chosenName = customFileNameInput.value.trim() || 'project_downgraded';
  if (!chosenName.toLowerCase().endsWith(currentFileExt.toLowerCase())) {
    chosenName += currentFileExt;
  }

  await triggerEngine(
    currentPendingFile,
    isAe ? currentTargetVersion : null,
    !isAe ? currentTargetVersion : null,
    chosenName
  );
});

// --- 11. CONVERSION EXECUTION & TELEMETRY ---
async function triggerEngine(file, aeVersion, prVersion, customOutputName = null) {
  const startTime = performance.now();

  try {
    const result = await processFile(file, { aeVersion, prVersion });
    const elapsedMs = Math.max(4, Math.round(performance.now() - startTime));
    const downloadName = customOutputName || result.filename;

    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    if (dropzoneIdleState && dropzoneTelemetryState) {
      document.getElementById('tel-filename').textContent = downloadName;
      document.getElementById('tel-from').textContent = result.sourceVersion;
      document.getElementById('tel-to').textContent = result.targetVersion;
      document.getElementById('tel-sub').textContent = `Patched locally in ${elapsedMs}ms. Drop another file anytime.`;

      dropzoneIdleState.classList.add('hidden');
      dropzoneTelemetryState.classList.remove('hidden');

      anime({
        targets: dropzoneTelemetryState,
        scale: [0.95, 1],
        opacity: [0, 1],
        duration: 420,
        easing: 'easeOutExpo'
      });
    }

    const dzRect = dropzoneHome?.getBoundingClientRect();
    if (dzRect) {
      spawnParticles(dzRect.left + dzRect.width / 2, dzRect.top + dzRect.height / 2);
    }

    showToast(`Patched ${result.sourceVersion} → ${result.targetVersion} (${elapsedMs}ms)`);

    const count = parseInt(localStorage.getItem('downgrade_count') || '0', 10) + 1;
    localStorage.setItem('downgrade_count', String(count));
    if (count % 3 === 0) {
      setTimeout(() => openModalAnimated(coffeeModal), 900);
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Failed to patch project file.', true);
  }
}

// --- 12. POLITE ADBLOCK DETECTOR ---
function detectAdBlock() {
  const probe = document.createElement('div');
  probe.innerHTML = '&nbsp;';
  probe.className = 'adsbygoogle ad-zone ad-space google-ad';
  probe.style.position = 'absolute';
  probe.style.top = '-9999px';
  document.body.appendChild(probe);

  setTimeout(() => {
    const isBlocked = probe.offsetHeight === 0 || window.adsbygoogle === undefined;
    document.body.removeChild(probe);

    if (isBlocked && !sessionStorage.getItem('adblock_dismissed')) {
      openModalAnimated(adblockModal);
      sessionStorage.setItem('adblock_dismissed', 'true');
    }
  }, 1400);
}

// --- INITIALIZE ---
window.addEventListener('DOMContentLoaded', () => {
  updateModeThumb(modeQuickBtn);
  runEntranceAnimations();
  initAnimeDropzoneEffects();
});

window.addEventListener('load', detectAdBlock);