/**
 * Geometria de poligonos para los graficos propios.
 *
 * Existe por un problema concreto del iceberg: la silueta es angosta arriba y
 * ancha abajo, asi que **partirla por altura miente**. Si el gasto comprometido
 * es el 60% del total y se dibuja la linea de agua al 60% de la altura, el area
 * sobre el agua queda muchisimo menor al 60%, y lo que la persona lee es la
 * proporcion de superficie pintada, no la de altura.
 *
 * Aca se calcula la linea de agua que deja **el area** correcta a cada lado.
 *
 * Convencion de ejes: es el sistema de SVG, con la Y creciendo **hacia abajo**.
 * "Sobre el agua" significa Y menor.
 */

export type Point = readonly [x: number, y: number];

/** Area de un poligono cerrado, por la formula del cordon de zapato. */
export function polygonArea(points: readonly Point[]): number {
  if (points.length < 3) return 0;
  let doble = 0;
  for (let i = 0; i < points.length; i++) {
    const actual = points[i]!;
    const siguiente = points[(i + 1) % points.length]!;
    doble += (actual[0] * siguiente[1]) - (siguiente[0] * actual[1]);
  }
  return Math.abs(doble) / 2;
}

/**
 * Recorta el poligono contra una linea horizontal (algoritmo de
 * Sutherland-Hodgman) y devuelve el trozo que queda de un lado.
 */
export function clipPolygonAtY(
  points: readonly Point[],
  y: number,
  keep: 'above' | 'below',
): Point[] {
  if (points.length < 3) return [];
  const dentro = (punto: Point) => (keep === 'above' ? punto[1] <= y : punto[1] >= y);

  const corte = (a: Point, b: Point): Point => {
    const delta = b[1] - a[1];
    // Segmento horizontal justo sobre la linea: no hay un punto de corte unico.
    if (delta === 0) return [a[0], y];
    const t = (y - a[1]) / delta;
    return [a[0] + (t * (b[0] - a[0])), y];
  };

  const salida: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const aDentro = dentro(a);
    const bDentro = dentro(b);

    if (aDentro && bDentro) {
      salida.push(b);
    } else if (aDentro && !bDentro) {
      salida.push(corte(a, b));
    } else if (!aDentro && bDentro) {
      salida.push(corte(a, b));
      salida.push(b);
    }
  }
  return salida;
}

/**
 * La Y donde hay que trazar la linea de agua para que el area sobre ella sea
 * `share` del area total.
 *
 * Se resuelve por biseccion porque el area sobre la linea crece de forma
 * monotona con Y pero no lineal: depende del ancho del poligono a cada altura,
 * que es justo lo que hace incorrecto el reparto por altura.
 *
 * `share` se recorta a [0, 1].
 */
export function waterlineForShare(points: readonly Point[], share: number): number {
  const total = polygonArea(points);
  const ys = points.map((punto) => punto[1]);
  let minimo = Math.min(...ys);
  let maximo = Math.max(...ys);

  if (total === 0) return minimo;

  const objetivo = Math.min(1, Math.max(0, share));
  if (objetivo <= 0) return minimo;
  if (objetivo >= 1) return maximo;

  // 40 pasos dejan el error por debajo de la millonesima de la altura: mucho mas
  // fino que cualquier pixel.
  for (let paso = 0; paso < 40; paso++) {
    const medio = (minimo + maximo) / 2;
    const proporcion = polygonArea(clipPolygonAtY(points, medio, 'above')) / total;
    if (proporcion < objetivo) {
      minimo = medio;
    } else {
      maximo = medio;
    }
  }
  return (minimo + maximo) / 2;
}

/** Convierte una lista de puntos en el atributo `d` de un `<Path>` de SVG. */
export function toPathData(points: readonly Point[]): string {
  if (points.length === 0) return '';
  const [primero, ...resto] = points;
  const cabeza = `M ${primero![0].toFixed(2)} ${primero![1].toFixed(2)}`;
  const cola = resto.map((punto) => `L ${punto[0].toFixed(2)} ${punto[1].toFixed(2)}`);
  return `${cabeza} ${cola.join(' ')} Z`;
}
