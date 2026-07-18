/**
 * Addon Universal de Vynx para Nuvio
 * Versión de Producción compatible con el motor Hermes (Sin async/await nativo)
 */

var PROXY_BASE = "https://workers.dev";
var VYNX_BASE = "https://vynx.cc";

var AddonManifest = {
    id: "vynx-shadowlands-provider",
    name: "Vynx Mega-Provider (Hermes)",
    version: "3.1.0",
    description: "Acceso total a Shadowlands Chain, Flixer, HiAnime y TV en Vivo sin errores de motor",
    icon: "https://vynx.cc/favicon.ico"
};

function generateVynxSession() {
    var timestamp = Date.now();
    var randomStr = Math.random().toString(36).substr(2, 9);
    var session = {
        sessionId: "session_" + randomStr + "-779f-4eaf-b206-adde479642e",
        timestamp: timestamp
    };
    return encodeURIComponent(JSON.stringify(session));
}

// 1. BUSCADOR INTEGRADO COMPATIBLE
function handleSearch(query, type, page) {
    var currentPage = page || 1;
    var contentType = type || "movie";
    var url = "";

    if (contentType === "live" || contentType === "tv_channels") {
        url = VYNX_BASE + "/api/providers";
        return fetch(url)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var providers = data.providers || {};
                var results = [];
                for (var id in providers) {
                    if (providers[id].liveTvOnly && providers[id].enabled) {
                        results.push({
                            id: "live_" + id,
                            title: providers[id].name,
                            description: providers[id].description || "Canal en Vivo",
                            type: "live"
                        });
                    }
                }
                return results;
            })
            .catch(function() { return []; });
    }

    if (contentType === "anime") {
        url = VYNX_BASE + "/api/content/anime-search?page=" + currentPage + "&limit=24&order_by=members&q=" + encodeURIComponent(query);
    } else {
        var sessionToken = generateVynxSession();
        url = VYNX_BASE + "/api/content/search?query=" + encodeURIComponent(query) + "&page=" + currentPage + "&sessionId=" + sessionToken + "&type=" + contentType + "&excludeAnime=true";
    }

    return fetch(url, { headers: { "Referer": VYNX_BASE + "/" } })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var items = Array.isArray(data) ? data : (data.results || []);
            return items.map(function(item) {
                return {
                    id: String(item.id || item.tmdbId || item.malId),
                    title: item.title || item.name || item.title_english,
                    poster: item.poster_path ? "https://tmdb.org" + item.poster_path : (item.image || (item.main_picture && item.main_picture.medium)),
                    type: contentType
                };
            });
        })
        .catch(function() { return []; });
}

// 2. EXTRACTOR EN CADENA COMPATIBLE CON HERMES (FALBACK AUTOMÁTICO)
function handleGetSources(contentId, type, season, episode) {
    var sNum = season || 1;
    var eNum = episode || 1;
    var cType = type || "movie";
    var vType = cType === "tv" ? "tv" : "movie";
    var streamsFinales = [];

    var headersBase = { 
        "Referer": VYNX_BASE + "/", 
        "Origin": VYNX_BASE,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors"
    };

    if (contentId.indexOf("live_") === 0) {
        var channelId = contentId.replace("live_", "");
        streamsFinales.push({
            name: "Vynx Live",
            title: "TV en Vivo (" + channelId.toUpperCase() + ") - DLHD Proxy",
            url: PROXY_BASE + "/dlhd?channel=" + channelId,
            quality: "HD",
            headers: headersBase
        });
        return Promise.resolve(streamsFinales);
    }

    if (cType === "anime") {
        return fetch(PROXY_BASE + "/hianime/extract?malId=" + contentId + "&episode=" + eNum, { headers: headersBase })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data && data.url) {
                    streamsFinales.push({
                        name: "Vynx Anime",
                        title: "HiAnime Pipeline Stream",
                        url: PROXY_BASE + "/hianime/stream?url=" + encodeURIComponent(data.url),
                        quality: "1080p",
                        headers: headersBase
                    });
                }
                return streamsFinales;
            })
            .catch(function() { return []; });
    }

    // Ejecución secuencial segura de promesas para evitar congelamientos en Hermes
    var tvParams = vType === "tv" ? "&season=" + sNum + "&episode=" + eNum : "";
    var urlShadowlands = VYNX_BASE + "/api/extract-shadowlands?tmdbId=" + contentId + tvParams;

    return fetch(urlShadowlands, { headers: headersBase })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.success && data.streamUrl) {
                streamsFinales.push({
                    name: "Vynx Shadowlands",
                    title: "Shadowlands (VidSrc Direct HTTP)",
                    url: VYNX_BASE + "/api/stream-proxy?url=" + encodeURIComponent(data.streamUrl) + "&source=shadowlands",
                    quality: "1080p Auto",
                    headers: { "Referer": "https://embed.su", "Origin": "https://embed.su" }
                });
            }
            // Intentar el segundo motor (Flixer) inmediatamente después
            var urlFlixer = PROXY_BASE + "/flixer/extract?tmdbId=" + contentId + "&type=" + vType + "&season=" + sNum + "&episode=" + eNum + "&server=alpha";
            return fetch(urlFlixer, { headers: headersBase });
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.url) {
                streamsFinales.push({
                    name: "Vynx Flixer",
                    title: "Flixer Engine (Hexa WASM Network)",
                    url: PROXY_BASE + "/stream/?url=" + encodeURIComponent(data.url) + "&source=2embed&referer=" + encodeURIComponent(VYNX_BASE + "/"),
                    quality: "1080p/4K",
                    headers: headersBase
                });
            }
            return streamsFinales;
        })
        .catch(function() {
            // Retorna lo que se haya recolectado si ocurre una falla en la cadena
            return streamsFinales;
        });
}

module.exports = {
    manifest: AddonManifest,
    search: handleSearch,
    getSources: handleGetSources
};
