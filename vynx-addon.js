/**
 * Addon Universal de Vynx para Nuvio
 * Motor de Producción: Shadowlands Chain API + Multi-Provider + Live TV (DLHD)
 */

const PROXY_BASE = "https://workers.dev";
const VYNX_BASE = "https://vynx.cc";

const AddonManifest = {
    id: "vynx-shadowlands-provider",
    name: "Vynx Mega-Provider (Shadowlands)",
    version: "3.0.0",
    description: "Acceso total a Shadowlands Chain (VidSrc.xyz), Flixer, HiAnime y Live TV",
    icon: "https://vynx.cc/favicon.ico"
};

// Generador de sesiones dinámicas para el buscador de Vynx
function generateVynxSession() {
    const session = {
        sessionId: `session_${Math.random().toString(36).substr(2, 9)}-779f-4eaf-b206-adde479642e`,
        timestamp: Date.now()
    };
    return encodeURIComponent(JSON.stringify(session));
}

// 1. BUSCADOR INTEGRADO (Películas, Series, Anime y Canales de TV)
async function handleSearch(query, type = "movie", page = 1) {
    try {
        let url = "";
        
        // Si el usuario solicita canales de televisión en vivo (DLHD, NTV, GlobeTV)
        if (type === "live" || type === "tv_channels") {
            url = `${VYNX_BASE}/api/providers`;
            const response = await fetch(url);
            const data = await response.json();
            return Object.entries(data.providers || {})
                .filter(([_, info]) => info.liveTvOnly && info.enabled)
                .map(([id, info]) => ({
                    id: `live_${id}`,
                    title: info.name,
                    description: info.description || "Canal de TV en Vivo",
                    type: "live"
                }));
        }

        // Buscador de Anime (HiAnime / AllAnime Pipeline)
        if (type === "anime") {
            url = `${VYNX_BASE}/api/content/anime-search?page=${page}&limit=24&order_by=members&q=${encodeURIComponent(query)}`;
        } else {
            // Buscador estándar de Películas y Series
            const sessionToken = generateVynxSession();
            url = `${VYNX_BASE}/api/content/search?query=${encodeURIComponent(query)}&page=${page}&sessionId=${sessionToken}&type=${type}&excludeAnime=true`;
        }

        const response = await fetch(url, { headers: { "Referer": VYNX_BASE + "/" } });
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.results || []);
        
        return items.map(item => ({
            id: String(item.id || item.tmdbId || item.malId),
            title: item.title || item.name || item.title_english,
            poster: item.poster_path ? `https://tmdb.org{item.poster_path}` : (item.image || item.main_picture?.medium),
            type: type
        }));
    } catch (error) {
        return [];
    }
}

// 2. EXTRACTOR MULTI-MOTOR EN PARALELO (Shadowlands, Flixer, VidSrc y HiAnime)
async function handleGetSources(contentId, type = "movie", season = 1, episode = 1) {
    const streamsFinales = [];
    const vType = type === "tv" ? "tv" : "movie";
    
    // Encabezados de evasión de bloqueos analizados de las extensiones y el proxy
    const headersBase = { 
        "Referer": VYNX_BASE + "/", 
        "Origin": VYNX_BASE,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors"
    };

    // MÓDULO A: TELEVISIÓN EN VIVO (DLHD NATIVO)
    if (contentId.startsWith("live_")) {
        const channelId = contentId.replace("live_", "");
        streamsFinales.push({
            name: "Vynx Live",
            title: `TV en Vivo (${channelId.toUpperCase()}) - DLHD Proxy`,
            url: `${PROXY_BASE}/dlhd?channel=${channelId}`,
            quality: "HD",
            headers: headersBase
        });
        return streamsFinales;
    }

    // MÓDULO B: ANIME (PIPELINE SERVER-SIDE)
    if (type === "anime") {
        try {
            const resAnime = await fetch(`${PROXY_BASE}/hianime/extract?malId=${contentId}&episode=${episode}`, { headers: headersBase });
            const dataAnime = await resAnime.json();
            if (dataAnime && dataAnime.url) {
                streamsFinales.push({
                    name: "Vynx Anime",
                    title: "HiAnime (Sub/Dub) - MegaCloud Pipeline",
                    url: `${PROXY_BASE}/hianime/stream?url=${encodeURIComponent(dataAnime.url)}`,
                    quality: "1080p",
                    headers: { ...headersBase, "Referer": "https://kwik.cx" }
                });
            }
        } catch(e) {}
        return streamsFinales;
    }

    // MÓDULO C: PELÍCULAS Y SERIES TRADICIONALES (Consultas simultáneas)
    const promesas = [
        // 1. NUEVO MOTOR: Shadowlands Chain API (Extraído de tu documentación)
        fetch(`${VYNX_BASE}/api/extract-shadowlands?tmdbId=${contentId}${vType === "tv" ? `&season=${season}&episode=${episode}` : ""}`, { headers: headersBase })
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.streamUrl) {
                    // Aplicamos la máscara e inyección de cabeceras hacia embed.su descrita en el manual
                    streamsFinales.push({
                        name: "Vynx Shadowlands",
                        title: "Shadowlands Chronis (VidSrc.xyz HTTP Direct)",
                        url: `${VYNX_BASE}/api/stream-proxy?url=${encodeURIComponent(data.streamUrl)}&source=shadowlands`,
                        quality: "1080p Auto",
                        headers: { ...headersBase, "Referer": "https://embed.su/", "Origin": "https://embed.su" }
                    });
                }
            }).catch(() => {}),

        // 2. MOTOR FLIXER (Decodificación WebAssembly)
        fetch(`${PROXY_BASE}/flixer/extract?tmdbId=${contentId}&type=${vType}&season=${season}&episode=${episode}&server=alpha`, { headers: headersBase })
            .then(res => res.json())
            .then(data => {
                if (data && data.url) {
                    streamsFinales.push({
                        name: "Vynx Flixer",
                        title: "Flixer Engine (Hexa WASM Network)",
                        url: `${PROXY_BASE}/stream/?url=${encodeURIComponent(data.url)}&source=2embed&referer=${encodeURIComponent(VYNX_BASE + "/")}`,
                        quality: "1080p/4K",
                        headers: headersBase
                    });
                }
            }).catch(() => {}),

        // 3. MOTOR VIDSRC ALTERNATIVO (No-Captcha API)
        fetch(`${PROXY_BASE}/vidsrc/extract?tmdbId=${contentId}&type=${vType}&season=${season}&episode=${episode}`, { headers: headersBase })
            .then(res => res.json())
            .then(data => {
                if (data && data.url) {
                    streamsFinales.push({
                        name: "Vynx VidSrc",
                        title: "VidSrc Alternative Multi-Mirror",
                        url: `${PROXY_BASE}/vidsrc/stream?url=${encodeURIComponent(data.url)}`,
                        quality: "Auto Adaptive",
                        headers: headersBase
                    });
                }
            }).catch(() => {})
    ];

    // Esperamos las respuestas de todos los motores para poblar las opciones del reproductor
    await Promise.allSettled(promesas);
    return streamsFinales;
}

export default {
    manifest: AddonManifest,
    search: handleSearch,
    getSources: handleGetSources
};
