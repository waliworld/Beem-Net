'use strict';
// Quick access: the pages an owner pins to the start page (src/browser_state.js). Kept on the unit, at most six.
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{BrowserState,QUICK_MAX}=require('../../src/browser_state');
const dir=()=>fs.mkdtempSync(path.join(os.tmpdir(),'bn-quick-'));
test('a page is pinned, survives reopening and is taken off again',()=>{
    const d=dir(),s=new BrowserState(d);
    assert.strictEqual(s.toggleQuick('https://example.org/','Example'),'pinned');assert.ok(s.pinned('https://example.org/'));
    const again=new BrowserState(d);assert.deepStrictEqual(again.data.quick,[{url:'https://example.org/',title:'Example'}]);
    assert.strictEqual(again.toggleQuick('https://example.org/'),'removed');assert.deepStrictEqual(new BrowserState(d).data.quick,[]);
});
test('six at most: a seventh is refused and nothing changes',()=>{
    const s=new BrowserState(dir());
    for(let i=0;i<QUICK_MAX;i++)assert.strictEqual(s.toggleQuick('https://example.org/'+i,'Page '+i),'pinned');
    assert.strictEqual(s.toggleQuick('https://example.org/more','More'),'full');assert.strictEqual(s.data.quick.length,QUICK_MAX);assert.ok(!s.pinned('https://example.org/more'));
});
test('an address the browser does not open is not pinned, and a damaged file is read safely',()=>{
    const d=dir(),s=new BrowserState(d);
    assert.strictEqual(s.toggleQuick('javascript:alert(1)','x'),'');assert.strictEqual(s.toggleQuick('file:///etc/passwd','x'),'');assert.deepStrictEqual(s.data.quick,[]);
    fs.writeFileSync(path.join(d,'browser-state.json'),JSON.stringify({quick:[{url:'file:///etc/passwd',title:'x'},null,'text',{url:'https://example.org/',title:'ok'}]}));
    assert.deepStrictEqual(new BrowserState(d).data.quick,[{url:'https://example.org/',title:'ok'}]);
    fs.writeFileSync(path.join(d,'browser-state.json'),JSON.stringify({quick:'nonsense'}));assert.deepStrictEqual(new BrowserState(d).data.quick,[]);
});
