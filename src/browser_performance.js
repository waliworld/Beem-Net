'use strict';
// Optional content blocking is a user preference. Default page animation and
// background scheduling stay under Chromium's normal browser policy: freezing
// a newly hidden tab can strand login popups, polling and pending requests.
const BLOCKED_HOSTS=[
    'doubleclick.net','googlesyndication.com','googleadservices.com','google-analytics.com','adservice.google.com','adservice.google.de',
    'amazon-adsystem.com','adnxs.com','criteo.com','criteo.net','taboola.com','outbrain.com','scorecardresearch.com','quantserve.com',
    'hotjar.com','adsrvr.org','rubiconproject.com','pubmatic.com','openx.net','casalemedia.com','smartadserver.com','yieldlab.net',
    'adform.net','teads.tv','moatads.com','doubleverify.com','adsafeprotected.com','ioam.de','xiti.com','chartbeat.com','chartbeat.net',
    'mouseflow.com','crazyegg.com','bat.bing.com','ads.linkedin.com','ads-twitter.com','static.ads-twitter.com','analytics.tiktok.com',
    'adition.com','stroeerdigitalgroup.de','stroeerdigitalmedia.de','emetriq.de','theadex.com','seedtag.com','sharethrough.com',
    'indexww.com','3lift.com','bidswitch.net','lijit.com','sonobi.com','media.net','zemanta.com','mgid.com','revcontent.com',
];
// Beem-Net: the head unit draws and decodes everything on its processor (no GPU for the engine). Two things cost the
// most on a video site and are asked for less of here, on every page:
//  - the video's codec. AV1 and VP9 are several times the work of H.264 to decode in software, and 50/60 frames a
//    second twice that of 30: a page that asks what the browser plays is told H.264 and AAC up to 30 fps, so a site
//    with a choice (YouTube) sends that. A site with one codec only is not affected: it is played as it comes.
//  - motion the page adds itself: it is told the user prefers reduced motion (the standard media feature).
const LIGHT_MEDIA=`(()=>{if(window.__beemLight)return;window.__beemLight=true;
const heavy=/(^|[^a-z0-9])(av01|av1|vp09|vp9|vp8|hev1|hvc1)/i,fast=t=>{const m=/framerate=([0-9.]+)/i.exec(t||'');return !!m&&Number(m[1])>32;};
const no=t=>typeof t==='string'&&(heavy.test(t)||fast(t));
try{const M=window.MediaSource;if(M&&M.isTypeSupported){const o=M.isTypeSupported.bind(M);M.isTypeSupported=t=>!no(t)&&o(t);}}catch(e){}
try{const M=window.ManagedMediaSource;if(M&&M.isTypeSupported){const o=M.isTypeSupported.bind(M);M.isTypeSupported=t=>!no(t)&&o(t);}}catch(e){}
try{const P=HTMLMediaElement.prototype,o=P.canPlayType;P.canPlayType=function(t){return no(t)?'':o.call(this,t);};}catch(e){}
try{const C=navigator.mediaCapabilities;if(C&&C.decodingInfo){const o=C.decodingInfo.bind(C);C.decodingInfo=c=>{const v=c&&c.video;if(v&&(no(v.contentType)||v.framerate>32))return Promise.resolve({supported:false,smooth:false,powerEfficient:false});return o(c);};}}catch(e){}
})();`;
const BLOCK_PATTERNS=BLOCKED_HOSTS.reduce((list,host)=>list.concat(['*://'+host+'/*','*://*.'+host+'/*']),[]);
module.exports={
    BLOCKED_HOSTS,BLOCK_PATTERNS,LIGHT_MEDIA,
    async applyPagePerformance(session,pipe){
        pipe=pipe||this.pipe;
        await pipe.send('Page.addScriptToEvaluateOnNewDocument',{source:LIGHT_MEDIA},session).catch(()=>{});
        await pipe.send('Runtime.evaluate',{expression:LIGHT_MEDIA},session).catch(()=>{});
        await pipe.send('Network.setBlockedURLs',{urls:this.contentBlocking===true?BLOCK_PATTERNS:[]},session).catch(()=>{});
        await pipe.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},session).catch(()=>{});
    },
    async setContentBlocking(enabled){
        this.contentBlocking=enabled!==false;
        if(this.pipe)for(const tab of this.tabs)await this.pipe.send('Network.setBlockedURLs',{urls:this.contentBlocking?BLOCK_PATTERNS:[]},tab.session).catch(()=>{});
        return {enabled:this.contentBlocking};
    },
    // Thaw any legacy frozen target; new tab switches never force a freeze.
    async lifecycle(previous,next){
        const pipe=this.pipe;if(!pipe)return;
        for(const tab of [previous,next]){
            if(!tab||!tab.frozen)continue;
            await pipe.send('Page.setWebLifecycleState',{state:'active'},tab.session).then(()=>{tab.frozen=false;},()=>{});
        }
    }
};
