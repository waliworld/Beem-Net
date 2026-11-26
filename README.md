# Beem-Net

An internet browser for **BMW iDrive 8**, installed from the
[MGU Store](https://github.com/robertnisipeanu/mgu-store). A real Chromium runs on the head unit, out of sight; the
app shows its picture and sends it your touches.

> **Beta 1, experimental, not confirmed on a car yet.** It is published so it can be tried on one. Unofficial: not
> affiliated with or endorsed by BMW or Google. Use it parked.

Beem-Net is the iDrive 8 version of **[MGU Browser](https://github.com/pllanaio/mgu-browser) by Leon Pllana**, which
is written for iDrive 7. The browser itself - the Chromium engine, the service behind the app, the tabs, forms,
downloads and the rest - is his work, MIT licensed, and is credited in [CREDITS.md](CREDITS.md). His own
documentation is kept under [docs/](docs/) ([English overview](docs/UPSTREAM_README.en.md),
[German](docs/UPSTREAM_README.de.md)).

| | |
|---|---|
| ![A page](docs/media/id8-page.png) | ![Scrolled](docs/media/id8-page-scrolled.png) |
| A page in Beem-Net on the iDrive 8 screen: the bar, the tabs, the page | Scrolled with a finger |
| ![After a tap](docs/media/id8-page-second.png) | |
| A tap on the page's link opened the next page | |

These are not photos of a car. They are made on a computer by `test/id8/e2e_local.js`: the built app on a simulated
2880 x 960 iDrive 8 screen, the real backend and the real Chromium engine from the release, loading a demo page
from a local web server; the scroll and the tap in them were sent as touches. A photo from a car will replace them.

## What Beta 1 is for

One question: **does the browser run on an iDrive 8 head unit at all?**

| | |
|---|---|
| In Beta 1 | The app on the iDrive 8 screen (2880 x 960: the page under BMW's status bar and over the climate bar), touch on the page (tap, scroll), the address bar and the on-screen keyboard, tabs, bookmarks and history as upstream has them |
| Not yet | **Sound.** Upstream's way to the car's speakers is an iDrive 7 one. **Smooth video**: pages are shown as pictures, which is fine for reading and slow for video |
| Never, as it stands | Netflix, Disney+ and the like: no DRM module is shipped |

## Install

1. In the MGU Store, add the source **`waliworld/Beem-Net`** and choose **Releases**.
2. Install **Beem-Net**. The Store installs what it needs with it: the Beem-Net runtime, the Chromium engine (about
   170 MB - give it time and a good connection), the Store's internet uplink and the GPU renderer.
3. Restart the head unit, then open **Beem-Net**.

If it does not open a page, a photo of what the screen says is what helps.

## What is different from upstream

- **The app** is built with the public app kit at the version that knows iDrive 8, and places its page for that
  screen ([src/browser_layout.js](src/browser_layout.js)).
- **The runtime** is upstream's published 0.16.1 package, byte for byte, but for one file: how the app's uid is found
  on a unit where MainApp keeps no `uids.txt` ([runtime/setup.js](runtime/setup.js)).
- **The engine** is upstream's published Chromium package, byte for byte.
- Both carry `"mguHmi": ["ID8"]`: upstream's say iDrive 7 only, which the installer refuses on iDrive 8.

[tools/id8_release.py](tools/id8_release.py) puts the release together and checks every upstream file against its
sha256 on the way.

## Good to know

- It is a browser on a car's head unit. It runs as its own unprivileged user inside Chromium's sandbox, but it has
  had no outside security review (upstream says so too, in [SECURITY.md](SECURITY.md)). Do not sign in to anything
  you would mind losing.
- Upstream can keep passwords and has a phone remote. Both are off unless you turn them on in its settings; leave
  them off on a customer's car.
- The package ids are upstream's (`mgu_browser`, `mgu-browser`, `mgu-browser-engine`), so the service and the app
  recognise each other. Upstream's own packages are for iDrive 7 only and are not offered on an iDrive 8 car.

## Build and test on a computer

    git clone https://github.com/cauliflowermossgrape/idrive7-apps.git kit-checkout
    git -C kit-checkout checkout f54fc279d309ca12eba129b676d755c6f02f5a06
    node --test test/*.test.js test/id8/*.test.js
    python3 tools/id8_release.py --kit kit-checkout        # dist/release/

`tools/build_store.py` refuses to run as root.

**End to end** (the real engine): unpack the engine package to `/var/opt/mgu-browser-engine/versions/0.1.0/` (its
Chromium is linked to that path), start `dev/backend.js` as an unprivileged user as upstream's
[development notes](docs/DEVELOPMENT.md) describe, then
`node test/id8/e2e_local.js <stage of build_store.py --keep-stage> <the backend's socket>`. It checks that a page
arrives as a picture, that a finger scrolls it and that a tap on a link opens the next page.

## Credits and licence

- **MGU Browser** by Leon Pllana and contributors - the browser. MIT.
- **idrive7-apps** by cauliflowermossgrape and contributors - the app kit. MIT.
- **MGU Store** by robertnisipeanu - how it is installed.
- iDrive 8 version by **Waliworld #tunedbywali**.

MIT, see [LICENSE](LICENSE); third-party notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and
[licenses/](licenses/).
