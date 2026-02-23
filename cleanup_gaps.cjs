const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache', 'hls');

if (!fs.existsSync(CACHE_DIR)) {
    console.log('Cache directory not found');
    process.exit(0);
}

const dirs = fs.readdirSync(CACHE_DIR);
let deleted = 0, preserved = 0;

for (const dir of dirs) {
    const fullPath = path.join(CACHE_DIR, dir);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    const playlistPath = path.join(fullPath, 'playlist.m3u8');
    if (!fs.existsSync(playlistPath)) {
        console.log(`Deleting (no playlist): ${dir.substring(0, 40)}...`);
        fs.rmSync(fullPath, { recursive: true, force: true });
        deleted++;
        continue;
    }

    const content = fs.readFileSync(playlistPath, 'utf8');
    const hasEndList = content.includes('#EXT-X-ENDLIST');
    const hasDiscontinuity = content.includes('#EXT-X-DISCONTINUITY');

    if (hasDiscontinuity) {
        console.log(`Deleting (has gaps/DISCONTINUITY): ${dir.substring(0, 40)}...`);
        fs.rmSync(fullPath, { recursive: true, force: true });
        deleted++;
    } else if (!hasEndList) {
        console.log(`Deleting (incomplete, no ENDLIST): ${dir.substring(0, 40)}...`);
        fs.rmSync(fullPath, { recursive: true, force: true });
        deleted++;
    } else {
        preserved++;
    }
}

console.log(`\n--- Cleanup Finished ---`);
console.log(`Deleted: ${deleted} (gapped or incomplete)`);
console.log(`Preserved: ${preserved} (complete and valid)`);
