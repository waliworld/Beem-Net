'use strict';
// The script that asks a page for lighter video (src/browser_performance.js): what it answers to a site's questions.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm'),{LIGHT_MEDIA}=require('../../src/browser_performance');
function page(){
    const asked=[];
    const MediaSource={isTypeSupported:(t)=>{asked.push(t);return true;}};
    function HTMLMediaElement(){}
    HTMLMediaElement.prototype.canPlayType=function(){return 'probably';};
    const navigator={mediaCapabilities:{decodingInfo:()=>Promise.resolve({supported:true,smooth:true,powerEfficient:true})}};
    const window={MediaSource,HTMLMediaElement,navigator};window.window=window;
    vm.runInNewContext(LIGHT_MEDIA,window);vm.runInNewContext(LIGHT_MEDIA,window);   // (twice: a second run changes nothing)
    return {window,asked};
}
test('H.264 and AAC up to 30 frames a second are played; AV1, VP9, HEVC and 50/60 fps are declined',async()=>{
    const {window:w,asked}=page(),ok=(t)=>w.MediaSource.isTypeSupported(t);
    assert.strictEqual(ok('video/mp4; codecs="avc1.64001F"'),true);
    assert.strictEqual(ok('video/mp4; codecs="avc1.4d401e"; width=854; height=480; framerate=30'),true);
    assert.strictEqual(ok('audio/mp4; codecs="mp4a.40.2"'),true);
    assert.strictEqual(ok('audio/webm; codecs="opus"'),true);
    for(const t of ['video/webm; codecs="vp9"','video/webm; codecs="vp09.00.51.08"','video/mp4; codecs="av01.0.08M.08"','video/webm; codecs="vp8"','video/mp4; codecs="hvc1.1.6.L93.B0"','video/mp4; codecs="avc1.64002A"; framerate=60'])
        assert.strictEqual(ok(t),false,t);
    assert.ok(asked.every((t)=>/avc1|mp4a|opus/.test(t)&&!/framerate=60/.test(t)),'the declined ones never reach the engine');
    const el=new w.HTMLMediaElement();
    assert.strictEqual(el.canPlayType('video/webm; codecs="vp9"'),'');
    assert.strictEqual(el.canPlayType('video/mp4; codecs="avc1.42E01E"'),'probably');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(await w.navigator.mediaCapabilities.decodingInfo({type:'media-source',video:{contentType:'video/webm; codecs="vp09.00.40.08"',framerate:30}}))),{supported:false,smooth:false,powerEfficient:false});
    assert.strictEqual((await w.navigator.mediaCapabilities.decodingInfo({type:'media-source',video:{contentType:'video/mp4; codecs="avc1.4d401f"',framerate:30}})).supported,true);
    assert.strictEqual((await w.navigator.mediaCapabilities.decodingInfo({type:'media-source',video:{contentType:'video/mp4; codecs="avc1.4d401f"',framerate:60}})).supported,false);
});
test('a page without these objects is left alone',()=>{ vm.runInNewContext(LIGHT_MEDIA,(()=>{const w={navigator:{}};w.window=w;w.HTMLMediaElement=function(){};return w;})()); });
