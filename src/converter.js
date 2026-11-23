import './converter.css';
import { stagger } from 'motion';
import { DURATION, EASE, safeAnimate, animateThumb, prefersReducedMotion } from './core/motionTokens.js';
import {
  LIMITS,
  buildFFmpegArgs,
  convertVideo,
  convertImageBatch,
  terminateFFmpeg
} from './core/mediaEngine.js';

// --- DOM ELEMENTS ---
const modeQuickBtn = document.getElementById('mode-quick-btn');
const modeProBtn = document.getElementById('mode-pro-btn');
const modeThumb = document.getElementById('mode-thumb');
const modeControl = document.querySelector('.segmented-control');
const videoProControls = document.getElementById('video-pro-controls');

const typeTabs = document.querySelectorAll('.type-tab');
const videoSettingsPanel = document.getElementById('video-settings-panel');
const imageSettingsPanel = document.getElementById('image-settings-panel');

const dropzone = document.getElementById('media-dropzone');
const queuePanel = document.getElementById('queue-panel');
const queueList = document.getElementById('queue-list');
const queueCount = document.getElementById('queue-count');
const clearQueueBtn = document.getElementById('clear-queue-btn');

const videoPreviewCard = document.getElementById('video-preview-card');
const videoPlayer = document.getElementById('video-player');
const extractFrameBtn = document.getElementById('extract-frame-btn');

const burninTcEnable = document.getElementById('burnin-tc-enable');
const burninTcPos = document.getElementById('burnin-tc-pos');
const burninTitleText = document.getElementById('burnin-title-text');
const burninTcBadge = document.getElementById('burnin-tc-badge');
const burninTitleBadge = document.getElementById('burnin-title-badge');

const vidContainer = document.getElementById('vid-container');
const vidCodec = document.getElementById('vid-codec');
const vidCrf = document.getElementById('vid-crf');
const crfVal = document.getElementById('crf-val');
const vidFps = document.getElementById('vid-fps');
const vidScale = document.getElementById('vid-scale');
const vidAudio = document.getElementById('vid-audio');
const trimStart = document.getElementById('trim-start');
const trimEnd = document.getElementById('trim-end');

const startVideoBtn = document.getElementById('start-video-btn');
const cancelVideoBtn = document.getElementById('cancel-video-btn');
const progressWrap = document.getElementById('video-progress-wrap');
const progressLabel = document.getElementById('progress-label');
const progressPct = document.getElementById('progress-pct');
const progressFill = document.getElementById('progress-fill');

const imgFormat = document.getElementById('img-format');
const imgQuality = document.getElementById('img-quality');
const imgQualVal = document.getElementById('img-qual-val');
const imgMaxWidth = document.getElementById('img-max-width');
const imgBgColor = document.getElementById('img-bg-color');
const startImageBtn = document.getElementById('start-image-btn');

const limitModal = document.getElementById('limit-modal');
const limitModalDesc = document.getElementById('limit-modal-desc');
const limitFileDetails = document.getElementById('limit-file-details');
const closeLimitModal = document.getElementById('close-limit-modal');
const ackLimitBtn = document.getElementById('ack-limit-btn');

const showFfmpegBtn = document.getElementById('show-ffmpeg-btn');
const ffmpegCmdModal = document.getElementById('ffmpeg-cmd-modal');
const ffmpegCmdOutput = document.getElementById('ffmpeg-cmd-output');
const closeCmdModal = document.getElementById('close-cmd-modal');
const copyCmdBtn = document.getElementById('copy-cmd-btn');

const studioToast = document.getElementById('studio-toast');
const toastMessage = document.getElementById('toast-message');

// --- STATE ---
let queuedFiles = [];
let currentVideoUrl = null;
let toastTimer = null;

// --- HELPERS ---
function showToast(msg, isError = false) {
  if (!studioToast || !toastMessage) return;
  clearTimeout(toastTimer);
  toastMessage.textContent = msg;
  studioToast.classList.toggle('is-error', isError);
  studioToast.classList.remove('hidden');

  safeAnimate(
    studioToast,
    { opacity: [0, 1], transform: ['translate(-50%, -8px)', 'translate(-50%, 0px)'] },
    { duration: DURATION.fast }
  );

  toastTimer = setTimeout(() => {
    safeAnimate(studioToast, { opacity: [1, 0] }, { duration: DURATION.instant }).finished.then(() => {
      studioToast.classList.add('hidden');
    });
  }, 3400);
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

function showLimitPopup(file, maxMb, typeLabel) {
  const fileMb = (file.size / (1024 * 1024)).toFixed(1);
  limitModalDesc.textContent = `Because CC Media Studio runs 100% client-side in your browser (zero server upload), ${typeLabel} files are capped at ${maxMb} MB to keep your browser stable.`;

  limitFileDetails.innerHTML = '';
  const rows = [
    ['File', file.name],
    ['Detected Size', `${fileMb} MB (Max allowed: ${maxMb} MB)`]
  ];
  rows.forEach(([label, val], idx) => {
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    limitFileDetails.appendChild(strong);
    limitFileDetails.appendChild(document.createTextNode(val));
    if (idx < rows.length - 1) limitFileDetails.appendChild(document.createElement('br'));
  });

  openModalAnimated(limitModal);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function formatTimecode(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 25);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

// --- TOP NAV PILL BUBBLE ---
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

// --- MODE & TAB SWITCHERS ---
modeQuickBtn?.addEventListener('click', () => {
  modeQuickBtn.classList.add('active');
  modeQuickBtn.setAttribute('aria-selected', 'true');
  modeProBtn?.classList.remove('active');
  modeProBtn?.setAttribute('aria-selected', 'false');
  videoProControls?.classList.add('hidden');
  animateThumb(modeThumb, modeQuickBtn, modeControl, 3);
});

modeProBtn?.addEventListener('click', () => {
  modeProBtn.classList.add('active');
  modeProBtn.setAttribute('aria-selected', 'true');
  modeQuickBtn?.classList.remove('active');
  modeQuickBtn?.setAttribute('aria-selected', 'false');
  videoProControls?.classList.remove('hidden');
  animateThumb(modeThumb, modeProBtn, modeControl, 3);
});

function switchTab(tab) {
  typeTabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  videoSettingsPanel?.classList.toggle('hidden', tab !== 'video');
  imageSettingsPanel?.classList.toggle('hidden', tab !== 'image');
}

typeTabs.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// --- PRESETS & COMPATIBILITY GUARD ---
function syncCompatibility() {
  const c = vidContainer.value;
  if (c === 'webm') {
    vidCodec.value = 'libvpx';
  } else if (c === 'mp3' || c === 'wav') {
    vidCodec.value = 'none';
  } else if (c === 'mp4' || c === 'mov') {
    if (vidCodec.value === 'libvpx' || vidCodec.value === 'none') {
      vidCodec.value = 'libx264';
    }
  }
}

vidContainer?.addEventListener('change', syncCompatibility);
vidCrf?.addEventListener('input', () => { crfVal.textContent = vidCrf.value; });
imgQuality?.addEventListener('input', () => { imgQualVal.textContent = `${imgQuality.value}%`; });

document.querySelectorAll('#video-presets .preset-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('#video-presets .preset-card').forEach((c) => c.classList.remove('active'));
    card.classList.add('active');

    const p = card.dataset.preset;
    if (p === 'review') {
      vidContainer.value = 'mp4'; vidCodec.value = 'libx264'; vidCrf.value = '26'; vidScale.value = '1280:-2'; vidAudio.value = 'aac_128k';
    } else if (p === 'youtube') {
      vidContainer.value = 'mp4'; vidCodec.value = 'libx264'; vidCrf.value = '18'; vidScale.value = 'source'; vidAudio.value = 'aac_192k';
    } else if (p === 'social') {
      vidContainer.value = 'mp4'; vidCodec.value = 'libx264'; vidCrf.value = '22'; vidScale.value = '1080:1920'; vidAudio.value = 'aac_192k';
    } else if (p === 'gif') {
      vidContainer.value = 'gif'; vidCodec.value = 'libx264'; vidScale.value = 'source';
    } else if (p === 'audio') {
      vidContainer.value = 'mp3'; vidCodec.value = 'none';
    }
    crfVal.textContent = vidCrf.value;
  });
});

// --- LIVE BURN-IN OVERLAY ---
function updateBurnInOverlay() {
  const posClass = `pos-${burninTcPos.value}`;
  burninTcBadge.className = `burnin-badge mono ${posClass} ${burninTcEnable.checked ? '' : 'hidden'}`;

  const title = burninTitleText.value.trim();
  if (title) {
    burninTitleBadge.textContent = title;
    burninTitleBadge.className = 'burnin-badge pos-top-left';
  } else {
    burninTitleBadge.classList.add('hidden');
  }
}

burninTcEnable?.addEventListener('change', updateBurnInOverlay);
burninTcPos?.addEventListener('change', updateBurnInOverlay);
burninTitleText?.addEventListener('input', updateBurnInOverlay);

videoPlayer?.addEventListener('timeupdate', () => {
  if (burninTcEnable?.checked) {
    burninTcBadge.textContent = formatTimecode(videoPlayer.currentTime);
  }
});

// --- EXTRACT FRAME PNG ---
extractFrameBtn?.addEventListener('click', () => {
  if (!videoPlayer.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = videoPlayer.videoWidth;
  canvas.height = videoPlayer.videoHeight;
  canvas.getContext('2d').drawImage(videoPlayer, 0, 0);
  canvas.toBlob((blob) => {
    if (blob) {
      triggerDownload(blob, `frame_${Math.floor(videoPlayer.currentTime)}s.png`);
      showToast('Frame extracted as PNG');
    }
  }, 'image/png');
});

// --- FILE INGESTION & SIZE LIMIT CHECK ---
function handleFiles(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;

  const first = files[0];
  const isVideo = first.type.startsWith('video/') || first.type.startsWith('audio/') || /\.(mp4|mov|mkv|avi|webm|mxf)$/i.test(first.name);
  const isImage = first.type.startsWith('image/') || /\.(png|jpe?g|webp|avif|gif|bmp)$/i.test(first.name);

  if (isVideo) {
    if (first.size > LIMITS.VIDEO_MAX_BYTES) {
      showLimitPopup(first, LIMITS.VIDEO_MAX_MB, 'video');
      return;
    }
    switchTab('video');
    queuedFiles = [first];
    loadVideoPreview(first);
    renderQueue();
    startVideoBtn.disabled = false;
  } else if (isImage) {
    const validImages = [];
    for (const f of files.slice(0, LIMITS.MAX_BATCH_IMAGES)) {
      if (f.size > LIMITS.IMAGE_MAX_BYTES) {
        showLimitPopup(f, LIMITS.IMAGE_MAX_MB, 'image');
        return;
      }
      validImages.push(f);
    }
    switchTab('image');
    queuedFiles = validImages;
    videoPreviewCard.classList.add('hidden');
    renderQueue();
    startImageBtn.disabled = false;
  } else {
    showToast('Unsupported file type.', true);
  }
}

function loadVideoPreview(file) {
  if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
  currentVideoUrl = URL.createObjectURL(file);
  videoPlayer.src = currentVideoUrl;
  videoPreviewCard.classList.remove('hidden');

  document.getElementById('meta-size').textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  videoPlayer.onloadedmetadata = () => {
    document.getElementById('meta-resolution').textContent = `${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
    document.getElementById('meta-duration').textContent = `${videoPlayer.duration.toFixed(1)}s`;
  };
}

function renderQueue() {
  queueCount.textContent = String(queuedFiles.length);
  queueList.innerHTML = '';
  queuedFiles.forEach((f) => {
    const li = document.createElement('li');
    li.className = 'queue-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'queue-item-name';
    nameSpan.textContent = f.name;

    const metaSpan = document.createElement('span');
    metaSpan.className = 'queue-item-meta mono';
    metaSpan.textContent = `${(f.size / (1024 * 1024)).toFixed(2)} MB`;

    li.appendChild(nameSpan);
    li.appendChild(metaSpan);
    queueList.appendChild(li);
  });
  queuePanel.classList.toggle('hidden', queuedFiles.length === 0);
}

clearQueueBtn?.addEventListener('click', () => {
  queuedFiles = [];
  renderQueue();
  videoPreviewCard.classList.add('hidden');
  startVideoBtn.disabled = true;
  startImageBtn.disabled = true;
});

const openFilePicker = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'video/*,audio/*,image/*,.mkv,.mov,.mxf';
  input.onchange = (e) => handleFiles(e.target.files);
  input.click();
};

dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone?.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});
dropzone?.addEventListener('click', openFilePicker);
dropzone?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openFilePicker();
  }
});

function getVideoOpts() {
  return {
    container: vidContainer.value,
    codec: vidCodec.value,
    crf: vidCrf.value,
    fps: vidFps.value,
    scale: vidScale.value,
    audio: vidAudio.value,
    trimStart: trimStart.value.trim(),
    trimEnd: trimEnd.value.trim()
  };
}

startVideoBtn?.addEventListener('click', async () => {
  if (!queuedFiles.length) return;
  const file = queuedFiles[0];
  const opts = getVideoOpts();

  startVideoBtn.disabled = true;
  cancelVideoBtn.classList.remove('hidden');
  progressWrap.classList.remove('hidden');
  progressLabel.textContent = 'Loading FFmpeg WASM...';
  progressPct.textContent = '0%';
  progressFill.style.width = '0%';

  try {
    const res = await convertVideo(file, opts, (pct) => {
      progressLabel.textContent = 'Encoding locally...';
      progressPct.textContent = `${pct}%`;
      progressFill.style.width = `${pct}%`;
    });

    progressPct.textContent = '100%';
    progressFill.style.width = '100%';
    triggerDownload(res.blob, res.filename);
    showToast(`Exported ${res.filename}`);
  } catch (err) {
    console.error(err);
    showToast('Conversion cancelled or failed.', true);
  } finally {
    startVideoBtn.disabled = false;
    cancelVideoBtn.classList.add('hidden');
  }
});

cancelVideoBtn?.addEventListener('click', () => {
  terminateFFmpeg();
  progressWrap.classList.add('hidden');
  cancelVideoBtn.classList.add('hidden');
  startVideoBtn.disabled = false;
  showToast('Conversion cancelled.');
});

startImageBtn?.addEventListener('click', async () => {
  if (!queuedFiles.length) return;
  startImageBtn.disabled = true;

  try {
    const res = await convertImageBatch(queuedFiles, {
      format: imgFormat.value,
      quality: parseInt(imgQuality.value, 10),
      maxWidth: parseInt(imgMaxWidth.value, 10) || null,
      bgColor: imgBgColor.value
    });
    triggerDownload(res.blob, res.filename);
    showToast(`Downloaded ${res.filename}`);
  } catch (err) {
    showToast(err.message || 'Image conversion failed.', true);
  } finally {
    startImageBtn.disabled = false;
  }
});

// --- MODALS ---
closeLimitModal?.addEventListener('click', () => closeModalAnimated(limitModal));
ackLimitBtn?.addEventListener('click', () => closeModalAnimated(limitModal));

showFfmpegBtn?.addEventListener('click', () => {
  const inputName = queuedFiles[0]?.name || 'input.mp4';
  const opts = getVideoOpts();
  const args = buildFFmpegArgs(inputName, `output.${opts.container}`, opts);
  ffmpegCmdOutput.textContent = `ffmpeg ${args.join(' ')}`;
  openModalAnimated(ffmpegCmdModal);
});

closeCmdModal?.addEventListener('click', () => closeModalAnimated(ffmpegCmdModal));
copyCmdBtn?.addEventListener('click', () => {
  navigator.clipboard.writeText(ffmpegCmdOutput.textContent);
  showToast('FFmpeg command copied to clipboard');
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

window.addEventListener('DOMContentLoaded', () => {
  animateThumb(modeThumb, modeQuickBtn, modeControl, 3);
  if (!prefersReducedMotion()) {
    const items = document.querySelectorAll('.hero-animate');
    if (items.length) {
      safeAnimate(
        items,
        { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'] },
        { duration: DURATION.enter, delay: stagger(0.06), easing: EASE.out }
      );
    }
  }
});