/**
 * AEP Downgrader - Motore Definitivo (Ibrido Strutturale SENZA Corruzione Chunk)
 * @param {File} file 
 * @param {string} targetVersion - Es. "24" o "23"
 */
export async function downgradeAfterEffects(file, targetVersion = "24") {
    const isXml = file.name.toLowerCase().endsWith('.aepx');

    if (isXml) {
        return await downgradeAepx(file, targetVersion);
    } else {
        return await downgradeAepBinary(file, targetVersion);
    }
}

// ── Gestione file .aepx (XML) ──
async function downgradeAepx(file, targetVersion) {
    const text = await file.text();
    const xmlTarget = targetVersion.includes('.') ? targetVersion : `${targetVersion}.0`;
    const modifiedText = text.replace(
        /(AppVersion=")\d+\.\d+(")/g,
        `$1${xmlTarget}$2`
    );
    
    const blob = new Blob([modifiedText], { type: 'text/xml' });
    const filename = file.name.replace(/\.aepx$/i, '_downgraded.aepx');
    return { blob, filename };
}

// ── Gestione file .aep (Binario RIFX Patcher) ──
async function downgradeAepBinary(file, targetVersion) {
    const buffer = await file.arrayBuffer();
    const v = new DataView(buffer);
    const b = new Uint8Array(buffer);
    const n = buffer.byteLength;

    if (n < 12) throw new Error('File troppo piccolo per essere un progetto AE valido.');

    const _t = (arr, off) => {
        if (off + 4 > arr.length) return '';
        return String.fromCharCode(arr[off], arr[off+1], arr[off+2], arr[off+3]);
    };

    const magic = _t(b, 0);
    if (magic !== 'RIFX' && magic !== 'RIFF') {
        throw new Error('Non è un file AEP valido.');
    }
    const le = magic === 'RIFF';

    // Firme di versione stabili (es. 24.x, 23.x)
    const signatures = {
        "24": [0x5f, 0x05, 0x0f, 0x02, 0x86, 0x34], // AE 2024
        "23": [0x5e, 0x09, 0x0b, 0x3b, 0x06, 0x37]  // AE 2023
    };
    
    const targetSig = signatures[targetVersion] || signatures["24"];
    const headPositions = [1, 3, 4, 5, 6, 7];

    const _O = new Set(['btdk']);

    // Cloniamo il buffer per applicare le modifiche senza alterare la struttura dei chunk
    const outBuffer = buffer.slice(0);
    const outU8 = new Uint8Array(outBuffer);

    // Navigazione e patch dell'albero RIFX
    const walk = (o, end) => {
        while (o + 8 <= end) {
            const tg = _t(b, o);
            const sz = v.getUint32(o + 4, le);
            const ds = o + 8;
            const de = ds + sz;
            const pd = sz & 1;

            if (de > n) break;

            // Patch delle posizioni esatte della firma nel chunk "head"
            if (tg === 'head') {
                for (let i = 0; i < headPositions.length; i++) {
                    const targetOffset = ds + headPositions[i];
                    if (targetOffset < n) {
                        outU8[targetOffset] = targetSig[i];
                    }
                }
            }

            // Esplorazione ricorsiva nei nodi lista preservando le dimensioni dei chunk
            if ((tg === 'LIST' || tg === 'RIFX') && !_O.has(_t(b, ds))) {
                walk(ds + 4, de);
            }

            if (de > end) break;
            o = de + pd;
        }
    };

    // Avvio scansione dal root del file
    walk(0, Math.min(8 + v.getUint32(4, le), n));

    const blob = new Blob([outBuffer], { type: 'application/octet-stream' });
    const filename = file.name.replace(/\.aep$/i, `_downgraded_v${targetVersion}.aep`);
    return { blob, filename };
}