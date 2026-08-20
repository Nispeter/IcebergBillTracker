/**
 * Que tanto reconoce el catalogo de comercios sobre nombres chilenos realistas.
 *
 * Los tests unitarios prueban casos elegidos a mano; este prueba cobertura. La
 * semilla genera 18 meses con nombres de comercio chilenos y **ya sabe** que
 * categoria le puso a cada uno, asi que sirve de contraste: el catalogo tiene
 * que llegar a la misma respuesta mirando solo el nombre.
 *
 * El numero de referencia viene de medir contra las 7 cartolas reales: 60 % de
 * las filas que tienen un comercio que reconocer. El resto son comercios chicos
 * —"COMERCIAL ALEXIS", "LA MAGIA DE ALICI"— que ningun catalogo generico va a
 * conocer, y para eso estan las reglas propias.
 */

import { rules } from '@iceberg/core';
import { describe, expect, it } from 'vitest';
import { generateSeed } from './generate';

const gastos = generateSeed().transactions.filter((t) => t.type === 'gasto' && t.category);

describe('categorizacion automatica', () => {
  it('la semilla trae material suficiente', () => {
    expect(gastos.length).toBeGreaterThan(500);
  });

  it('reconoce al menos la mitad de los gastos', () => {
    const reconocidos = gastos.filter((t) => rules.categorizar(t.name) !== null);
    expect(reconocidos.length / gastos.length).toBeGreaterThanOrEqual(0.5);
  });

  it('cuando reconoce, acierta la categoria la gran mayoria de las veces', () => {
    // Equivocarse de categoria es peor que no saber: ensucia la torta y la
    // deriva sin que nadie sospeche.
    const reconocidos = gastos.filter((t) => rules.categorizar(t.name) !== null);
    const aciertos = reconocidos.filter((t) => rules.categorizar(t.name) === t.category);
    expect(aciertos.length / reconocidos.length).toBeGreaterThanOrEqual(0.9);
  });
});
