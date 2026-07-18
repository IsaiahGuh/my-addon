/**
 * Scraper oficial de Vynx para Nuvio
 * Consume directamente el trabajo pre-procesado del Cloudflare Worker de Flyx
 * Versión de producción con dominios reales validados
 */

var PROXY_BASE = "https://workers.dev";
var VYNX_BASE = "https://vynx.cc";

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    return new Promise(function(resolve, reject) {
        var sNum = seasonNum || 1;
        var eNum = episodeNum || 1;
        var typeClean = mediaType || "movie";
        var vType = typeClean === "series" ? "tv" : "movie";
        var streamsFinales = [];

        // Encabezados requeridos por el Worker de Vynx para autorizar la conexión
        var headersBase = { 
            "Referer": VYNX_BASE + "/", 
            "Origin": VYNX_BASE,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        };

        // CASO A: ANIMES (HiAnime Pipeline)
        if (typeClean === "anime") {
            var urlAnime = PROXY_BASE + "/hianime/extract?malId=" + tmdbId + "&episode=" + eNum;
            fetch(urlAnime, { headers: headersBase })
                .then(function(res) { return res.json(); })
                .then(function(data) {
                    var videoUrl = data.url || (data.stream && data.stream.url);
                    if (videoUrl) {
                        streamsFinales.push({
                            name: "Vynx Anime",
                            title: "HiAnime (MegaCloud Server-Side Decrypt)",
                            url: PROXY_BASE + "/hianime/stream?url=" + encodeURIComponent(videoUrl),
                            quality: "1080p",
                            headers: headersBase
                        });
                    }
                    resolve(streamsFinales);
                })
                .catch(function() { resolve([]); });
            return;
        }

        // CASO B: PELÍCULAS Y SERIES TRADICIONALES
        // 1. Consultamos el extractor nativo de VidSrc del Worker
        var urlVidSrc = PROXY_BASE + "/vidsrc/extract?tmdbId=" + tmdbId + "&type=" + vType + "&season=" + sNum + "&episode=" + eNum;

        fetch(urlVidSrc, { headers: headersBase })
            .then(function(res) { 
                var contentType = res.headers.get("content-type") || "";
                if (contentType.indexOf("application/json") !== -1) {
                    return res.json();
                } else {
                    return res.text().then(function(t) { return { url: t }; });
                }
            })
            .then(function(data) {
                var extractedUrl = data.url || data.streamUrl || (typeof data === "string" ? data : "");
                if (extractedUrl && extractedUrl.indexOf("http") !== -1 && extractedUrl.indexOf("DOCTYPE") === -1) {
                    streamsFinales.push({
                        name: "Vynx VidSrc",
                        title: "VidSrc No-Turnstile (Multi-quality 1080p)",
                        url: PROXY_BASE + "/vidsrc/stream?url=" + encodeURIComponent(extractedUrl),
                        quality: "Auto HD",
                        headers: headersBase
                    });
                }

                // 2. Consultamos en cadena el extractor de Flixer del Worker
                var urlFlixer = PROXY_BASE + "/flixer/extract?tmdbId=" + tmdbId + "&type=" + vType + "&season=" + sNum + "&episode=" + eNum + "&server=alpha";
                return fetch(urlFlixer, { headers: headersBase });
            })
            .then(function(res) {
                var contentType = res.headers.get("content-type") || "";
                if (contentType.indexOf("application/json") !== -1) {
                    return res.json();
                } else {
                    return res.text().then(function(t) { return { url: t }; });
                }
            })
            .then(function(data) {
                var flixerUrl = data.url || (typeof data === "string" ? data : "");
                if (flixerUrl && flixerUrl.indexOf("http") !== -1 && flixerUrl.indexOf("DOCTYPE") === -1) {
                    streamsFinales.push({
                        name: "Vynx Flixer",
                        title: "Flixer Engine WASM Stream (HLS Proxy)",
                        url: PROXY_BASE + "/stream/?url=" + encodeURIComponent(flixerUrl) + "&source=2embed&referer=https%3A%2F%2Ftv.vynx.cc%2F",
                        quality: "1080p/4K",
                        headers: headersBase
                    });
                }
                resolve(streamsFinales); // Entregamos la colección limpia a Nuvio
            })
            .catch(function() {
                resolve(streamsFinales); // Si falla la red de algún extractor, entregamos lo recolectado
            });
    });
}

// Mapeo seguro para compatibilidad absoluta con Nuvio App
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
} else if (typeof window !== 'undefined') {
    window.getStreams = getStreams;
}
