/**
 * Escalas para graficos.
 *
 * Una barra segmentada necesita saber cuanto vale cada muesca. Fijar el valor a
 * mano funciona hasta que los datos cambian de orden de magnitud: con muescas de
 * $25.000, un mes de $80.000 total mostraria tres marcas y uno de $9.000.000
 * mostraria trescientas sesenta.
 *
 * Aca se elige una unidad **redonda** —de las que una persona reconoce al
 * leerla— tal que la barra quede con una cantidad legible de muescas.
 */

/**
 * Multiplicadores "redondos" dentro de una decada.
 *
 * Son los que la gente lee sin esfuerzo: 25.000 se entiende de inmediato,
 * 23.684 no. Se prueban en orden y gana el primero que deje la cantidad de
 * muescas en el rango pedido.
 */
const REDONDOS = [1, 2, 2.5, 5, 10] as const;

/**
 * Unidad por muesca para que `maximo` quede en aproximadamente `objetivo`
 * muescas, usando un numero redondo.
 *
 * Devuelve siempre un entero positivo: es dinero en la unidad menor, y una
 * muesca de 2.500,5 pesos no significa nada.
 */
export function niceUnit(maximo: number, objetivo = 18): number {
  if (!Number.isFinite(maximo) || maximo <= 0) return 1;
  if (!Number.isFinite(objetivo) || objetivo < 1) return Math.max(1, Math.round(maximo));

  const crudo = maximo / objetivo;
  const decada = 10 ** Math.floor(Math.log10(crudo));

  for (const factor of REDONDOS) {
    const candidato = factor * decada;
    if (candidato >= crudo) return Math.max(1, Math.round(candidato));
  }
  return Math.max(1, Math.round(10 * decada));
}

/**
 * Cuantas muescas ocupa un valor, redondeando al entero mas cercano.
 *
 * Un valor mayor que cero nunca da cero muescas: se muestra una. Vale la pena
 * la pequena mentira porque la alternativa —una fila con la barra vacia— se lee
 * como "no hay gasto", que es falso; y el monto exacto esta escrito al lado.
 */
export function notchesFor(valor: number, unidad: number): number {
  if (unidad <= 0 || valor <= 0) return 0;
  return Math.max(1, Math.round(valor / unidad));
}
