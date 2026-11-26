'use strict';
// App-specific full-width layout. BMW's top status/home strip stays available.
const {Recorder}=require('./kit/record');
module.exports=function install(display){
    if(!display)return;
    const place=display._place.bind(display),chrome=display._drawChrome.bind(display),claim=display._claimTabs.bind(display);
    const applies=()=>display.place&&display.place.full&&display.gpu&&display.gpu.native&&display.gpu.touch;
    display._place=function(){
        place();if(!applies())return;
        const p=this.place;
        // iDrive 8 (2880 x 960): the renderer gives the app the area under BMW's status bar already (764 high, over
        // the climate bar), so no strip is kept free at the top; the browser's 520 px high page is scaled to that
        // height and made as wide as the screen (browserWidth: 1960 logical px, the app lays its bar and page out to it).
        const id8=!!(this.gpu.screen&&this.gpu.screen.w===2880&&this.gpu.screen.h===960);
        if(id8){p.scale=Math.floor(Math.min(p.w/1600,p.h/520)*1000)/1000;p.ox=0;p.oy=0;this.browserWidth=Math.floor(p.w/p.scale);}
        else{p.scale=p.w/1600;p.ox=0;p.oy=this.browserFullscreen?0:80;this.browserWidth=1600;}
        p.oyTop=p.oy;p.oyMid=p.oy;p.extra=Math.floor((p.h-p.oy)/p.scale-520);
        this.gpu.place(p);this.recorders.clear();this.lastWords=null;this._layoutChanged();
    };
    display._drawChrome=function(r){
        if(!applies())return chrome(r);
        const p=this.place,c=this.chromeRec||(this.chromeRec=new Recorder(p.w,p.h));c.reset();c.tabRects=[];
        if(p.oy>0)c.clip(0,0,p.w,p.oy).clear(0).noclip();
        const key=this.focusKey,q=(this.pageTargets||[]).find(t=>'tgt:'+t.key===key);
        if(q)c.strokeRoundRect(q.x*p.scale+p.ox+2,q.y*p.scale+p.oy+2,q.w*p.scale-4,q.h*p.scale-4,8,2.5,'#ff5b52');
        r.xf(1,0,0).append(c).xf();this.headEnd=0;
    };
    display._claimTabs=function(rects,r){
        if(!applies())return claim(rects,r);
        this.tabs=[];const p=this.place;
        this.gpu.claim([{x:-p.ox/p.scale,y:0,w:p.w/p.scale,h:(p.h-p.oy)/p.scale}]);
    };
    display._tabList=()=>({tabs:[],sel:-1,settings:-1,badges:[]});
    display.browserSetFullscreen=value=>{if(display.browserFullscreen!==!!value){display.browserFullscreen=!!value;display._place();}};
    display._place();
};
