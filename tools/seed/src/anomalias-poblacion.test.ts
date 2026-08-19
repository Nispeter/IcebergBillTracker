/**
 * Que tan seguido salta la alerta de gasto raro sobre los 18 meses de la semilla.
 *
 * No mide el motor —eso esta en `core/analytics/anomalias`— sino la **poblacion
 * elegida**, que es la decision que de verdad determina si la alerta sirve. Una
 * marca que aparece en uno de cada diez gastos deja de ser alerta y pasa a ser
 * decoracion, y eso no lo detecta ningun test unitario: hace falta un corpus
 * realista.
 */

import { analytics } from '@iceberg/core';
import { describe, expect, it } from 'vitest';
import { generateSeed } from './generate';

const gastos = generateSeed().transactions.filter((t) => t.type === 'gasto');

const marcadasPor = (clave: (t: (typeof gastos)[number]) => string) =>
  analytics.anomaliasAltasPorGrupo(gastos, clave, (t) => t.amountMinor);

const porComercio = marcadasPor((t) => t.name.trim().toLowerCase());
const porCategoria = marcadasPor((t) => t.category ?? '__sin__');

describe('poblacion de las anomalias', () => {
  it('la semilla da suficiente material para que la comparacion signifique algo', () => {
    expect(gastos.length).toBeGreaterThan(500);
  });

  it('agrupar por comercio alerta en menos de uno de cada veinte gastos', () => {
    expect(porComercio.length / gastos.length).toBeLessThan(0.05);
  });

  it('agrupar por categoria alerta al menos tres veces mas seguido', () => {
    expect(porCategoria.length).toBeGreaterThan(porComercio.length * 3);
  });

  it('lo que se marca esta de verdad por encima de lo tipico de su comercio', () => {
    for (const anomalia of porComercio) {
      const pares = gastos
        .filter((g) => g.name === anomalia.item.name)
        .map((g) => g.amountMinor);
      const centro = analytics.mediana(pares);
      expect(anomalia.item.amountMinor).toBeGreaterThan(centro);
    }
  });
});
