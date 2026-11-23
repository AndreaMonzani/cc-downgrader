/**
 * CC Downgrader Core Patching Engine
 * 100% Client-Side Stream & Binary Header Patcher
 * Supports Premiere Pro (.prproj) up to CC 2027 (Schema v45)
 * and After Effects (.aep / .aepx) up to CC 2027 (v27.x).
 */

const PR_SCHEMA_MAP = {
  45: 'Premiere Pro 2027 (v27.x)',
  44: 'Premiere Pro 2026 (v26.x)',
  43: 'Premiere Pro 2025 (v25.x)',
  42: 'Premiere Pro 2024 (v24.x)',
  41: 'Premiere Pro 2023 (v23.x)',
  40: 'Premiere Pro 2022 (v22.x)',
  39: 'Premiere Pro 2021 (v15.x)',
  38: 'Premiere Pro 2020 (v14.x)',
  1: 'Universal Legacy Compatible'
};

function readFourCC(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function findAepHeadChunk(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 36) {
    throw new Error('Invalid or truncated After Effects file.');
  }

  const riffTag = readFourCC(view, 0);
  const formTag = readFourCC(view, 8);
  if (riffTag !== 'RIFX' || formTag !== 'Egg!') {
    throw new Error('Unrecognized .aep container signature (expected RIFX Egg!).');
  }

  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const chunkId = readFourCC(view, offset);
    const chunkSize = view.getUint32(offset + 4, false); // Big-Endian
    const payloadOffset = offset + 8;

    if (chunkId === 'head' && payloadOffset + 8 <= buffer.byteLength) {
      return { view, payloadOffset, chunkSize };
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    offset = payloadOffset + paddedSize;
  }

  throw new Error('Could not locate After Effects "head" version chunk.');
}

async function readPrprojXml(file) {
  const headerSlice = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const isGzip = headerSlice[0] === 0x1f && headerSlice[1] === 0x8b;

  if (isGzip) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Your browser does not support native GZIP DecompressionStream.');
    }
    const ds = new DecompressionStream('gzip');
    const decompressedStream = file.stream().pipeThrough(ds);
    return await new Response(decompressedStream).text();
  }

  return await file.text();
}

async function compressToGzipBlob(xmlString) {
  if (typeof CompressionStream === 'undefined') {
    return new Blob([xmlString], { type: 'application/octet-stream' });
  }
  const encoder = new TextEncoder();
  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(xmlString));
      controller.close();
    }
  });
  const cs = new CompressionStream('gzip');
  const compressedStream = inputStream.pipeThrough(cs);
  const buffer = await new Response(compressedStream).arrayBuffer();
  return new Blob([buffer], { type: 'application/octet-stream' });
}

/**
 * Inspects project metadata and source version without modifying the file.
 */
export async function inspectFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'prproj') {
    const xml = await readPrprojXml(file);
    const projectTagMatch =
      xml.match(/<Project\b[^>]*ClassID="62ad66dd-0dcd-42da-a660-6d8fbde94876"[^>]*>/i) ||
      xml.match(/<Project\b[^>]*\bVersion="(\d+)"[^>]*>/i);

    let schemaNum = null;
    if (projectTagMatch) {
      const verMatch = projectTagMatch[0].match(/\bVersion="(\d+)"/i);
      if (verMatch) schemaNum = parseInt(verMatch[1], 10);
    }

    const label = schemaNum && PR_SCHEMA_MAP[schemaNum]
      ? PR_SCHEMA_MAP[schemaNum]
      : schemaNum
        ? `Premiere Pro (Schema v${schemaNum})`
        : 'Premiere Pro Project';

    return {
      type: 'pr',
      ext,
      detectedVersionLabel: schemaNum ? `Schema v${schemaNum}` : 'PRPROJ',
      detectedFullLabel: label
    };
  }

  if (ext === 'aep') {
    const buffer = await file.arrayBuffer();
    const { view, payloadOffset } = findAepHeadChunk(buffer);
    const b0 = view.getUint8(payloadOffset + 4);
    const b1 = view.getUint8(payloadOffset + 5);
    const major = b0 >> 1;
    const minor = ((b0 & 0x01) << 3) | (b1 >> 5);

    return {
      type: 'ae',
      ext,
      detectedVersionLabel: `v${major}.${minor}`,
      detectedFullLabel: `After Effects 20${major} (v${major}.${minor})`
    };
  }

  if (ext === 'aepx') {
    const xml = await file.text();
    const majorMatch = xml.match(/\bmajorVersion="(\d+)"/i);
    const minorMatch = xml.match(/\bminorVersion="(\d+)"/i);
    const major = majorMatch ? majorMatch[1] : '?';
    const minor = minorMatch ? minorMatch[1] : '0';

    return {
      type: 'ae',
      ext,
      detectedVersionLabel: `v${major}.${minor}`,
      detectedFullLabel: `After Effects XML 20${major} (v${major}.${minor})`
    };
  }

  throw new Error('Unsupported file format. Please select .prproj, .aep, or .aepx.');
}

/**
 * Patches Premiere Pro or After Effects project file to the requested target version.
 */
export async function processFile(file, { aeVersion = '24', prVersion = '1' } = {}) {
  const ext = file.name.split('.').pop().toLowerCase();
  const lastDotIdx = file.name.lastIndexOf('.');
  const baseName = lastDotIdx !== -1 ? file.name.substring(0, lastDotIdx) : file.name;
  const originalExt = lastDotIdx !== -1 ? file.name.substring(lastDotIdx) : `.${ext}`;

  if (ext === 'prproj') {
    const targetSchema = String(prVersion || '1');
    const xml = await readPrprojXml(file);

    const specificProjectRegex = /(<Project\b[^>]*ClassID="62ad66dd-0dcd-42da-a660-6d8fbde94876"[^>]*\bVersion=")(\d+)("[^>]*>)/i;
    const genericProjectRegex = /(<Project\b[^>]*\bVersion=")(\d+)("[^>]*>)/i;

    let patchedXml = xml;
    let sourceVersion = 'Unknown';

    if (specificProjectRegex.test(xml)) {
      patchedXml = xml.replace(specificProjectRegex, (_, prefix, oldVer, suffix) => {
        sourceVersion = `Schema v${oldVer}`;
        return `${prefix}${targetSchema}${suffix}`;
      });
    } else if (genericProjectRegex.test(xml)) {
      patchedXml = xml.replace(genericProjectRegex, (_, prefix, oldVer, suffix) => {
        sourceVersion = `Schema v${oldVer}`;
        return `${prefix}${targetSchema}${suffix}`;
      });
    } else {
      throw new Error('Could not locate Premiere Pro <Project> version attribute.');
    }

    const blob = await compressToGzipBlob(patchedXml);
    const targetLabel = targetSchema === '1' ? 'Legacy (v1)' : `Schema v${targetSchema}`;

    return {
      blob,
      filename: `${baseName}_downgraded${originalExt}`,
      sourceVersion,
      targetVersion: targetLabel
    };
  }

  if (ext === 'aep') {
    const targetMajor = parseInt(aeVersion || '24', 10);
    const buffer = await file.arrayBuffer();
    const { view, payloadOffset } = findAepHeadChunk(buffer);

    const b0 = view.getUint8(payloadOffset + 4);
    const b1 = view.getUint8(payloadOffset + 5);
    const oldMajor = b0 >> 1;
    const oldMinor = ((b0 & 0x01) << 3) | (b1 >> 5);

    view.setUint8(payloadOffset + 4, (targetMajor & 0x7f) << 1);
    view.setUint8(payloadOffset + 5, 0x00);

    const blob = new Blob([buffer], { type: 'application/octet-stream' });

    return {
      blob,
      filename: `${baseName}_AE20${targetMajor}${originalExt}`,
      sourceVersion: `v${oldMajor}.${oldMinor}`,
      targetVersion: `v${targetMajor}.0`
    };
  }

  if (ext === 'aepx') {
    const targetMajor = String(aeVersion || '24');
    const xml = await file.text();
    const oldMajorMatch = xml.match(/\bmajorVersion="(\d+)"/i);
    const sourceVersion = oldMajorMatch ? `v${oldMajorMatch[1]}.x` : 'XML';

    const patchedXml = xml
      .replace(/\bmajorVersion="\d+"/i, `majorVersion="${targetMajor}"`)
      .replace(/\bminorVersion="\d+"/i, 'minorVersion="0"')
      .replace(/\bbugVersion="\d+"/i, 'bugVersion="0"');

    const blob = new Blob([patchedXml], { type: 'application/xml' });

    return {
      blob,
      filename: `${baseName}_AE20${targetMajor}${originalExt}`,
      sourceVersion,
      targetVersion: `v${targetMajor}.0`
    };
  }

  throw new Error('Unsupported file extension.');
}