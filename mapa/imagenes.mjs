// Imágenes del estilo, dibujadas en canvas o tomadas de los pictogramas OpenMoji (mapa/iconos/).
// Los nombres llevan el modo al final (flecha-color, placa-colorear, pin-1F3EB-negro-colorear) para que
// al cambiar de estilo no se mezclen. Se agregan cuando MapLibre las pide.
import { PX_FLECHA, PX_CHEVRON } from "./estilo.mjs";

const PR = 2; // pixelRatio de todas las imágenes
const NEGRO = "#222222";

function lienzo(ancho, alto) {
  const c = document.createElement("canvas");
  c.width = Math.round(ancho * PR);
  c.height = Math.round(alto * PR);
  const g = c.getContext("2d");
  g.scale(PR, PR);
  return [c, g];
}

function datos(c) {
  return c.getContext("2d").getImageData(0, 0, c.width, c.height);
}

// punta de flecha hacia el este, centrada (sentido vial)
function flecha(modo) {
  const t = PX_FLECHA;
  const [c, g] = lienzo(t, t);
  g.beginPath();
  g.moveTo(t * 0.85, t / 2);
  g.lineTo(t * 0.2, t * 0.18);
  g.lineTo(t * 0.38, t / 2);
  g.lineTo(t * 0.2, t * 0.82);
  g.closePath();
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.strokeStyle = modo === "colorear" ? NEGRO : "rgba(90,90,90,0.65)";
  g.lineWidth = 0.8;
  g.fill();
  g.stroke();
  return datos(c);
}

// chevron de pendiente hacia el este (la subida); dos si la pendiente pasa del 10 %
function chevron(modo, dobles) {
  const t = PX_CHEVRON;
  const paso = t * 0.6; // 3 m de separación con chevron de 5 m
  const ancho = dobles ? t + paso : t;
  const [c, g] = lienzo(ancho, t);
  const trazo = (x) => {
    g.beginPath();
    g.moveTo(x + t * 0.3, t * 0.2);
    g.lineTo(x + t * 0.75, t / 2);
    g.lineTo(x + t * 0.3, t * 0.8);
  };
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const x of dobles ? [0, paso] : [0]) {
    trazo(x);
    g.strokeStyle = "#ffffff";
    g.lineWidth = t * 0.26;
    g.stroke();
    trazo(x);
    g.strokeStyle = modo === "colorear" ? NEGRO : "#e8590c";
    g.lineWidth = t * 0.14;
    g.stroke();
  }
  return datos(c);
}

// fondo de placa de nomenclatura, estirable con icon-text-fit
function placa(modo) {
  const [ancho, alto, r] = [24, 18, 4];
  const [c, g] = lienzo(ancho, alto);
  g.beginPath();
  g.roundRect(0.75, 0.75, ancho - 1.5, alto - 1.5, r);
  g.fillStyle = modo === "colorear" ? "#ffffff" : "#1f5fa8";
  g.strokeStyle = modo === "colorear" ? NEGRO : "#ffffff";
  g.lineWidth = 1.2;
  g.fill();
  g.stroke();
  const f = (v) => v * PR;
  return [datos(c), {
    pixelRatio: PR,
    stretchX: [[f(r + 1), f(ancho - r - 1)]],
    stretchY: [[f(r + 1), f(alto - r - 1)]],
    content: [f(r), f(2), f(ancho - r), f(alto - 2)],
  }];
}

// disco blanco con el pictograma OpenMoji encima (lugares de referencia)
function pin(img, modo) {
  const [t, icono] = [26, 21];
  const [c, g] = lienzo(t, t);
  g.beginPath();
  g.arc(t / 2, t / 2, t / 2 - 1, 0, 2 * Math.PI);
  g.fillStyle = "#ffffff";
  g.strokeStyle = modo === "colorear" ? NEGRO : "#c9a54a";
  g.lineWidth = 1.2;
  g.fill();
  g.stroke();
  g.drawImage(img, (t - icono) / 2, (t - icono) / 2, icono, icono);
  return datos(c);
}

function cargar(src) {
  return new Promise((resolver) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => {
      console.warn("No se pudo cargar el pictograma", src);
      resolver(null);
    };
    img.src = src;
  });
}

// Resuelve las imágenes que pide el estilo (MapLibre 6: setMissingStyleImageResolver; el evento
// styleimagemissing ya no puede resolverlas). Los pictogramas se cargan solo cuando el mapa los pide.
export function registrarImagenes(map, base = "mapa/") {
  const pictogramas = new Map(); // nombre → Promise<HTMLImageElement | null>
  map.setMissingStyleImageResolver(async (id) => {
    if (map.hasImage(id)) return;
    const m = id.match(/^(.+)-(color|colorear)$/);
    if (!m) return;
    const [, nombre, modo] = m;
    if (nombre === "flecha") map.addImage(id, flecha(modo), { pixelRatio: PR });
    else if (nombre === "chevron") map.addImage(id, chevron(modo, false), { pixelRatio: PR });
    else if (nombre === "chevron2") map.addImage(id, chevron(modo, true), { pixelRatio: PR });
    else if (nombre === "placa") map.addImage(id, ...placa(modo));
    else if (nombre.startsWith("pin-")) {
      const archivo = nombre.slice(4);
      if (!pictogramas.has(archivo)) pictogramas.set(archivo, cargar(`${base}iconos/${archivo}.svg`));
      const img = await pictogramas.get(archivo);
      if (img && !map.hasImage(id)) map.addImage(id, pin(img, modo), { pixelRatio: PR });
    }
  });
}
