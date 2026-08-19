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

/**
 * Un sector de dona como path de SVG.
 *
 * Se usa para la torta de categorias. Va aca y no en el componente porque el
 * calculo tiene dos trampas que solo se ven cuando fallan: el flag de "arco
 * grande" —que hay que prender pasados los 180 grados o el arco se dibuja por
 * el lado corto— y el sentido de barrido, que va al reves en el borde interior
 * que en el exterior. Las dos tienen test.
 *
 * Los angulos van en grados, empezando **arriba** (las 12) y creciendo en el
 * sentido del reloj, que es como la gente lee una torta.
 */
export function donutArcPath(
  cx: number,
  cy: number,
  radioInterior: number,
  radioExterior: number,
  desdeGrados: number,
  hastaGrados: number,
): string {
  const barrido = hastaGrados - desdeGrados;
  if (barrido <= 0) return '';

  // Un sector de 360 grados no se puede dibujar con un solo arco: el punto de
  // inicio y el de fin coinciden y el navegador no dibuja nada. Se parte en dos.
  if (barrido >= 360) {
    return `${donutArcPath(cx, cy, radioInterior, radioExterior, 0, 180)} `
      + donutArcPath(cx, cy, radioInterior, radioExterior, 180, 360);
  }

  const punto = (grados: number, radio: number): Point => {
    const radianes = ((grados - 90) * Math.PI) / 180;
    return [cx + (radio * Math.cos(radianes)), cy + (radio * Math.sin(radianes))];
  };

  const [x1, y1] = punto(desdeGrados, radioExterior);
  const [x2, y2] = punto(hastaGrados, radioExterior);
  const [x3, y3] = punto(hastaGrados, radioInterior);
  const [x4, y4] = punto(desdeGrados, radioInterior);
  const arcoGrande = barrido > 180 ? 1 : 0;
  const n = (valor: number) => valor.toFixed(2);

  return [
    `M ${n(x1)} ${n(y1)}`,
    `A ${n(radioExterior)} ${n(radioExterior)} 0 ${arcoGrande} 1 ${n(x2)} ${n(y2)}`,
    `L ${n(x3)} ${n(y3)}`,
    // El borde interior se recorre al reves: barrido 0 en vez de 1.
    `A ${n(radioInterior)} ${n(radioInterior)} 0 ${arcoGrande} 0 ${n(x4)} ${n(y4)}`,
    'Z',
  ].join(' ');
}

/**
 * Reparte proporciones en angulos consecutivos.
 *
 * Las porciones muy chicas se quedan en cero grados si uno redondea: con doce
 * categorias, varias quedarian invisibles. Por eso se les da un minimo, y ese
 * minimo se descuenta proporcionalmente de las grandes para que el total siga
 * sumando 360.
 */
export function sectoresDeTorta(
  valores: readonly number[],
  gradosMinimos = 2,
): { desde: number; hasta: number }[] {
  const total = valores.reduce((suma, valor) => suma + Math.max(valor, 0), 0);
  if (total <= 0) return valores.map(() => ({ desde: 0, hasta: 0 }));

  const crudos = valores.map((valor) => (Math.max(valor, 0) / total) * 360);
  const chicos = crudos.filter((grados) => grados > 0 && grados < gradosMinimos);
  const faltante = chicos.reduce((suma, grados) => suma + (gradosMinimos - grados), 0);
  const grandes = crudos.reduce((suma, grados) => suma + (grados >= gradosMinimos ? grados : 0), 0);

  let cursor = 0;
  return crudos.map((grados) => {
    let ajustado = grados;
    if (grados > 0 && grados < gradosMinimos) ajustado = gradosMinimos;
    else if (grados >= gradosMinimos && grandes > 0) ajustado = grados - ((grados / grandes) * faltante);
    const desde = cursor;
    cursor += ajustado;
    return { desde, hasta: cursor };
  });
}
