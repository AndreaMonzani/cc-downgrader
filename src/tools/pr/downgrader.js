import * as pako from 'pako';

/**
 * Effettua il downgrade di un file .prproj (Premiere Pro)
 * @param {File} file 
 * @param {string} targetVersion - Default "1" (auto-migrazione universale)
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
export async function downgradePremierePro(file, targetVersion = "1") {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    try {
        // Decompressione GZIP dell'XML di Premiere
        const unzippedData = pako.ungzip(uint8Array, { to: 'string' });
        
        const parser = new DOMParser();
        const dom = parser.parseFromString(unzippedData, 'text/xml');
        
        // Patch dell'attributo Version nel tag Project
        const projectNodes = dom.getElementsByTagName('Project');
        for (let node of projectNodes) {
            if (node.getAttribute('Version')) {
                node.setAttribute('Version', targetVersion);
            }
        }
        
        const serializer = new XMLSerializer();
        const modifiedXmlString = serializer.serializeToString(dom);
        
        // Ricompressione GZIP
        const compressedBytes = pako.gzip(modifiedXmlString);
        
        const blob = new Blob([compressedBytes], { type: 'application/octet-stream' });
        const filename = file.name.replace(/\.prproj$/i, `_downgraded_v${targetVersion}.prproj`);
        
        return { blob, filename };
        
    } catch (error) {
        throw new Error("Errore durante la lettura del file .prproj. Assicurati che sia un file di Premiere valido.");
    }
}