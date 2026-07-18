/**
 * Scraper oficial de Vynx para la aplicación Nuvio
 * Basado en la arquitectura de empaquetado oficial del 2026 (Dooflix Standard)
 */

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;

var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};

var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// Configuración del módulo para el cargador de Nuvio (Idéntico a Dooflix)
var vynx_exports = {};
__export(vynx_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(vynx_exports);

// Constantes de red del Worker de Vynx
var PROXY_BASE = "https://workers.dev";
var VYNX_BASE = "https://vynx.cc";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Función extractora que Nuvio llamará de forma nativa
function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    console.log(`[Vynx] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
    
    var sNum = season || 1;
    var eNum = episode || 1;
    var vType = mediaType === "series" || mediaType === "tv" ? "tv" : "movie";
    var streams = [];

    var headersBase = { 
      "Referer": VYNX_BASE + "/", 
      "Origin": VYNX_BASE,
      "User-Agent": USER_AGENT
    };

    // MOTOR 1: EXTRACTOR VIDSRC (NO-CAPTCHA)
    try {
      var urlVidSrc = `${PROXY_BASE}/vidsrc/extract?tmdbId=${tmdbId}&type=${vType}&season=${sNum}&episode=${eNum}`;
      var resVid = yield fetch(urlVidSrc, { headers: headersBase });
      
      if (resVid.ok) {
        var textVid = yield resVid.text();
        var dataVid = {};
        try { dataVid = JSON.parse(textVid); } catch(e) { dataVid = { url: textVid }; }
        
        var linkVid = dataVid.url || dataVid.streamUrl || "";
        if (linkVid && linkVid.indexOf("http") === 0 && linkVid.indexOf("DOCTYPE") === -1) {
          streams.push({
            name: "Vynx Multi-Source",
            title: "VidSrc LoadBalancer (No-Captcha Engine)",
            url: `${PROXY_BASE}/vidsrc/stream?url=${encodeURIComponent(linkVid)}`,
            quality: "Auto HD",
            headers: headersBase,
            provider: "vynx" // Obligatorio para Nuvio
          });
        }
      }
    } catch (err) {
      console.log(`[Vynx] VidSrc extraction failed: ${err.message}`);
    }

    // MOTOR 2: EXTRACTOR FLIXER (WASM)
    try {
      var urlFlixer = `${PROXY_BASE}/flixer/extract?tmdbId=${tmdbId}&type=${vType}&season=${sNum}&episode=${eNum}&server=alpha`;
      var resFlix = yield fetch(urlFlixer, { headers: headersBase });
      
      if (resFlix.ok) {
        var textFlix = yield resFlix.text();
        var dataFlix = {};
        try { dataFlix = JSON.parse(textFlix); } catch(e) { dataFlix = { url: textFlix }; }

        var linkFlix = dataFlix.url || "";
        if (linkFlix && linkFlix.indexOf("http") === 0 && linkFlix.indexOf("DOCTYPE") === -1) {
          streams.push({
            name: "Vynx Flixer",
            title: "Flixer Engine WASM Stream (HLS Proxy)",
            url: `${PROXY_BASE}/stream/?url=${encodeURIComponent(linkFlix)}&source=2embed&referer=https%3A%2F%2Ftv.vynx.cc%2F`,
            quality: "1080p/4K",
            headers: headersBase,
            provider: "vynx" // Obligatorio para Nuvio
          });
        }
      }
    } catch (err) {
      console.log(`[Vynx] Flixer extraction failed: ${err.message}`);
    }

    return streams;
  });
}
