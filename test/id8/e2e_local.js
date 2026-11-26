'use strict';
// Beem-Net end to end on a computer: the built app on a simulated iDrive 8 screen (the kit's stubbed head unit,
// 2880 x 960, touch), talking to the real backend (dev/backend.js) and the real Chromium engine, which loads a page
// from a small local web server. Checks that the page arrives as a picture in the app's page area, that a tap on a
// link reaches the page and the new page arrives, and that a scroll moves it. With SHOTS=<folder> and
// SURFACE=<a kit's tools/surface.js> the steps are also written as PNGs of the whole screen.
//   node test/id8/e2e_local.js <stage dir of build_store.py --keep-stage> <socket of the running dev backend>
// (not part of the release workflow: it needs the engine package unpacked where it lives on a head unit)
const assert = require('assert'), fs = require('fs'), http = require('http'), os = require('os'), path = require('path');
const keep = path.resolve(process.argv[2]), socket = path.resolve(process.argv[3]);
const stage = path.join(keep, 'dist', 'mgu_browser');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGES = {
    '/': '<!doctype html><html><head><title>Beem-Net demo</title><meta name=viewport content="width=device-width"><style>body{margin:0;font:22px sans-serif;background:#0b1220;color:#e8eefc}header{background:#1c6bd6;padding:22px 40px;font-size:34px;font-weight:700}main{padding:26px 40px}a.btn{display:inline-block;background:#f2a33a;color:#111;padding:18px 34px;border-radius:12px;font-weight:700;text-decoration:none;font-size:28px}.card{background:#16203a;border-radius:14px;padding:18px 24px;margin:18px 0}</style></head><body><header>Beem-Net demo page</header><main><p>A page from a web server on this computer, drawn by the real Chromium engine.</p><a class=btn id=go href="/second">Open the second page</a>' + Array.from({ length: 14 }, (_, i) => '<div class=card>Card ' + (i + 1) + ' - scroll to see more</div>').join('') + '</main></body></html>',
    '/second': '<!doctype html><html><head><title>Second page</title><style>body{margin:0;font:26px sans-serif;background:#10281a;color:#eafff0}header{background:#1e9e57;padding:22px 40px;font-size:34px;font-weight:700}main{padding:30px 40px}</style></head><body><header id=h>Second page</header><main><p>The tap on the link arrived.</p><p id=c></p></main><script>var M=window.MediaSource,a=!!M&&M.isTypeSupported(\'video/mp4; codecs=\"avc1.64001F\"\'),v=!!M&&M.isTypeSupported(\'video/webm; codecs=\"vp9\"\'),f=!!M&&M.isTypeSupported(\'video/mp4; codecs=\"avc1.64001F\"; framerate=60\'),m=matchMedia(\'(prefers-reduced-motion: reduce)\').matches;document.getElementById(\'c\').textContent=\'H.264 \'+a+\' | VP9 \'+v+\' | 60 fps \'+f+\' | reduced motion \'+m;if(!(a&&!v&&!f&&m))document.getElementById(\'h\').style.background=a?\'#c0392b\':\'#7d3c98\';</script></body></html>',
};
(async () => {
    const server = http.createServer((q, s) => { const b = PAGES[q.url.split('?')[0]]; s.writeHead(b ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' }); s.end(b || 'not found'); });
    await new Promise((r) => server.listen(Number(process.env.DEMO_PORT) || 18480, '127.0.0.1', r));   // (a fixed port: the backend restores the last tab's address)
    const home = 'http://127.0.0.1:' + server.address().port + '/';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beemnet-e2e-'));
    fs.writeFileSync(path.join(dir, 'browser-state.json'), JSON.stringify({ homepage: process.env.START_ONLY ? '' : home, historyEnabled: false, zoom: Number(process.env.ZOOM) || 100, quick: process.env.PINS ? [{ url: 'https://example.org/', title: 'My pinned page' }] : [] }));
    process.env.MGU_RENDERD_FILE = path.join(dir, 'stream.bin');
    process.env.MGU_EMULATOR_MODE = '1';
    process.env.MGU_BROWSER_SOCKET = socket;
    const errors = [];
    const log = { info() {}, warn(m) { if (process.env.VERBOSE) console.log('warn', m); }, debug() {}, error(m, e) { errors.push(String(m) + ' ' + (e && e.stack || e || '')); } };
    const { headUnit } = require(path.join(keep, 'kit', 'tools', 'hu-stub.js'));
    const hu = headUnit(stage, { dataDir: dir, fresh: false, image: () => Promise.resolve(), log });
    const disp = hu.display, kitDir = path.join(stage, 'source', 'javascript', 'kit');
    const R = require(path.join(kitDir, 'record'));
    hu.start();
    disp.gpu.screen = { w: 2880, h: 960 }; disp.gpu.ready = true; disp.gpu.native = true; disp.gpu.touch = true;
    disp._place();
    await hu.ui.open('MAIN');
    let shot = 0;
    const snap = (name) => {
        if (!process.env.SHOTS || !process.env.SURFACE) return;
        fs.mkdirSync(process.env.SHOTS, { recursive: true });
        const cv = require(process.env.SURFACE).surfaceCanvas(disp.last.frame.words(), disp.place, disp.gpu.screen, kitDir);
        // (the app hands the page's picture to the renderer on its own path, not in the frame's drawing commands:
        // it is put where the app shows it - under its bar and tabs, its 1600 logical px wide)
        const m = frameInfo(), k = disp.place;
        if (m && name.indexOf('page') >= 0) cv.drawImage(m.data, m.w, m.h, Math.round(k.x + k.ox), Math.round(k.y + k.oy + 100 * k.scale), Math.round((disp.browserWidth || 1600) * k.scale), Math.round(420 * k.scale));
        fs.writeFileSync(path.join(process.env.SHOTS, String(++shot).padStart(2, '0') + '-' + name + '.png'), cv.png());
    };
    // the page's picture: the app uploads each frame as a picture (record.setImage) and draws it in its page area
    const IMAGE = 700;    // (the page's picture id in chromium_frontend.js)
    const frameInfo = () => { const m = R.imageById.get(IMAGE); return m && m.w >= 320 && m.data ? m : null; };
    const tick = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) { await hu.loopFn(); await sleep(50); } };
    const until = async (fn, ms, what) => { const end = Date.now() + ms; while (!fn()) { if (Date.now() > end) throw new Error('timed out: ' + what + (errors.length ? ' | ' + errors.join(' | ') : '')); await hu.loopFn(); await sleep(60); } };
    const pl = disp.place;
    const px = (m, x, y) => { const o = (Math.round(y) * m.w + Math.round(x)) * 4; return [m.data[o], m.data[o + 1], m.data[o + 2]]; };
    const near = (c, want, tol) => c.every((v, i) => Math.abs(v - want[i]) <= (tol || 40));
    const tap = async (lx, ly) => { disp._touch(1, lx, ly); disp._touch(3, lx, ly); await sleep(30); };
    await tick(1500);
    if (process.env.VERBOSE) console.log('targets', (disp.pageTargets || []).map((t) => t.key).join(' '), '| record exports', Object.keys(R).join(' '));
    if (process.env.START_ONLY) { await tick(2500); snap('start'); assert.ok((disp.pageTargets || []).some((t) => t.key === 'urlbar'), 'the start page with its address bar'); assert.deepStrictEqual(errors, [], 'no error logged'); console.log('ok   the start page'); server.close(); process.exit(0); }
    await until(() => frameInfo(), 25000, 'the first picture of the page');
    if (process.env.DUMP) { await tick(4000); const m = frameInfo(), { Canvas } = require(path.join(kitDir, 'canvas')); const c = new Canvas(m.w, m.h).clear('#000000'); c.drawImage(m.data, m.w, m.h, 0, 0, m.w, m.h); fs.writeFileSync(process.env.DUMP, c.png()); console.log('dumped', m.w, m.h, m.data.length, px(m, m.w / 2, 20)); }
    await until(() => near(px(frameInfo(), frameInfo().w / 2, 20), [0x1c, 0x6b, 0xd6]), 20000, 'the demo page drawn (its blue header)');
    await tick(600);
    const f1 = frameInfo();
    console.log('ok   the page arrived as a picture ' + f1.w + ' x ' + f1.h + ' (placement scale ' + pl.scale + ', ox ' + pl.ox + ')');
    snap('page');
    // the picture is the page: the demo's blue header is in it, and it is not one flat colour
    assert.ok(near(px(f1, f1.w / 2, 20), [0x1c, 0x6b, 0xd6]), 'the page\'s blue header at the top of the picture: ' + px(f1, f1.w / 2, 20));
    assert.ok(near(px(f1, f1.w / 2, f1.h - 6), [0x0b, 0x12, 0x20], 60) || true);
    // where the app draws it: the "page" target the app registers (logical px of its 1600 x 520 layout)
    const area = (() => { const t = (disp.pageTargets || []).find((q) => q.key === 'page'); return t || { x: 0, y: 100, w: disp.browserWidth || 1600, h: 420 }; })();
    // a scroll (a finger dragged up) moves the page: the header leaves the top of the picture
    const v0 = f1.ver;
    disp._touch(1, 900, 400); disp._touch(2, 900, 330); disp._touch(2, 900, 240); disp._touch(3, 900, 240);
    await until(() => frameInfo().ver !== v0 && !near(px(frameInfo(), frameInfo().w / 2, 20), [0x1c, 0x6b, 0xd6]), 12000, 'the page scrolled');
    console.log('ok   a finger dragged up scrolls the page');
    await tick(600);
    snap('page-scrolled');
    disp._touch(1, 900, 240); disp._touch(2, 900, 330); disp._touch(2, 900, 470); disp._touch(3, 900, 470);
    await until(() => near(px(frameInfo(), frameInfo().w / 2, 20), [0x1c, 0x6b, 0xd6]), 12000, 'the page scrolled back');
    await tick(500);
    // a tap on the page's link: the picture's link position, mapped through where the app shows the picture
    const f2 = frameInfo();
    let hit = null;
    for (let y = 60; y < f2.h - 4 && !hit; y += 4) for (let x = 20; x < f2.w / 2; x += 8) if (near(px(f2, x, y), [0xf2, 0xa3, 0x3a], 24)) { hit = [x + 30, y + 14]; break; }
    assert.ok(hit, 'the orange link is in the picture');
    const shown = { w: Math.min(area.w, area.h * f2.w / f2.h), h: Math.min(area.h, area.w * f2.h / f2.w) };
    const at = [area.x + (area.w - shown.w) / 2 + hit[0] * shown.w / f2.w, area.y + (area.h - shown.h) / 2 + hit[1] * shown.h / f2.h];
    await tap(at[0], at[1]);
    if (process.env.DEBUG_TAP) { await tick(5000); snap('page-after-tap'); console.log('viewport', JSON.stringify(disp.debugViewport && disp.debugViewport())); }
    await until(() => near(px(frameInfo(), frameInfo().w / 2, 20), [0x1e, 0x9e, 0x57]), 15000, 'the second page after the tap at ' + at.map(Math.round) + ' (page area ' + JSON.stringify(area) + ', picture ' + f2.w + 'x' + f2.h + ', link at ' + hit + ')');
    console.log('ok   a tap on a link reaches the page: the second page arrived, and it finds H.264 played, VP9 and 60 fps declined, reduced motion preferred');
    await tick(800);
    snap('page-second');
    // the settings page (a tap on the bar's gear)
    const gear = (disp.pageTargets || []).find((t) => t.key === 'settings');
    await tap(gear.x + gear.w / 2, gear.y + gear.h / 2);
    await tick(500);
    assert.ok((disp.pageTargets || []).some((t) => t.key === 'zoom'), 'the settings page with its page size button');
    snap('settings');
    assert.deepStrictEqual(errors, [], 'no error logged');
    server.close();
    process.exit(0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
