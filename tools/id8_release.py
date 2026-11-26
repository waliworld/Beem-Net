#!/usr/bin/env python3
"""Beem-Net's iDrive 8 release: dist/release/ with catalog.json and the three packages the MGU Store installs.

  the app      built here from this repository (tools/build_store.py, the public kit that knows iDrive 8)
  the runtime  upstream's published package (pllanaio/mgu-browser 0.16.1: its tested files and native helpers,
               byte for byte) with this repository's runtime/setup.js - how the app's uid is found on iDrive 8 -
               and "mguHmi": ["ID8"]
  the engine   upstream's published Chromium package, byte for byte, with "mguHmi": ["ID8"]

Upstream's packages say "ID7" in their own component.json, which the head unit's installer refuses on iDrive 8;
nothing else about them is changed. Each is fetched by its address and checked by its sha256 first.

  python3 tools/id8_release.py --kit <checkout of the public kit at build_store.KIT_COMMIT> [--base <url/>] [--cache <dir>]
"""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = 'https://github.com/pllanaio/mgu-browser/releases/download/'
RUNTIME = ('v0.16.1/mgu-browser%400.16.1.tgz', 'dac91634fe5ff877913b66add4205895a86f90800d48e8a9897c6cd75cf157aa')
ENGINE = ('v0.10.0/mgu-browser-engine%400.1.0.tgz', '0b6a73c964354214262d01f2d9bec2d0ab253cac8d27de04708912e804ef0874')
# the runtime's files this repository changes for iDrive 8 (the package's path -> the repository's)
RUNTIME_OURS = {'runtime/setup.js': 'runtime/setup.js'}
REQUIRES_APP = {'mgu-browser': '0.16.1', 'mgu-browser-engine': '0.1.0', 'mgu-uplink': '0.7.3', 'mgu-render': '0.6.11', 'mgu-deploy': '0.7.17'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def fetch(item, cache):
    name, want = item
    target = cache / name.split('/')[-1].replace('%40', '@')
    if not target.is_file() or sha(target.read_bytes()) != want:
        with urllib.request.urlopen(UPSTREAM + name, timeout=120) as source, target.open('wb') as out:
            shutil.copyfileobj(source, out, 1 << 20)
    if sha(target.read_bytes()) != want:
        raise SystemExit(target.name + ': not the package pinned here (sha256 differs)')
    return target


def repack(source, target, change, replace=None):
    """Copy a component package member by member (names, modes, order kept), with component.json rewritten by
    change(dict) and the files named in replace ({package path: bytes}) swapped, their sha256 in it updated."""
    replace = replace or {}
    seen = set()
    with tarfile.open(source, 'r:gz') as old, target.open('wb') as raw, \
            gzip.GzipFile(fileobj=raw, filename='', mode='wb', mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w', format=old.format) as new:
        members = old.getmembers()
        if members[0].name != 'component.json':
            raise SystemExit(source.name + ': component.json is not its first member')
        component = json.loads(old.extractfile(members[0]).read().decode('utf-8'))
        listed = {f['path']: f for f in component.get('files', [])}
        for path, data in replace.items():
            if path not in listed:
                raise SystemExit(source.name + ': has no file ' + path)
            listed[path]['sha256'] = sha(data)
        change(component)
        text = (json.dumps(component, indent=2) + '\n').encode('utf-8')
        for member in members:
            if member.issym() or member.islnk():
                raise SystemExit(source.name + ': a link in the package')
            data = None
            if member.name == 'component.json':
                data = text
            elif member.name.startswith('files/') and member.name[6:] in replace:
                data = replace[member.name[6:]]
                seen.add(member.name[6:])
            elif member.isfile():
                data = old.extractfile(member).read()
                want = listed.get(member.name[6:], {}).get('sha256') if member.name.startswith('files/') else None
                if want and sha(data) != want:
                    raise SystemExit(source.name + ': ' + member.name + ' is not the file its component.json lists')
            if data is not None:
                member.size = len(data)
                new.addfile(member, io.BytesIO(data))
            else:
                new.addfile(member)
    if seen != set(replace):
        raise SystemExit(source.name + ': not every file to replace was in the package')
    return component


def entry(component, artifact, base, extra=None):
    data = artifact.read_bytes()
    out = {'id': component['id'], 'kind': component.get('kind', 'tool'), 'version': component['version'], 'title': component['title'],
           'mguHmi': ['ID8'], 'artifact': {'name': artifact.name, 'size': len(data), 'sha256': sha(data), 'url': base + artifact.name},
           'requires': component.get('requires', {}), 'uninstallable': True}
    out.update(extra or {})
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--kit', required=True)
    parser.add_argument('--base', default='https://github.com/waliworld/Beem-Net/releases/download/catalog/')
    parser.add_argument('--cache', default=str(ROOT / 'build' / 'upstream'))
    parser.add_argument('--out', default=str(ROOT / 'dist' / 'release'))
    args = parser.parse_args()
    cache, out = Path(args.cache), Path(args.out)
    cache.mkdir(parents=True, exist_ok=True)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    def id8(title):
        def change(component):
            component['mguHmi'] = ['ID8']
            component['title'] = title
        return change

    ours = {path: (ROOT / local).read_bytes() for path, local in RUNTIME_OURS.items()}
    runtime = repack(fetch(RUNTIME, cache), out / 'mgu-browser@0.16.1.tgz', id8('Beem-Net runtime (experimental, iDrive 8)'), ours)
    engine = repack(fetch(ENGINE, cache), out / 'mgu-browser-engine@0.1.0.tgz', id8('Beem-Net Chromium engine (experimental, iDrive 8)'))

    spec = json.loads((ROOT / 'apps' / 'mgu_browser' / 'app.json').read_text(encoding='utf-8'))
    stage = ROOT / 'build' / 'app-out'
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    env = dict(os.environ, MGU_KIT_DIR=str(Path(args.kit).resolve()), MGU_OUT=str(stage))
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'build_store.py'), '--app', spec['id'], '--version', spec['version'],
                    '--source', 'apps/' + spec['id'], '--release-package'], check=True, cwd=str(ROOT), env=env)
    app = out / (spec['id'] + '@' + spec['version'] + '.tgz')
    shutil.copyfile(stage / app.name, app)

    components = [
        entry({'id': spec['id'], 'kind': 'app', 'version': spec['version'], 'title': 'Beem-Net (experimental)', 'requires': REQUIRES_APP}, app, args.base,
              {'description': 'An internet browser for iDrive 8: a real Chromium on the head unit, its picture in the app, touch on the page. '
                              'Experimental: picture and touch first; sound and video are not qualified on iDrive 8 yet. Based on MGU Browser by Leon Pllana.',
               'author': 'Waliworld #tunedbywali, on MGU Browser by Leon Pllana'}),
        entry(runtime, out / 'mgu-browser@0.16.1.tgz', args.base, {'author': 'Leon Pllana; iDrive 8 changes by Waliworld'}),
        entry(engine, out / 'mgu-browser-engine@0.1.0.tgz', args.base, {'author': 'Leon Pllana'}),
    ]
    (out / 'catalog.json').write_text(json.dumps({'schema': 2, 'components': components}, indent=2) + '\n', encoding='utf-8')
    for c in components:
        print('%s %s  %s  %d bytes  requires %s' % (c['id'], c['version'], c['artifact']['name'], c['artifact']['size'], c['requires']))


if __name__ == '__main__':
    main()
