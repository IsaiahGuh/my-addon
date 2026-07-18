"use strict";

// 1. Inyección de Helpers de compatibilidad nativa para el motor Hermes de Nuvio
var __defProp = Object.defineProperty;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  return a;
};

// El emulador de asincronía oficial que Nuvio requiere para procesar las peticiones de red
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// 2. Variables de Configuración de la Infraestructura Vynx
var PROXY_BASE = "https://workers.dev";
var VYNX_BASE = "https://vynx.cc";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36";

// 3. Función Principal del Scraper (getStreams) usando el emulador de Yoru
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const sNum = season || 1;
    const eNum = episode || 1;
    const typeClean = mediaType || "movie";
    const vType = typeClean === "series" ? "tv" : "movie";
    const streamsFinales = [];

    const headersBase = { 
      "Referer": VYNX_BASE + "/", 
      "Origin": VYNX_BASE,
      "User-Agent": USER_AGENT
    };

    // MÓDULO A: TRANSMISIONES DE ANIME
    if (typeClean === "anime") {
      try {
        const urlAnime = `${PROXY_BASE}/hianime/extract?malId=${tmdbId}&episode=${eNum}`;
        const response = yield fetch(urlAnime, { headers: headersBase });
        const data = yield response.json();
        const videoUrl = data.url || (data.stream && data.stream.url);
        
        if (videoUrl) {
          streamsFinales.push({
            name: "Vynx Anime",
            title: "HiAnime (MegaCloud Server Decrypt)",
            url: `${PROXY_BASE}/hianime/stream?url=${encodeURIComponent(videoUrl)}`,
            quality: "1080p",
            headers: headersBase
          });
        }
      } catch (e) {
        console.log(`[Vynx Addon] Anime extraction failed: ${e.message}`);
      }
      return streamsFinales;
    }

    // MÓDULO B: PELÍCULAS Y SERIES TRADICIONALES
    const tvParams = vType === "tv" ? `&season=${sNum}&episode=${eNum}` : "";
    const urlShadowlands = `${VYNX_BASE}/api/extract-shadowlands?tmdbId=${tmdbId}${tvParams}`;

    // Sub-proceso 1: Intento de extracción vía Shadowlands Chain API
    try {
      const resShadow = yield fetch(urlShadowlands, { headers: headersBase });
      const dataShadow = yield resShadow.json();
      
      if (dataShadow && dataShadow.success && dataShadow.streamUrl) {
        streamsFinales.push({
          name: "Vynx Shadowlands",
          title: "Shadowlands (VidSrc HTTP Direct Link)",
          url: `${VYNX_BASE}/api/stream-proxy?url=${encodeURIComponent(dataShadow.streamUrl)}&source=shadowlands`,
          quality: "1080p Auto",
          headers: { "Referer": "https://embed.su", "Origin": "https://embed.su" }
        });
      }
    } catch (e) {
      console.log(`[Vynx Addon] Shadowlands bypass failed: ${e.message}`);
    }

    // Sub-proceso 2: Intento de extracción vía VidSrc No-Turnstile Engine
    try {
      const urlVidSrc = `${PROXY_BASE}/vidsrc/extract?tmdbId=${tmdbId}&type=${vType}&season=${sNum}&episode=${eNum}`;
      const resVid = yield fetch(urlVidSrc, { headers: headersBase });
      const textVid = yield resVid.text();
      let dataVid = {};
      
      try { dataVid = JSON.parse(textVid); } catch(err) { dataVid = { url: textVid }; }
      
      const extractedUrl = dataVid.url || dataVid.streamUrl || (typeof dataVid === "string" ? dataVid : "");
      if (extractedUrl && extractedUrl.indexOf("http") !== -1 && extractedUrl.indexOf("DOCTYPE") === -1) {
        streamsFinales.push({
          name: "Vynx VidSrc",
          title: "VidSrc LoadBalancer (No-Captcha Engine)",
          url: `${PROXY_BASE}/vidsrc/stream?url=${encodeURIComponent(extractedUrl)}`,
          quality: "Auto HD",
          headers: headersBase
        });
      }
    } catch (e) {
      console.log(`[Vynx Addon] VidSrc bypass failed: ${e.message}`);
    }

    // Sub-proceso 3: Intento de extracción vía Flixer WASM Network
    try {
      const urlFlixer = `${PROXY_BASE}/flixer/extract?tmdbId=${tmdbId}&type=${vType}&season=${sNum}&episode=${eNum}&server=alpha`;
      const resFlix = yield fetch(urlFlixer, { headers: headersBase });
      const textFlix = yield resFlix.text();
      let dataFlix = {};

      try { dataFlix = JSON.parse(textFlix); } catch(err) { dataFlix = { url: textFlix }; }

      const flixerUrl = dataFlix.url || (typeof dataFlix === "string" ? dataFlix : "");
      if (flixerUrl && flixerUrl.indexOf("http") !== -1 && flixerUrl.indexOf("DOCTYPE") === -1) {
        streamsFinales.push({
          name: "Vynx Flixer",
          title: "Flixer Engine WASM Stream (HLS Proxy)",
          url: `${PROXY_BASE}/stream/?url=${encodeURIComponent(flixerUrl)}&source=2embed&referer=https%3A%2F%2Ftv.vynx.cc%2F`,
          quality: "1080p/4K",
          headers: headersBase
        });
      }
    } catch (e) {
      console.log(`[Vynx Addon] Flixer bypass failed: ${e.message}`);
    }

    return streamsFinales; // Devolvemos el arreglo completo a la interfaz de Nuvio
  });
}

// 4. Exportación compatible exigida por el cargador de módulos de Nuvio
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else if (typeof global !== "undefined") {
  global.getStreams = getStreams;
} else if (typeof window !== "undefined") {
  window.getStreams = getStreams;
}
