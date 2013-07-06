(function (w) { //w==window
    // Enable strict mode
    "use strict";

    w.slimmage = w.slimmage || {};
    w.slimmage.settings || {};
    var log = function(){ if (typeof(w.console) != "undefined") w.console.log.apply(w.console,arguments);};
    w.slimmage.beginWebPTest = function(){
        if (!w.slimmage.settings.serverHasWebP || w.slimmage._testingWebP) return;
        w.slimmage._testingWebP = true;

        var WebP=new Image();
        WebP.onload=WebP.onerror=function(){
            w.slimmage.webp = (WebP.height==2);
        };
        WebP.src='data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    };


    w.slimmage.nodesToArray = function (nodeList) {
        var array = [];
        // iterate backwards ensuring that length is an UInt32
        for (var i = nodeList.length >>> 0; i--;) {
            array[i] = nodeList[i];
        }
        return array;
    };
    w.slimmage.adjustImageSrcWithData = function (img, originalSrc, wImg) {
        var dpr = window.devicePixelRatio || 1;
        var trueWidth = wImg.offsetWidth * dpr;
        wImg.setAttribute("data-deleted",true);
        wImg.parentNode.removeChild(wImg); //Get rid of test image

        var quality = (dpr > 1.49) ? 90 : 80;

        if (w.slimmage.webp) quality = dpr > 1.49 ? 65 : 78;

        var maxwidth = Math.min(2048, trueWidth); //Limit size to 2048.

        //Minimize variants for caching improvements; round up to nearest multiple of 160
        maxwidth = maxwidth - (maxwidth % 160) + 160; //Will limit to 13 variations

        var oldpixels = img.getAttribute("data-pixel-width") | 0;

        if (maxwidth > oldpixels) {
            //Never request a smaller image once the larger one has already started loading
            var newSrc = originalSrc.replace(/width=\d+/i, "width=" + maxwidth).replace(/quality=[0-9]+/i,"quality=" + quality);
            if (w.slimmage.webp) newSrc = newSrc.replace(/format=[a-z]+/i,"format=webp");
            img.src =  newSrc; 
            img.setAttribute("data-pixel-width", maxwidth);
            log("Slimming: updating " + newSrc)
        }
    };

    w.slimmage.adjustImageSrc = function (img, originalSrc) {
        var wImg = img.cloneNode();
        wImg.src = "";
        try{ wImg.style.paddingBottom = "-1px"; }catch(e){}
        wImg.removeAttribute("data-slimmage");
        wImg.removeAttribute("data-ri");
        img.parentNode.insertBefore(wImg, img);
        wImg.onload=function(){
            w.slimmage.adjustImageSrcWithData(img, originalSrc, wImg);
        };
        //Kill this temp image if it takes > 50ms to load the image (since .onload is unreliable)
        setTimeout(function(){
            if (wImg.getAttribute("data-deleted") || !wImg.parentNode) return;

            if (wImg.width = 4000) {
                log("Slimmage: onload failed to fire, used timeout: " + originalSrc)
                w.slimmage.adjustImageSrcWithData(img, originalSrc, wImg);
            }else{
                wImg.onload = null;
                wImg.parentNode.removeChild(wImg);
                img.src = originalSrc;
                log("Slimmage: Failed to calculate size for " + originalSrc)
            }
        },101);
        //Load a 4,000 pixel wide image, see what the resulting true width is.
        wImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAD6AAAAABCAAAAADvHA58AAAACXZwQWcAAA+gAAAAAQDjne1PAAAAG0lEQVRIx+3BIQEAAAACIP+f1hkWIAUAAADuBuaLkULU/NTrAAAAAElFTkSuQmCC";
    };

    w.slimmage.checkResponsiveImages = function (delay) {
        if (w.slimmage.timeoutid > 0) w.clearTimeout(w.slimmage.timeoutid);
        w.slimmage.timeoutid = 0;
        if (delay && delay > 0) {
            w.slimmage.timeoutid = w.setTimeout(w.slimmage.checkResponsiveImages, delay);
            return;
        }
        var newImages = 0;
        //1. Copy images out of noscript tags, but hide 'src' attribute as data-src
        var n = w.slimmage.nodesToArray(w.document.getElementsByTagName("noscript"));
        for (var i = 0, il = n.length; i < il; i++) {
            var ns = n[i];
            if (ns.getAttribute("data-ri") !== null || ns.getAttribute("data-slimmage") !== null) {
                
                var div = w.document.createElement('div');
                var contents = (ns.textContent || ns.innerHTML);
                if (!contents){
                    //IE doesn't let us touch noscript, so we have to use attributes.
                    var img = new Image();
                    for (var ai = 0; ai < ns.attributes.length; ai++) {
                        var a = ns.attributes[ai];
                        if (a && a.specified && a.name.indexOf("data-img-") == 0){
                            img.setAttribute(a.name.slice(9 - a.name.length),a.value);
                        }
                    }
                    div.appendChild(img);
                }else{
                    //noscript isn't part of DOM, so we have to recreate it, unescaping html, src->data-src 
                    div.innerHTML = contents.replace(/\s+src\s*=\s*(['"])/i, " data-src=$1").
                        replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                }

                var childImages = div.getElementsByTagName("img");
                for (var j = 0, jl = childImages.length; j < jl; j++) {
                    var ci = childImages[j];
                    if (ci.src !== null && ci.src.length > 0) {
                        ci.setAttribute("data-src", ci.src);
                        ci.src = "";
                    }
                    ci.setAttribute("data-slimmage", true);
                    ns.parentNode.insertBefore(ci, ns);
                    newImages++;
                }
                //2. Remove old noscript tags
                ns.parentNode.removeChild(ns);
            }
        }

        //3. Find images with data-slimmage and run adjustImageSrc.
        var totalImages = 0;
        var images = w.slimmage.nodesToArray(w.document.getElementsByTagName("img"));
        for (var i = 0, il = images.length; i < il; i++) {
            if (images[i].getAttribute("data-slimmage") !== null) {
                var originalSrc = images[i].getAttribute("data-src") || images[i].src;
                w.slimmage.adjustImageSrc(images[i], originalSrc);
                totalImages++;
            }
        }

        log("Slimmage: unfolded " + newImages + " images from noscript tags; began size calculations on " + totalImages + " images.");
    };

    var h = w.slimmage.checkResponsiveImages;
    // Run on resize and domready (w.load as a fallback)
    if (w.addEventListener) {
        w.addEventListener("resize", function () { h(200); }, false);
        w.addEventListener("DOMContentLoaded", function () {
            h();
            // Run once only
            w.removeEventListener("load", h, false);
        }, false);
        w.addEventListener("load", h, false);
    } else if (w.attachEvent) {
        w.attachEvent("onload", h);
    }
    //test for webp support
    w.slimmage.beginWebPTest();
}(this));