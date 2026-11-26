'use strict';
// Beem-Net on iDrive 8: the built app (tools/build_store.py --keep-stage <dir>) through the kit's stubbed head unit
// on a 2880 x 960 renderer that routes touch, with no backend running. Checks that the app starts on the kit that
// knows iDrive 8, where its page is placed (the area under BMW's status bar, over the climate bar: the browser's
// 1600 x 520 page scaled to the height and centred), that the whole area is claimed for touch, and that a frame
// is drawn without the backend.
//   node test/id8/layout_smoke.js <dir>
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const keep = path.resolve(process.argv[2] || '');
const stage = path.join(keep, 'dist', 'mgu_browser');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beemnet-'));
    process.env.MGU_RENDERD_FILE = path.join(dir, 'stream.bin');
    process.env.MGU_BROWSER_SOCKET = path.join(dir, 'no-backend.sock');
    const errors = [];
    const log = { info() {}, warn() {}, debug() {}, error(m, e) { errors.push(String(m) + ' ' + (e && e.stack || e || '')); } };
    const { headUnit } = require(path.join(keep, 'kit', 'tools', 'hu-stub.js'));
    const hu = headUnit(stage, { dataDir: dir, fresh: true, image: () => Promise.resolve(), log });
    const disp = hu.display;
    process.on('unhandledRejection', (e) => errors.push('unhandled: ' + (e && e.stack || e)));
    hu.start();
    await sleep(300);
    for (const id7 of [false, true]) {
        disp.gpu.screen = id7 ? { w: 1920, h: 720 } : { w: 2880, h: 960 };
        disp.gpu.ready = true; disp.gpu.native = true; disp.gpu.touch = true;
        disp._place();
        if (hu.ui.open) await hu.ui.open('MAIN');
        await hu.loopFn();
        await sleep(100);
        await hu.loopFn();
        const pl = disp.place;
        if (!id7) {
            assert.deepStrictEqual([pl.x, pl.y, pl.w, pl.h, pl.full], [0, 76, 2880, 764, true], 'the app area: ' + JSON.stringify(pl));
            assert.strictEqual(pl.oy, 0, 'no strip kept free at the top on iDrive 8');
            assert.ok(Math.abs(pl.scale - 764 / 520) < 0.002, 'scaled to the height: ' + pl.scale);
            assert.ok(Math.abs(pl.ox - (2880 - 1600 * pl.scale) / 2) <= 1 && pl.extra === 0, 'centred, nothing below: ' + JSON.stringify(pl));
            const c = JSON.parse(disp.gpu.claimed || '[]').map((q) => [q.x * pl.scale + pl.ox, q.y * pl.scale + pl.oy, q.w * pl.scale, q.h * pl.scale].map(Math.round));
            assert.ok(c.length === 1 && c[0][0] === 0 && c[0][1] === 0 && c[0][2] === 2880 && c[0][3] === 764, 'the whole area is the app\'s for touch: ' + JSON.stringify(c));
        } else {
            assert.ok(pl.full && pl.oy === 80 && Math.abs(pl.scale - 1.2) < 0.001 && pl.ox === 0, 'iDrive 7 as upstream has it: ' + JSON.stringify(pl));
        }
        console.log('ok   ' + (id7 ? 'iDrive 7' : 'iDrive 8') + ' placement ' + JSON.stringify({ x: pl.x, y: pl.y, w: pl.w, h: pl.h, scale: pl.scale, ox: pl.ox, oy: pl.oy, extra: pl.extra }));
    }
    assert.deepStrictEqual(errors, [], 'no error logged');
    console.log('ok   the app starts and draws without its backend, nothing logged as an error');
    process.exit(0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
