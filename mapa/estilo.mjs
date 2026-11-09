// Estilo "Roldanillo en miniatura" para MapLibre: traducción de scripts/estilo_tarjeta.py, capa por capa
// y en el mismo orden. Las medidas de terreno van en metros (metros.mjs) para verse como en la tarjeta.
import { metros, trazos } from "./metros.mjs";

const NEGRO = "#222222";
const BLANCO = "#ffffff";
const NADA = "rgba(0,0,0,0)";
// tamaño lógico (px) de las imágenes de imagenes.mjs: icon-size = metros de terreno / este tamaño
export const PX_FLECHA = 16;
export const PX_CHEVRON = 16;

// paletas: color (tarjeta) y colorear (líneas negras sobre blanco, estilo_tarjeta.py:303-366)
const PALETAS = {
  color: {
    fondo: "#fbf6ea", manzanas: "#efe6d2", manzanasBorde: NADA, calzada: "#6b6f73", calzadaBorde: NADA,
    andenes: "#d8d2c6", andenesBorde: "#b9b2a4",
    destapadas: "rgba(200,160,110,0.9)", destapadasPunto: "#a57c4c",
    cauce: "#3d8fd1", orilla: "#8cc8f0", canada: "#5aa3d8", anchoCauce: 4.5, anchoOrilla: 2.2, anchoCanada: 1.0,
    ejes: "#f4f1e8", anchoEjes: 0.35,
    parques: "#bfe3a0", parquesBorde: "#8cc06a", anchoParquesBorde: 0.4, parquesTrazo: null,
    techos: ["get", "color"], techosBorde: ["get", "borde"], sombras: true,
    sombraTecho: "rgba(0,0,0,0.27)", sombraCopa: "rgba(0,0,0,0.25)",
    copas: ["get", "color"], copasBorde: "#2c6322", brillo: "#86c964",
    techosTenue: ["get", "color"], copasTenue: ["get", "color"],
    transitoBorde: BLANCO, transitoCarril: "#6b6f73", anchoBorde: 3.4, anchoCarril: 2.6, transitoLinea: "#ffd23f",
    glorietas: ["get", "color"], glorietasBorde: BLANCO,
    referencias: ["match", ["get", "clase"], "campo", "#7fb069", "pista", "#e0a040", "rgba(255,240,200,0.35)"],
    referenciasBorde: ["match", ["get", "clase"], "campo", BLANCO, "pista", "#8a5a1a", NADA],
    referenciasTrazo: "#c9a54a", textoReferencia: "#5a3d0c", halo: "#fffaf0",
    velo: "rgba(255,253,246,0.65)", seleccion: "#e8590c", sector: "#e8590c",
    textoSector: "#8a4a12", textoBarrio: "#3a2a14", haloBarrio: "#fbf6ea", placaTexto: BLANCO,
  },
  colorear: {
    fondo: BLANCO, manzanas: BLANCO, manzanasBorde: NEGRO, calzada: BLANCO, calzadaBorde: NEGRO,
    andenes: BLANCO, andenesBorde: NEGRO,
    destapadas: NADA, destapadasPunto: NEGRO,
    cauce: NEGRO, orilla: BLANCO, canada: NEGRO, anchoCauce: 4.4, anchoOrilla: 3.4, anchoCanada: 0.5,
    ejes: "#9a9a9a", anchoEjes: 0.3,
    parques: BLANCO, parquesBorde: NEGRO, anchoParquesBorde: 0.3, parquesTrazo: trazos(1.2, 0.3),
    techos: BLANCO, techosBorde: NEGRO, sombras: false, sombraTecho: NADA, sombraCopa: NADA,
    copas: BLANCO, copasBorde: NEGRO, brillo: NADA, techosTenue: "#cfcfcf", copasTenue: "#cfcfcf",
    transitoBorde: NEGRO, transitoCarril: BLANCO, anchoBorde: 3.0, anchoCarril: 2.3, transitoLinea: NADA,
    glorietas: BLANCO, glorietasBorde: NEGRO,
    // campo y pista en blanco; las zonas con pictograma transparentes, como en QGIS (no tapan los árboles)
    referencias: ["match", ["get", "clase"], "campo", BLANCO, "pista", BLANCO, NADA],
    referenciasBorde: NEGRO, referenciasTrazo: NEGRO, textoReferencia: NEGRO, halo: BLANCO,
    velo: "rgba(255,255,255,0.69)", seleccion: NEGRO, sector: NEGRO,
    textoSector: NEGRO, textoBarrio: NEGRO, haloBarrio: BLANCO, placaTexto: NEGRO,
  },
};

const BALOO = ["Baloo 2 ExtraBold"];
const NUNITO = ["Nunito ExtraBold"];
const DIBUJO = { "rodaditas:grupo": "dibujo" };
const ELEGIDO = ["boolean", ["feature-state", "elegido"], false];
const HAY_ELEGIDO = ["boolean", ["global-state", "hayElegido"], false];

// Capas pesadas (≈ 75 % de los datos): con diferir, empiezan vacías y el visor las llena después del
// primer dibujo (setData), para que la base (manzanas, calles, barrios, rótulos) aparezca antes.
export const PESADAS = ["techos", "techos_sombra", "copas", "copas_sombra", "copas_brillo"];
const VACIA = { type: "FeatureCollection", features: [] };

function capasGeojson(base, capas, diferir) {
  const fuentes = {};
  const diferidas = {};
  for (const nombre of capas) {
    const url = `${base}capas/${nombre}.geojson`;
    if (diferir && PESADAS.includes(nombre)) {
      diferidas[nombre] = url;
      fuentes[nombre] = { type: "geojson", data: VACIA };
    } else {
      fuentes[nombre] = { type: "geojson", data: url };
    }
  }
  return [fuentes, diferidas];
}

// borde de 1 px que aparece de a poco: con zoom bajo QGIS lo dibuja casi invisible (0,25 m)
const bordeGradual = (tenue, fuerte) => ["interpolate", ["linear"], ["zoom"], 15, tenue, 17, fuerte];

export function estilo(modo = "color", { base = "mapa/", datos = "datos/", capas, diferir = false } = {}) {
  const p = PALETAS[modo];
  if (!p) throw new Error(`modo desconocido: ${modo}`);
  if (!capas) throw new Error("estilo(): falta la lista de capas (indice.json)");
  const hay = new Set(capas);
  const s = (id) => `${id}-${modo}`; // imágenes por modo (imagenes.mjs)
  const dibujo = (capa) => ({ ...capa, metadata: DIBUJO });

  const capasMapa = [
    { id: "fondo", type: "background", paint: { "background-color": p.fondo } },
    dibujo({ id: "manzanas", type: "fill", source: "manzanas",
      paint: { "fill-color": p.manzanas, "fill-outline-color": p.manzanasBorde } }),
    dibujo({ id: "calzada", type: "fill", source: "calzada",
      paint: { "fill-color": p.calzada, "fill-outline-color": p.calzadaBorde } }),
    dibujo({ id: "andenes", type: "fill", source: "andenes",
      paint: { "fill-color": p.andenes, "fill-outline-color": p.andenesBorde } }),
    dibujo({ id: "destapadas", type: "line", source: "destapadas", layout: { "line-cap": "round" },
      paint: { "line-color": p.destapadas, "line-width": metros(5.5) } }),
    dibujo({ id: "destapadas-punto", type: "line", source: "destapadas",
      paint: { "line-color": p.destapadasPunto, "line-width": metros(0.5), "line-dasharray": [1, 2] } }),
    dibujo({ id: "canadas-cauce", type: "line", source: "canadas", filter: ["has", "nombre"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": p.cauce, "line-width": metros(p.anchoCauce) } }),
    dibujo({ id: "canadas-orilla", type: "line", source: "canadas", filter: ["has", "nombre"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": p.orilla, "line-width": metros(p.anchoOrilla) } }),
    dibujo({ id: "canadas-sin-nombre", type: "line", source: "canadas", filter: ["!", ["has", "nombre"]],
      paint: { "line-color": p.canada, "line-width": metros(p.anchoCanada), "line-dasharray": [4, 2] } }),
    dibujo({ id: "ejes", type: "line", source: "ejes",
      paint: { "line-color": p.ejes, "line-width": metros(p.anchoEjes), "line-dasharray": trazos(3, p.anchoEjes) } }),
    dibujo({ id: "parques", type: "fill", source: "parques", paint: { "fill-color": p.parques } }),
    dibujo({ id: "parques-borde", type: "line", source: "parques",
      paint: { "line-color": p.parquesBorde, "line-width": metros(p.anchoParquesBorde),
        ...(p.parquesTrazo ? { "line-dasharray": p.parquesTrazo } : {}) } }),
    dibujo({ id: "sentido", type: "symbol", source: "sentido",
      layout: { "symbol-placement": "line", "symbol-spacing": metros(45), "icon-image": s("flecha"),
        "icon-size": metros(5 / PX_FLECHA), "icon-rotation-alignment": "map",
        "icon-allow-overlap": true, "icon-ignore-placement": true } }),
    dibujo({ id: "techos-sombra", type: "fill", source: "techos_sombra",
      layout: { visibility: p.sombras ? "visible" : "none" }, paint: { "fill-color": p.sombraTecho } }),
    dibujo({ id: "techos", type: "fill", source: "techos",
      paint: { "fill-color": p.techos, "fill-outline-color": bordeGradual(p.techosTenue, p.techosBorde) } }),
    dibujo({ id: "copas-sombra", type: "fill", source: "copas_sombra",
      layout: { visibility: p.sombras ? "visible" : "none" }, paint: { "fill-color": p.sombraCopa } }),
    dibujo({ id: "copas", type: "fill", source: "copas",
      paint: { "fill-color": p.copas, "fill-outline-color": bordeGradual(p.copasTenue, p.copasBorde) } }),
    dibujo({ id: "copas-brillo", type: "fill", source: "copas_brillo",
      layout: { visibility: p.sombras ? "visible" : "none" }, paint: { "fill-color": p.brillo } }),
    dibujo({ id: "pendientes", type: "symbol", source: "pendientes",
      layout: { "icon-image": ["case", ["==", ["get", "n"], 2], s("chevron2"), s("chevron")],
        "icon-size": metros(5 / PX_CHEVRON), "icon-rotate": ["-", ["get", "rumbo"], 90],
        "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true } }),
  ];
  if (hay.has("transito_vias") && hay.has("transito_glorietas")) {
    capasMapa.push(
      dibujo({ id: "transito-borde", type: "line", source: "transito_vias",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.transitoBorde, "line-width": metros(p.anchoBorde) } }),
      dibujo({ id: "transito-carril", type: "line", source: "transito_vias",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.transitoCarril, "line-width": metros(p.anchoCarril) } }),
      dibujo({ id: "transito-linea", type: "line", source: "transito_vias",
        paint: { "line-color": p.transitoLinea, "line-width": metros(0.18), "line-dasharray": [4, 2] } }),
      dibujo({ id: "transito-glorietas", type: "fill", source: "transito_glorietas",
        paint: { "fill-color": p.glorietas, "fill-outline-color": p.glorietasBorde } }),
    );
  }
  capasMapa.push(
    dibujo({ id: "referencias", type: "fill", source: "referencias",
      paint: { "fill-color": p.referencias, "fill-outline-color": p.referenciasBorde } }),
    dibujo({ id: "referencias-borde", type: "line", source: "referencias",
      filter: ["==", ["get", "clase"], "pictograma"],
      paint: { "line-color": p.referenciasTrazo, "line-width": metros(0.3), "line-dasharray": [4, 2] } }),
    dibujo({ id: "referencias-pin", type: "symbol", source: "referencias_pin", minzoom: 17,
      layout: { "icon-image": ["concat", "pin-", ["get", "icono"], modo === "colorear" ? "-negro" : "", "-", modo],
        "icon-allow-overlap": true,
        "text-field": ["coalesce", ["get", "rotulo"], ""], "text-font": NUNITO, "text-size": 10.5,
        "text-anchor": "top", "text-offset": [0, 1.4], "text-max-width": 11, "text-optional": true },
      paint: { "text-color": p.textoReferencia, "text-halo-color": p.halo, "text-halo-width": 1.6 } }),
    dibujo({ id: "placas", type: "symbol", source: "ejes", minzoom: 17,
      filter: ["has", "placa"],
      layout: { "symbol-placement": "line", "symbol-spacing": metros(120),
        "text-field": ["get", "placa"], "text-font": BALOO, "text-size": 11,
        "text-rotation-alignment": "map", "text-keep-upright": true,
        "icon-image": s("placa"), "icon-text-fit": "both", "icon-text-fit-padding": [1, 4, 0, 4],
        "icon-rotation-alignment": "map" },
      paint: { "text-color": p.placaTexto } }),
    { id: "satelite", type: "raster", source: "satelite", layout: { visibility: "none" } },
    { id: "barrios-velo", type: "fill", source: "barrios",
      paint: { "fill-color": p.velo, "fill-opacity": ["case", ["all", HAY_ELEGIDO, ["!", ELEGIDO]], 1, 0] } },
    { id: "barrios-borde", type: "line", source: "barrios",
      paint: { "line-color": "#3a2a14", "line-opacity": 0.25, "line-width": 1, "line-dasharray": [2, 4] } },
    { id: "barrios-sel-blanco", type: "line", source: "barrios",
      paint: { "line-color": BLANCO, "line-width": 8, "line-opacity": ["case", ELEGIDO, 0.95, 0] } },
    { id: "barrios-sel-naranja", type: "line", source: "barrios", layout: { "line-cap": "butt" },
      paint: { "line-color": p.seleccion, "line-width": 4.5, "line-dasharray": [12 / 4.5, 8 / 4.5],
        "line-opacity": ["case", ELEGIDO, 1, 0] } },
    { id: "sectores-zona", type: "fill", source: "sectores", filter: ["==", ["get", "barrio"], ""],
      paint: { "fill-color": p.sector,
        "fill-opacity": ["case", ["boolean", ["feature-state", "activo"], false], 0.35, 0.12] } },
    { id: "sectores-zona-borde", type: "line", source: "sectores", filter: ["==", ["get", "barrio"], ""],
      paint: { "line-color": ["case", ["boolean", ["feature-state", "activo"], false], BLANCO, p.sector],
        "line-width": ["case", ["boolean", ["feature-state", "activo"], false], 5, 2.5],
        "line-dasharray": [6 / 2.5, 5 / 2.5] } },
    { id: "barrios-rotulo", type: "symbol", source: "barrios_rotulo", maxzoom: 16,
      layout: { "text-field": ["get", "nombre"], "text-font": BALOO, "text-size": 13, "text-max-width": 8 },
      paint: { "text-color": p.textoBarrio, "text-halo-color": p.haloBarrio, "text-halo-width": 1.5 } },
    { id: "sectores-rotulo", type: "symbol", source: "sectores_punto", minzoom: 17,
      layout: { "text-field": ["get", "nombre"], "text-font": BALOO, "text-size": 15 },
      paint: { "text-color": p.textoSector, "text-halo-color": p.halo, "text-halo-width": 2 } },
  );

  const [fuentesCapas, diferidas] = capasGeojson(base, capas, diferir);
  return {
    version: 8,
    name: `Roldanillo en miniatura (${modo})`,
    metadata: { "rodaditas:diferidas": diferidas },
    glyphs: `${base}glifos/{fontstack}/{range}.pbf`,
    state: { hayElegido: { default: false } },
    sources: {
      ...fuentesCapas,
      barrios: { type: "geojson", data: `${datos}barrios.geojson`, promoteId: "slug" },
      sectores: { type: "geojson", data: `${datos}sectores.geojson`, promoteId: "nombre" },
      satelite: {
        type: "raster", tileSize: 256, maxzoom: 19, attribution: "Esri World Imagery",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      },
    },
    layers: capasMapa,
  };
}
