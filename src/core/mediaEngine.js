import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import JSZip from 'jszip';

export const LIMITS = {
  VIDEO_MAX_MB: 150,
  VIDEO_MAX_BYTES: 150 * 1024 * 1024,
  IMAGE_MAX_MB: 35,
  IMAGE_MAX_BYTES: 35 * 1024 * 1024,
  MAX_BATCH_IMAGES: 30
};

let ffmpegInstance = null;
let ffmpegLoaded = false;

/**
 * Loads single-threaded FFmpeg WASM (no COOP/COEP headers required, AdSense safe).
 */
export async function loadFFmpeg(onProgress) {
  if (ffmpegLoaded && ffmpegInstance) return ffmpegInstance;

  ffmpegInstance = new FFmpeg();
  if (onProgress) {
    ffmpegInstance.on('progress', ({ progress }) => {
      onProgress(Math.min(99, Math.round(progress * 100)));
    });
  }

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpegInstance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
  });

  ffmpegLoaded = true;
  return ffmpegInstance;
}

export function terminateFFmpeg() {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
    ffmpegLoaded = false;
  }
}

/**
 * Builds the FFmpeg CLI arguments array based on UI settings.
 */
export function buildFFmpegArgs(inputName, outputName, opts) {
  const args = [];

  if (opts.trimStart) args.push('-ss', opts.trimStart);
  args.push('-i', inputName);
  if (opts.trimEnd) args.push('-to', opts.trimEnd);

  // Audio-only formats
  if (opts.container === 'mp3' || opts.container === 'wav' || opts.codec === 'none') {
    args.push('-vn');
    if (opts.container === 'mp3') {
      args.push('-c:a', 'libmp3lame', '-b:a', '192k');
    } else if (opts.container === 'wav') {
      args.push('-c:a', 'pcm_s16le');
    }
    args.push(outputName);
    return args;
  }

  // GIF preset
  if (opts.container === 'gif') {
    args.push('-vf', 'fps=15,scale=480:-1:flags=lanczos', outputName);
    return args;
  }

  // Video Codec
  if (opts.codec === 'copy') {
    args.push('-c:v', 'copy');
  } else if (opts.container === 'webm') {
    args.push('-c:v', 'libvpx', '-crf', String(opts.crf || 28), '-b:v', '0');
  } else {
    args.push('-c:v', 'libx264', '-crf', String(opts.crf || 23), '-preset', 'veryfast', '-pix_fmt', 'yuv420p');
  }

  // Video Filters (Scale / Crop)
  const filters = [];
  if (opts.scale && opts.scale !== 'source' && opts.codec !== 'copy') {
    if (opts.scale === '1080:1920' || opts.scale === '1080:1080') {
      const [w, h] = opts.scale.split(':');
      filters.push(`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`);
    } else {
      filters.push(`scale=${opts.scale}`);
    }
  }

  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  // Frame rate
  if (opts.fps && opts.fps !== 'source' && opts.codec !== 'copy') {
    args.push('-r', String(opts.fps));
  }

  // Audio
  if (opts.audio === 'mute') {
    args.push('-an');
  } else if (opts.container === 'webm') {
    args.push('-c:a', 'libvorbis');
  } else {
    const bitrate = opts.audio === 'aac_128k' ? '128k' : '192k';
    args.push('-c:a', 'aac', '-b:a', bitrate);
  }

  if (opts.container === 'mp4') {
    args.push('-movflags', '+faststart');
  }

  args.push(outputName);
  return args;
}

/**
 * Executes video conversion inside browser memory.
 */
export async function convertVideo(file, opts, onProgress) {
  const ffmpeg = await loadFFmpeg(onProgress);
  const ext = file.name.split('.').pop().toLowerCase();
  const inputName = `input.${ext}`;
  const outputName = `output.${opts.container}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  const args = buildFFmpegArgs(inputName, outputName, opts);
  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  const mimeMap = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    gif: 'image/gif',
    mp3: 'audio/mpeg',
    wav: 'audio/wav'
  };

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  return {
    blob: new Blob([data.buffer], { type: mimeMap[opts.container] || 'application/octet-stream' }),
    filename: `${baseName}_converted.${opts.container}`
  };
}

/**
 * Converts a single image using native HTML5 Canvas.
 */
export function convertSingleImage(file, { format, quality, maxWidth, bgColor }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let targetW = img.naturalWidth;
      let targetH = img.naturalHeight;

      if (maxWidth && targetW > maxWidth) {
        const ratio = maxWidth / targetW;
        targetW = maxWidth;
        targetH = Math.round(targetH * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      if (format === 'image/jpeg') {
        ctx.fillStyle = bgColor || '#000000';
        ctx.fillRect(0, 0, targetW, targetH);
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error(`Failed to encode ${file.name}`));
          const extMap = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          resolve({
            blob,
            filename: `${baseName}.${extMap[format] || 'png'}`
          });
        },
        format,
        quality / 100
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Cannot decode image: ${file.name}`));
    };

    img.src = url;
  });
}

/**
 * Batch converts images and bundles into a ZIP if > 1 file.
 */
export async function convertImageBatch(files, opts) {
  if (files.length === 1) {
    return await convertSingleImage(files[0], opts);
  }

  const zip = new JSZip();
  for (const file of files) {
    const res = await convertSingleImage(file, opts);
    zip.file(res.filename, res.blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return {
    blob: zipBlob,
    filename: `converted_images_${Date.now()}.zip`
  };
}