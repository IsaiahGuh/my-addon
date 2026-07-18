/**
 * Scraper oficial de Vynx para la aplicación Nuvio
 * Arquitectura de empaquetado nativa y conversión de IDs (HiAnime/Flixer Standard)
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

// Exportación obligatoria exigida por el hilo principal de Nuvio
var vynx_exports = {};
__export(vynx_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(vynx_exports);

// Servidores del backend de Vynx
var PROXY_BASE = "https://workers.dev";
var VYNX_BASE = "https://vynx.cc";
var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*"
};

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    var sNum = season || 1;
    var eNum = episode || 1;
    var typeClean = mediaType || "movie";
    var streamsFinales = [];

    // Corrección de IDs: Si Nuvio pasa un ID que no empieza con 'tt', le agregamos el prefijo 
    // para que el mapa técnico del Worker de VidSrc/Shadowlands lo reconozca al instante
    var cleanId = String(tmdbId);
    if (cleanId.indexOf("tt") === -1 && (typeClean === "series" || typeClean === "tv")) {
        cleanId = "tt" + cleanId;
    }

    var headersBase = {
      "Referer": VYNX_BASE + "/",
      "Origin": VYNX_BASE,
      "User-Agent": DEFAULT_HEADERS["User-Agent"]
    };

    // MOTOR 1: PIPELINE DE ANIME (HiAnime / AllAnime)
    if (typeClean === "anime") {
      try {
        var urlAnime = `${PROXY_BASE}/hianime/extract?malId=${tmdbId}&episode=${eNum}`;
        var resAnime = yield fetch(urlAnime, { headers: headersBase });
        if (resAnime.ok) {
          var dataAnime = yield resAnime.json();
          var videoUrl = dataAnime.url || (dataAnime.stream && dataAnime.stream.url);
          if (videoUrl) {
            streamsFinales.push({
              name: "Vynx Anime",
              title: `Anime Stream - Episode ${eNum} (Sub/Dub)`,
              url: `${PROXY_BASE}/hianime/stream?url=${encodeURIComponent(videoUrl)}`,
              quality: "1080p",
              headers: headersBase,
              provider: "vynx",
              type: "m3u8"
            });
          }
        }
      } catch (e) {
        console.log(`[Vynx] Anime failed: ${e.message}`);
      }
      return streamsFinales;
    }

    // MOTOR 2: PELÍCULAS Y SERIES (Shadowlands, VidSrc, Flixer)
    var vType = typeClean === "series" || typeClean === "tv" ? "tv" : "movie";

    // Sub-proceso A: Consulta dirigida al LoadBalancer de VidSrc (No-Turnstile)
    try {
      var urlVidSrc = `${PROXY_BASE}/vidsrc/extract?tmdbId=${cleanId}&type=${vType}&season=${sNum}&episode=${eNum}`;
      var resVid = yield fetch(urlVidSrc, { headers: headersBase });
      if (resVid.ok) {
        var textVid = yield resVid.text();
        var dataVid = {};
        try { dataVid = JSON.parse(textVid); } catch(err) { dataVid = { url: textVid }; }
        
        var linkVid = dataVid.url || dataVid.streamUrl || "";
        if (linkVid && linkVid.indexOf("http") === 0 && linkVid.indexOf("DOCTYPE") === -1) {
          streamsFinales.push({
            name: "Vynx Multi-Source",
            title: "VidSrc No-Captcha Stream (Adaptive Quality)",
            url: `${PROXY_BASE}/vidsrc/stream?url=${encodeURIComponent(linkVid)}`,
            quality: "Auto",
            headers: headersBase,
            provider: "vynx",
            type: "m3u8"
          });
        }
      }
    } catch (e) {
      console.log(`[Vynx] VidSrc failed: ${e.message}`);
    }

    // Sub-proceso B: Consulta dirigida a Flixer (WASM Engine)
    try {
      var urlFlixer = `${PROXY_BASE}/flixer/extract?tmdbId=${cleanId}&type=${vType}&season=${sNum}&episode=${eNum}&server=alpha`;
      var resFlix = yield fetch(urlFlixer, { headers: headersBase });
      if (resFlix.ok) {
        var textFlix = yield resFlix.text();
        var dataFlix = {};
        try { dataFlix = JSON.parse(textFlix); } catch(err) { dataFlix = { url: textFlix }; }

        var linkFlix = dataFlix.url || "";
        if (linkFlix && linkFlix.indexOf("http") === 0 && linkFlix.indexOf("DOCTYPE") === -1) {
          streamsFinales.push({
            name: "Vynx Flixer",
            title: "Flixer Engine WASM Stream",
            url: `${PROXY_BASE}/stream/?url=${encodeURIComponent(linkFlix)}&source=2embed&referer=https%3A%2F%2Ftv.vynx.cc%2F`,
            quality: "1080p",
            headers: headersBase,
            provider: "vynx",
            type: "m3u8"
          });
        }
      }
    } catch (e) {
      console.log(`[Vynx] Flixer failed: ${e.message}`);
    }

    return streamsFinales;
  });
}
