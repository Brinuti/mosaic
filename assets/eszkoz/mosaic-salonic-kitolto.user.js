// ==UserScript==
// @name         MOSAIC kitöltő (Salonic utalvány-értékesítés)
// @namespace    https://www.mosaicheadspa.hu/
// @description  A MOSAIC kiállító oldalról megnyitott Salonic-űrlapot magától kitölti (#mosaic= adat a linkben). Semmit nem küld el.
// @version      1.0
// @match        https://app.salonic.hu/promotion/giftCard/sale/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
if (/[#&]mosaic=/.test(location.hash)) {
(function(){var m=/[#&]mosaic=([^&]+)/.exec(location.hash);if(location.hostname!=='app.salonic.hu'||!m){alert('MOSAIC kit\u00f6lt\u0151: ezt a k\u00f6nyvjelz\u0151t a MOSAIC oldalr\u00f3l megnyitott Salonic-\u0171rlapon kell megnyomni (a ki\u00e1ll\u00edt\u00f3 oldal Salonic-linkj\u00e9vel nyisd meg az \u0171rlapot).');return;}var d;try{d=JSON.parse(decodeURIComponent(m[1]));}catch(x){alert('MOSAIC kit\u00f6lt\u0151: hib\u00e1s adat a linkben, nyisd meg \u00fajra a ki\u00e1ll\u00edt\u00f3 oldal linkj\u00e9t.');return;}var n=0,h=[];Object.keys(d).forEach(function(k){var e=document.getElementById('GiftCardBuyForm_'+k);if(!e){h.push(k);return;}if(e.type==='checkbox'){e.checked=!!d[k];}else{e.value=String(d[k]);}['input','change'].forEach(function(t){e.dispatchEvent(new Event(t,{bubbles:true}));});n++;});var b=document.createElement('div');b.textContent='MOSAIC: '+n+' mez\u0151 kit\u00f6ltve'+(h.length?' (nem tal\u00e1lom: '+h.join(', ')+')':'')+'. Ellen\u0151rizd, majd kattints az El\u0151n\u00e9zetre.';b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#17403f;color:#fff;padding:14px;text-align:center;font:16px sans-serif';document.body.appendChild(b);setTimeout(function(){b.remove();},9000);})();
}
