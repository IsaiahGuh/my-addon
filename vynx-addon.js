/**
 * Scraper oficial de Vynx para la aplicación Nuvio
 * Estructura nativa basada en la función obligatoria getStreams(tmdbId, mediaType, season, episode)
 */

var PROXY_BASE = "https://workers.dev";
var VYNX_BASE = "https://vynx.cc";

function getStreams(tmdbId, mediaType, season, episode) {
    var sNum = season || 1;
    var eNum = episode || 1;
    var typeClean = mediaType || "movie";
    var vType = typeClean === "series" ? "tv" : "movie";
    var streamsFinales = [];

    // Encabezados de evasión de bloqueos obligatorios para la infraestructura Vynx
    var headersBase = { 
        "Referer": VYNX_BASE + "/", 
        "Origin": VYNX_BASE,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors"
    };

    // Caso A: Si el tipo es Anime, consultamos el pipeline directo de HiAnime
    if (typeClean === "anime") {
        return fetch(PROXY_BASE + "/hianime/extract?malId=" + tmdbId + "&episode=" + eNum, { headers: headersBase })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data && data.url) {
                    streamsFinales.push({
                        name: "Vynx Anime",
                        title: "HiAnime Server-Side Decrypt (Sub/Dub)",
                        url: PROXY_BASE + "/hianime/stream?url=" + encodeURIComponent(data.url),
                        quality: "1080p",
                        headers: headersBase
                    });
                }
                return streamsFinales;
            })
            .catch(function() { return []; });
    }

    // Caso B: Películas y Series tradicionales (Ejecución encadenada compatible con Hermes)
    var tvParams = vType === "tv" ? "&season=" + sNum + "&episode=" + eNum : "";
    var urlShadowlands = VYNX_BASE + "/api/extract-shadowlands?tmdbId=" + tmdbId + tvParams;

    // Primer intento: Motor Shadowlands Chain API
    return fetch(urlShadowlands, { headers: headersBase })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.success && data.streamUrl) {
                streamsFinales.push({
                    name: "Vynx Shadowlands",
                    title: "Shadowlands (VidSrc Direct HTTP Link)",
                    url: VYNX_BASE + "/api/stream-proxy?url=" + encodeURIComponent(data.streamUrl) + "&source=shadowlands",
                    quality: "1080p Auto",
                    headers: { "Referer": "https://embed.su", "Origin": "https://embed.su" }
                });
            }
            // Segundo intento continuo: Motor Flixer Engine (WASM Network)
            var urlFlixer = PROXY_BASE + "/flixer/extract?tmdbId=" + tmdbId + "&type=" + vType + "&season=" + sNum + "&episode=" + eNum + "&server=alpha";
            return fetch(urlFlixer, { headers: headersBase });
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.url) {
                streamsFinales.push({
                    name: "Vynx Flixer",
                    title: "Flixer Engine (Hexa Multi-Mirror)",
                    url: PROXY_BASE + "/stream/?url=" + encodeURIComponent(data.url) + "&source=2embed&referer=" + encodeURIComponent(VYNX_BASE + "/"),
                    quality: "1080p/4K",
                    headers: headersBase
                });
            }
            // Tercer intento continuo: VidSrc Alternative Multi-Mirror
            var urlVidSrc = PROXY_BASE + "/vidsrc/extract?tmdbId=" + tmdbId + "&type=" + vType + "&season=" + sNum + "&episode=" + eNum;
            return fetch(urlVidSrc, { headers: headersBase });
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.url) {
                streamsFinales.push({
                    name: "Vynx VidSrc",
                    title: "VidSrc LoadBalancer (No Captcha)",
                    url: PROXY_BASE + "/vidsrc/stream?url=" + encodeURIComponent(data.url),
                    quality: "Auto Adaptive",
                    headers: headersBase
                });
            }
            return streamsFinales; // Retorna la colección total mapeada que exige Nuvio
        })
        .catch(function() {
            return streamsFinales; // Retorna lo acumulado en caso de fallas de red externas
        });
}

// Exportación obligatoria del módulo para Nuvio
module.exports = { getStreams: getStreams };
