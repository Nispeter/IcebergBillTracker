/**
 * Genera la textura de hielo agrietado como PNG.
 *
 * Se genera y no se descarga: las texturas de banco de imagenes vienen con
 * licencia y con marca de agua, y esto va en un repositorio publico. Ademas asi
 * sale **blanca con transparencia**, que es lo que permite pintarla encima del
 * degradado de hielo y agua sin romper ninguno de los dos temas.
 *
 * Dos capas:
 *
 * 1. **Grietas**: bordes de celdas de Voronoi. La distancia entre el sitio mas
 *    cercano y el segundo dibuja lineas finas justo en las fronteras, que es la
 *    forma que tiene el hielo real de romperse.
 * 2. **Grano**: ruido de valor sumado en octavas, para que las caras entre
 *    grietas no queden planas.
 *
 * La textura no es blanca sino **biselada**: cada grieta tiene un lado claro y
 * uno oscuro, como una de verdad. Es lo que la hace visible sobre el hielo casi
 * blanco *y* sobre el agua: una textura blanca desaparecia arriba de la linea de
 * agua, donde el hielo ya es casi blanco.
 *
 * Los sitios se repiten en las nueve copias vecinas del cuadro, asi la textura
 * **calza consigo misma** al repetirse y no se ve la costura.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const LADO = 256;

/**
 * Dos escalas de fractura.
 *
 * Con una sola, todas las celdas salian del mismo tamano y se leia como una
 * malla: el hielo real tiene grietas grandes que lo parten en bloques y otras
 * finas dentro de cada bloque.
 */
const ESCALAS = [
  { celdas: 5, ancho: 7.5, fuerza: 0.9 },
  { celdas: 13, ancho: 3.4, fuerza: 0.5 },
];

let semilla = 20260825;
const azar = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;

// Sitios de Voronoi por escala, con jitter sobre una rejilla.
for (const e of ESCALAS) {
  e.sitios = [];
  for (let gy = 0; gy < e.celdas; gy++) {
    for (let gx = 0; gx < e.celdas; gx++) {
      e.sitios.push([
        ((gx + azar()) / e.celdas) * LADO,
        ((gy + azar()) / e.celdas) * LADO,
      ]);
    }
  }
}

/** La grieta en un punto, sumando las dos escalas. */
function grietaEn(x, y) {
  let g = 0;
  for (const e of ESCALAS) {
    const [d1, d2] = dosMasCercanos(e.sitios, x, y);
    g = Math.max(g, Math.max(0, 1 - (d2 - d1) / e.ancho) ** 2.2 * e.fuerza);
  }
  return g;
}

/** Distancia a los dos sitios mas cercanos, mirando tambien las copias vecinas. */
function dosMasCercanos(sitios, x, y) {
  let d1 = Infinity;
  let d2 = Infinity;
  for (const [sx, sy] of sitios) {
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const dx = x - (sx + ox * LADO);
        const dy = y - (sy + oy * LADO);
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
  }
  return [Math.sqrt(d1), Math.sqrt(d2)];
}

// Ruido de valor con rejilla que se repite, para el grano.
function rejillaDeRuido(n) {
  const v = [];
  for (let i = 0; i < n * n; i++) v.push(azar());
  return v;
}
const suave = (t) => t * t * (3 - 2 * t);
function ruido(v, n, x, y) {
  const fx = (x / LADO) * n;
  const fy = (y / LADO) * n;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = suave(fx - x0);
  const ty = suave(fy - y0);
  const en = (i, j) => v[((j % n) + n) % n * n + (((i % n) + n) % n)];
  const a = en(x0, y0) * (1 - tx) + en(x0 + 1, y0) * tx;
  const b = en(x0, y0 + 1) * (1 - tx) + en(x0 + 1, y0 + 1) * tx;
  return a * (1 - ty) + b * ty;
}
const octavas = [
  { rejilla: rejillaDeRuido(8), n: 8, peso: 0.5 },
  { rejilla: rejillaDeRuido(16), n: 16, peso: 0.3 },
  { rejilla: rejillaDeRuido(48), n: 48, peso: 0.2 },
];

/**
 * Campo que apaga y enciende las grietas a lo largo.
 *
 * Sin esto todas tienen la misma intensidad de punta a punta y se ve dibujado.
 * Una grieta de verdad se marca en tramos y se pierde en otros.
 */
const desvanecido = { rejilla: rejillaDeRuido(6), n: 6 };

const pixeles = Buffer.alloc(LADO * LADO * 4);
for (let y = 0; y < LADO; y++) {
  for (let x = 0; x < LADO; x++) {
    // La frontera entre dos celdas es donde las dos distancias se igualan.
    let grieta = grietaEn(x + 0.5, y + 0.5);
    // 0,45 a 1: se apaga por tramos, nunca del todo.
    grieta *= 0.45 + ruido(desvanecido.rejilla, desvanecido.n, x, y) * 0.55;

    /**
     * De que lado de la grieta estamos, mirando hacia la luz.
     *
     * La pendiente entre este punto y el de arriba a la izquierda dice si la
     * grieta esta subiendo o bajando: subiendo le da la luz, bajando queda en
     * sombra. Es un bisel calculado a mano, y es lo unico que hace que una
     * grieta se lea igual sobre hielo blanco que sobre agua oscura.
     */
    const pendiente = grietaEn(x + 0.5, y + 0.5) - grietaEn(x - 1.5, y - 1.5);
    const claro = Math.max(0, Math.min(1, 0.5 + pendiente * 6));

    let grano = 0;
    for (const o of octavas) grano += ruido(o.rejilla, o.n, x, y) * o.peso;
    grano = (grano - 0.5) * 2;

    const alfa = Math.min(1, grieta + Math.max(0, grano) * 0.13);
    // Del azul de la sombra al blanco del reflejo.
    const tinte = Math.round(30 + claro * 225);

    const i = (y * LADO + x) * 4;
    if (process.env.SOBRE_AZUL) {
      // Solo para mirarla: compuesta sobre un azul de hielo, y sobre uno claro.
      const f = x < LADO / 2 ? [0x4A, 0x8F, 0xC0] : [0xF2, 0xF7, 0xFB];
      pixeles[i] = Math.round(f[0] + (tinte - f[0]) * alfa);
      pixeles[i + 1] = Math.round(f[1] + (tinte - f[1]) * alfa);
      pixeles[i + 2] = Math.round(f[2] + (tinte - f[2]) * alfa);
      pixeles[i + 3] = 255;
    } else {
      pixeles[i] = tinte;
      pixeles[i + 1] = tinte;
      pixeles[i + 2] = tinte;
      pixeles[i + 3] = Math.round(alfa * 255);
    }
  }
}

// ─────────────────────── PNG a mano ───────────────────────

const TABLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(LADO, 0);
ihdr.writeUInt32BE(LADO, 4);
ihdr[8] = 8;   // bits por canal
ihdr[9] = 6;   // color: RGBA
ihdr[10] = 0;  // deflate
ihdr[11] = 0;  // filtro adaptativo
ihdr[12] = 0;  // sin entrelazar

// Cada linea lleva adelante su byte de filtro; 0 es "sin filtro".
const crudo = Buffer.alloc(LADO * (LADO * 4 + 1));
for (let y = 0; y < LADO; y++) {
  crudo[y * (LADO * 4 + 1)] = 0;
  pixeles.copy(crudo, y * (LADO * 4 + 1) + 1, y * LADO * 4, (y + 1) * LADO * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  trozo('IHDR', ihdr),
  trozo('IDAT', deflateSync(crudo, { level: 9 })),
  trozo('IEND', Buffer.alloc(0)),
]);

const destino = process.argv[2];
writeFileSync(destino, png);
console.log('escrito:', destino, png.length, 'bytes,', LADO + 'x' + LADO);
