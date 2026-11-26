'use strict';
// iDrive 8: the app's uid from the installed apps' folders where MainApp keeps no uids.txt (runtime/setup.js).
const test=require('node:test'),assert=require('node:assert'),{appUidFromFolders}=require('../../runtime/setup');
function fakeFs(tree){
    const stat=(e)=>({isDirectory:()=>e.dir===true,isFile:()=>e.dir!==true,uid:e.uid,gid:e.gid,mode:e.mode,nlink:e.nlink||1,size:(e.text||'').length});
    return {
        readdirSync:(root)=>{if(root!=='/oap')throw Object.assign(Error('none'),{code:'ENOENT'});return Object.keys(tree).filter((k)=>k.indexOf('/')<0);},
        lstatSync:(p)=>{const k=p.replace(/^\/oap\//,'');if(!tree[k])throw Object.assign(Error('none'),{code:'ENOENT'});return stat(tree[k]);},
        readFileSync:(p)=>tree[p.replace(/^\/oap\//,'')].text,
    };
}
const app=(uid,name,over)=>{const o=over||{},t={};
    t['oap_'+uid]=Object.assign({dir:true,uid:12201,gid:uid,mode:0o770},o.dir);
    t['oap_'+uid+'/source']=Object.assign({dir:true,uid:12201,gid:uid,mode:0o750},o.source);
    t['oap_'+uid+'/source/package.json']=Object.assign({uid:12201,gid:uid,mode:0o640,text:JSON.stringify({name})},o.file);
    return t;};
test('the one installed app folder that names the Browser gives its uid (the layout photographed on a G80 M3)',()=>{
    const tree=Object.assign({oap_12201:{dir:true,uid:12201,gid:12201,mode:0o770},junk:{dir:true,uid:0,gid:0,mode:0o755}},app(12205,'message_handling'),app(12208,'jap_ridetube8'),app(12236,'mgu_browser'));
    assert.strictEqual(appUidFromFolders(fakeFs(tree),'/oap'),12236);
});
test('no Browser installed, or the folder list unreadable: none',()=>{
    assert.strictEqual(appUidFromFolders(fakeFs(app(12208,'jap_ridetube8')),'/oap'),null);
    assert.strictEqual(appUidFromFolders(fakeFs({}),'/elsewhere'),null);
});
test('two folders naming it: none (never a guess)',()=>{
    assert.strictEqual(appUidFromFolders(fakeFs(Object.assign({},app(12236,'mgu_browser'),app(12240,'mgu_browser'))),'/oap'),null);
});
test('a folder an app could have written is not believed',()=>{
    for(const over of [{dir:{uid:12236}},{dir:{gid:12201}},{dir:{mode:0o777}},{source:{uid:12236}},{source:{mode:0o770}},{file:{uid:12236}},{file:{mode:0o660}},{file:{nlink:2}},{file:{text:'{'}}])
        assert.strictEqual(appUidFromFolders(fakeFs(app(12236,'mgu_browser',over)),'/oap'),null,JSON.stringify(over));
});
