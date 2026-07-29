import { downgradeAfterEffects } from '../tools/aep/downgrader.js';
import { downgradePremierePro } from '../tools/pr/downgrader.js';

export async function processFile(file, options = {}) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.aep') || fileName.endsWith('.aepx')) {
        const targetVersion = options.aeVersion || "24";
        return await downgradeAfterEffects(file, targetVersion);
    } 
    else if (fileName.endsWith('.prproj')) {
        const targetVersion = options.prVersion || "1";
        return await downgradePremierePro(file, targetVersion);
    } 
    else {
        throw new Error("Formato file non supportato. Seleziona un file .aep, .aepx o .prproj.");
    }
}