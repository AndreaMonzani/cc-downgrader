import './style.css';
import { stagger, inView } from 'motion';
import { DURATION, EASE, safeAnimate, animateThumb, prefersReducedMotion } from './core/motionTokens.js';
import { inspectFile, processFile } from './core/fileRouter.js';

// --- DOM REFERENCES ---
const viewHome = document.getElementById('view-home');
const viewAdvanced = document.getElementById('view-advanced');
const modeQuickBtn = document.getElementById('mode-quick-btn');
const modeProBtn = document.getElementById('mode-pro-btn');
const modeThumb = document.getElementById('mode-thumb');
const modeControl = document.querySelector('.segmented-control');

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

// --- 1. MOTION ENTRANCE & SCROLL ---
function runEntranceAnimations() {
  if (prefersReducedMotion()) return;

  const heroItems = document.querySelectorAll('.hero-animate');
  if (heroItems.length) {
    safeAnimate(
      heroItems,
      { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'] },
      { duration: DURATION.enter, delay: stagger(0.06), easing: EASE.out }
    );
  }

  inView('.spec-sheet, .seo-faq-section', (entry) => {
    safeAnimate(
      entry.target,
      { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0px)'] },
      { duration: DURATION.enter, easing: EASE.out }
    );
  }, { amount: 0.15 });
}

// --- 2. NON-BLOCKING TOAST ---
function showToast(message, isError = false) {
  if (!studioToast || !toastMessage) return;
  clearTimeout(toastTimeout);

  toastMessage.textContent = message;
  studioToast.classList.toggle('is-error', isError);
  studioToast.classList.remove('hidden');

  safeAnimate(
    studioToast,
    { opacity: [0, 1], transform: ['translate(-50%, -8px)', 'translate(-50%, 0px)'] },
    { duration: DURATION.fast }
  );

  if (isError && dropzoneHome) {
    safeAnimate(
      dropzoneHome,
      { transform: ['translateX(0px)', 'translateX(-6px)', 'translateX(6px)', 'translateX(-3px)', 'translateX(0px)'] },
      { duration: DURATION.base }
    );
  }

  toastTimeout = setTimeout(() => {
    safeAnimate(
      studioToast,
      { opacity: [1, 0], transform: ['translate(-50%, 0px)', 'translate(-50%, -6px)'] },
      { duration: DURATION.instant }
    ).finished.then(() => {
      studioToast.classList.add('hidden');
    });
  }, 3400);
}

// --- 3. MODE SWITCHER ---
function setAdvancedMode(enable) {
  if (isAdvancedMode === enable) return;
  isAdvancedMode = enable;

  modeQuickBtn.classList.toggle('active', !enable);
  modeQuickBtn.setAttribute('aria-selected', String(!enable));
  modeProBtn.classList.toggle('active', enable);
  modeProBtn.setAttribute('aria-selected', String(enable));
  animateThumb(modeThumb, enable ? modeProBtn : modeQuickBtn, modeControl, 3);

  const outgoing = enable ? viewHome : viewAdvanced;
  const incoming = enable ? viewAdvanced : viewHome;

  safeAnimate(
    outgoing,
    { opacity: [1, 0], transform: ['translateY(0px)', 'translateY(6px)'] },
    { duration: DURATION.instant }
  ).finished.then(() => {
    outgoing.classList.add('hidden');
    outgoing.classList.remove('active');
    incoming.classList.remove('hidden');
    incoming.classList.add('active');
    safeAnimate(
      incoming,
      { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] },
      { duration: DURATION.base }
    );
  });
}

modeQuickBtn?.addEventListener('click', () => setAdvancedMode(false));
modeProBtn?.addEventListener('click', () => setAdvancedMode(true));

// --- 4. TOP NAV PILL HOVER ---
const headerNav = document.getElementById('header-nav');
const navThumb = document.getElementById('nav-thumb');

if (headerNav && navThumb) {
  headerNav.querySelectorAll('.nav-link:not(.support-cta)').forEach((link) => {
    link.addEventListener('mouseenter', () => {
      animateThumb(navThumb, link, headerNav, 0);
    });
  });

  headerNav.addEventListener('mouseleave', () => {
    safeAnimate(navThumb, { opacity: 0 }, { duration: DURATION.instant });
  });
}

// --- 5. MOBILE SWIPE GESTURE ---
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

// --- 6. DRAG & DROP HANDLERS ---
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
      showToast('Unsupported format. Drop .prproj, .aep, or .aepx files.', true);
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
        showToast('Unsupported format. Select .prproj, .aep, or .aepx files.', true);
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

// --- 7. PRO STUDIO MODAL & VERSION PILLS ---
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
      animateThumb(modalVersionThumb, btn, versionSelector, 0);
    });

    versionSelector.appendChild(btn);
  });

  requestAnimationFrame(() => {
    const active = versionSelector.querySelector('.ver-pill-btn.active');
    animateThumb(modalVersionThumb, active, versionSelector, 0);
  });
}

function openModalAnimated(overlay) {
  overlay.classList.remove('hidden');
  const card = overlay.querySelector('.studio-modal');
  if (card) {
    safeAnimate(
      card,
      { opacity: [0, 1], transform: ['scale(0.97) translateY(8px)', 'scale(1) translateY(0px)'] },
      { duration: DURATION.fast }
    );
  }
}

function closeModalAnimated(overlay) {
  if (!overlay || overlay.classList.contains('hidden')) return;
  const card = overlay.querySelector('.studio-modal');
  if (card) {
    safeAnimate(
      card,
      { opacity: [1, 0], transform: ['scale(1)', 'scale(0.98)'] },
      { duration: DURATION.instant }
    ).finished.then(() => overlay.classList.add('hidden'));
  } else {
    overlay.classList.add('hidden');
  }
}

function renderMetadataRows(rows) {
  metadataBox.innerHTML = '';
  rows.forEach(([label, value], i) => {
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    metadataBox.appendChild(strong);
    metadataBox.appendChild(document.createTextNode(value));
    if (i < rows.length - 1) metadataBox.appendChild(document.createElement('br'));
  });
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

  renderMetadataRows([
    ['Source File', file.name],
    ['Detected Build', detectedInfo],
    ['Payload Size', `${sizeMb} MB`]
  ]);

  renderModalVersions(actualType);
  openModalAnimated(advancedModal);
}

closeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const overlay = btn.closest('.modal-overlay');
    if (overlay) closeModalAnimated(overlay);
  });
});

document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModalAnimated(overlay);
  });
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach((m) => closeModalAnimated(m));
  }
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

// --- 8. CONVERSION EXECUTION & TELEMETRY ---
async function triggerEngine(file, aeVersion, prVersion, customOutputName = null) {
  const startTime = performance.now();
  dropzoneHome?.classList.add('is-processing');

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
      document.getElementById('tel-sub').textContent = `Patched locally in ${elapsedMs}ms • 0 B uploaded`;

      dropzoneIdleState.classList.add('hidden');
      dropzoneTelemetryState.classList.remove('hidden');

      safeAnimate(
        dropzoneTelemetryState,
        { opacity: [0, 1], transform: ['scale(0.97)', 'scale(1)'] },
        { duration: DURATION.base }
      );
    }

    showToast(`Patched ${result.sourceVersion} → ${result.targetVersion} (${elapsedMs}ms)`);

    const count = parseInt(localStorage.getItem('downgrade_count') || '0', 10) + 1;
    localStorage.setItem('downgrade_count', String(count));
    if (count % 3 === 0) {
      setTimeout(() => openModalAnimated(coffeeModal), 800);
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Failed to patch project file.', true);
  } finally {
    dropzoneHome?.classList.remove('is-processing');
  }
}

// --- 9. POLITE ADBLOCK DETECTOR ---
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
  animateThumb(modeThumb, modeQuickBtn, modeControl, 3);
  runEntranceAnimations();
});

window.addEventListener('load', detectAdBlock);