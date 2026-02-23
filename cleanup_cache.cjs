
const fs = require('fs');
const path = require('path');

const CACHE_DIR = 'd:\\mywork\\lan-media-gateway\\cache\\hls';

async function cleanup() {
    if (!fs.existsSync(CACHE_DIR)) {
        console.log('Cache directory not found');
        return;
    }

    const dirs = fs.readdirSync(CACHE_DIR);
    console.log(`Checking ${dirs.length} cache directories...`);

    let deleted = 0;
    let preserved = 0;

    for (const dir of dirs) {
        const fullPath = path.join(CACHE_DIR, dir);
        if (!fs.statSync(fullPath).isDirectory()) continue;

        const playlistPath = path.join(fullPath, 'playlist.m3u8');
        let isComplete = false;

        if (fs.existsSync(playlistPath)) {
            const content = fs.readFileSync(playlistPath, 'utf8');
            if (content.includes('#EXT-X-ENDLIST')) {
                isComplete = true;
            }
        }

        if (!isComplete) {
            console.log(`Deleting incomplete cache: ${dir}`);
            fs.rmSync(fullPath, { recursive: true, force: true });
            deleted++;
        } else {
            console.log(`Preserving complete cache: ${dir}`);
            preserved++;
        }
    }

    console.log(`--- Cleanup Finished ---`);
    console.log(`Deleted: ${deleted}`);
    console.log(`Preserved: ${preserved}`);
}

cleanup().catch(console.error);
