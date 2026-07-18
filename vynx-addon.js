/**
 * Scraper oficial de Vynx para Nuvio
 * Retorna las promesas de streams de video de forma limpia
 */

var PROXY_BASE = "https://workers.dev";
var VYNX_BASE = "https://vynx.cc";

function getStreams(tmdbId, mediaType, season, episode) {
    var sNum = season || 1;
    var eNum = episode || 1;
    var typeClean = mediaType || "movie";
    var vType = typeClean === "series" ? "tv" : "movie";
    var streamsFinales = [];

    var headersBase = { 
        "Referer": VYNX_BASE + "/", 
        "Origin": VYNX_BASE,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    if (typeClean === "anime") {
        return fetch(PROXY_BASE + "/hianime/extract?malId=" + tmdbId + "&episode=" + eNum, { headers: headersBase })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data && data.url) {
                    streamsFinales.push({
                        name: "Vynx Anime",
                        title: "HiAnime Server-Side Decrypt",
                        url: PROXY_BASE + "/hianime/stream?url=" + encodeURIComponent(data.url),
                        quality: "1080p",
                        headers: headersBase
                    });
                }
                return streamsFinales;
            })
            .catch(function() { return []; });
    }

    var tvParams = vType === "tv" ? "&season=" + sNum + "&episode=" + eNum : "";
    var urlShadowlands = VYNX_BASE + "/api/extract-shadowlands?tmdbId=" + tmdbId + tvParams;

    return fetch(urlShadowlands, { headers: headersBase })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.success && data.streamUrl) {
                streamsFinales.push({
                    name: "Vynx Shadowlands",
                    title: "Shadowlands HTTP Direct Link",
                    url: VYNX_BASE + "/api/stream-proxy?url=" + encodeURIComponent(data.streamUrl) + "&source=shadowlands",
                    quality: "1080p Auto",
                    headers: { "Referer": "https://embed.su", "Origin": "https://embed.su" }
                });
            }
            var urlFlixer = PROXY_BASE + "/flixer/extract?tmdbId=" + tmdbId + "&type=" + vType + "&season=" + sNum + "&episode=" + eNum + "&server=alpha";
            return fetch(urlFlixer, { headers: headersBase });
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.url) {
                streamsFinales.push({
                    name: "Vynx Flixer",
                    title: "Flixer Engine WASM Mirror",
                    url: PROXY_BASE + "/stream/?url=" + encodeURIComponent(data.url) + "&source=2embed&referer=" + encodeURIComponent(VYNX_BASE + "/"),
                    quality: "1080p/4K",
                    headers: headersBase
                });
            }
            return streamsFinales;
        })
        .catch(function() {
            return streamsFinales;
        });
}

// Exportamos de ambas formas para asegurar compatibilidad total con Nuvio
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
}
