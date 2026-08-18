/**
 * Generador pseudoaleatorio determinista (mulberry32).
 *
 * La semilla tiene que ser reproducible: si cada corrida diera datos distintos,
 * los tests de analytics no podrian afirmar nada y comparar dos ejecuciones
 * seria imposible. Misma semilla, mismo dataset, siempre.
 */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Flotante en [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [min, max], ambos incluidos. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Un elemento cualquiera de la lista. */
  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) throw new Error('pick sobre una lista vacia');
    return item;
  }

  /** True con la probabilidad dada. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * Entero alrededor de `center` con una dispersion de +-`spread`, redondeado a
   * la centena mas cercana. Los montos reales rara vez terminan en cifras
   * arbitrarias, y un dataset lleno de `43.917` se ve sintetico a simple vista.
   */
  around(center: number, spread: number): number {
    const raw = center + ((this.next() * 2) - 1) * spread;
    return Math.max(100, Math.round(raw / 100) * 100);
  }
}
