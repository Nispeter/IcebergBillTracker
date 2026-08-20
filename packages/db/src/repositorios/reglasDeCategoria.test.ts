import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dates, rules } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { crearCuenta } from './cuentas';
import { crearMovimiento, listarMovimientos, obtenerMovimiento } from './movimientos';
import {
  aplicarCategorias, borrarReglaDeCategoria, catalogoDe, crearReglaDeCategoria,
  listarReglasDeCategoria, sinCategoriaQueSeReconocen,
} from './reglasDeCategoria';

const d = dates.requirePlainDate;

let base: BaseDePrueba;
let cuentaId: string;

beforeEach(() => {
  base = crearBaseDePrueba();
  cuentaId = crearCuenta(base.db, base.contexto, { nombre: 'Cuenta', tipo: 'corriente' }).id;
});

afterEach(() => base.cerrar());

const gasto = (nombre: string, categoriaId: string | null = null) =>
  crearMovimiento(base.db, base.contexto, {
    cuentaId, tipo: 'gasto', montoMinor: 12_000,
    ocurridoEn: d('2026-08-05'), nombre, categoriaId,
  });

describe('crear reglas', () => {
  it('guarda el patron normalizado, no como se escribio', () => {
    // Un patron con mayusculas o tildes no calzaria nunca contra la descripcion
    // normalizada, y el usuario no tendria como darse cuenta.
    const regla = crearReglaDeCategoria(base.db, base.contexto, {
      patron: '  COMERCIAL ÁLEXIS  ', categoriaId: 'comida',
    });
    expect(regla.patron).toBe('comercial alexis');
  });

  it('rechaza un patron vacio', () => {
    expect(() => crearReglaDeCategoria(base.db, base.contexto, {
      patron: '   ', categoriaId: 'comida',
    })).toThrow();
  });

  it('rechaza una categoria que no existe', () => {
    expect(() => crearReglaDeCategoria(base.db, base.contexto, {
      patron: 'algo', categoriaId: 'inventada' as never,
    })).toThrow();
  });

  it('rechaza repetir un patron que ya existe', () => {
    crearReglaDeCategoria(base.db, base.contexto, { patron: 'alexis', categoriaId: 'comida' });
    expect(() => crearReglaDeCategoria(base.db, base.contexto, {
      patron: 'ALEXIS', categoriaId: 'salud',
    })).toThrow();
  });

  it('borrar deja lapida y la saca del listado', () => {
    const regla = crearReglaDeCategoria(base.db, base.contexto, {
      patron: 'alexis', categoriaId: 'comida',
    });
    expect(borrarReglaDeCategoria(base.db, base.contexto, regla.id)).toBe(true);
    expect(listarReglasDeCategoria(base.db, base.contexto)).toHaveLength(0);
  });

  it('borrar una que no existe no hace nada', () => {
    expect(borrarReglaDeCategoria(base.db, base.contexto, 'no-existe')).toBe(false);
  });
});

describe('el catalogo combinado', () => {
  it('sin reglas propias es el de la app', () => {
    expect(catalogoDe(base.db, base.contexto)).toHaveLength(rules.REGLAS_CHILE.length);
  });

  it('reconoce lo propio ademas de lo que ya venia', () => {
    crearReglaDeCategoria(base.db, base.contexto, { patron: 'comercial alexis', categoriaId: 'comida' });
    const catalogo = catalogoDe(base.db, base.contexto);
    expect(rules.categorizar('PAGO:COMERCIAL ALEXIS', catalogo)).toBe('comida');
    expect(rules.categorizar('PAGO:SUPERMERCADO LIDER', catalogo)).toBe('comida');
  });

  it('en empate de largo gana la propia', () => {
    // `lider` mide lo mismo en los dos catalogos; la del usuario va primero.
    crearReglaDeCategoria(base.db, base.contexto, { patron: 'lider', categoriaId: 'personales' });
    expect(rules.categorizar('PAGO:LIDER', catalogoDe(base.db, base.contexto))).toBe('personales');
  });
});

describe('aplicar a lo que ya esta guardado', () => {
  it('categoriza los gastos que quedaron sin categoria', () => {
    gasto('PAGO:SUPERMERCADO LIDER');
    gasto('PAGO CUENTA ENEL');
    expect(aplicarCategorias(base.db, base.contexto)).toBe(2);

    const guardados = listarMovimientos(base.db, base.contexto);
    expect(guardados.find((m) => m.nombre.includes('LIDER'))?.categoriaId).toBe('comida');
    expect(guardados.find((m) => m.nombre.includes('ENEL'))?.categoriaId).toBe('servicios');
  });

  it('una regla nueva alcanza a lo que ya estaba', () => {
    // Es el motivo de escribirla: si solo sirviera para lo que se importe
    // despues, lo que ya esta —que es el problema— quedaria igual.
    gasto('PAGO:COMERCIAL ALEXIS');
    expect(aplicarCategorias(base.db, base.contexto)).toBe(0);

    crearReglaDeCategoria(base.db, base.contexto, { patron: 'comercial alexis', categoriaId: 'comida' });
    expect(aplicarCategorias(base.db, base.contexto)).toBe(1);
  });

  it('no pisa una categoria puesta a mano', () => {
    // Si alguien movio un gasto de "comida" a "familia", sabe algo que la regla
    // no sabe.
    const movimiento = gasto('PAGO:SUPERMERCADO LIDER', 'familia');
    expect(aplicarCategorias(base.db, base.contexto)).toBe(0);
    expect(obtenerMovimiento(base.db, base.contexto, movimiento.id)?.categoriaId).toBe('familia');
  });

  it('no toca los ingresos: un sueldo no es un tipo de gasto', () => {
    crearMovimiento(base.db, base.contexto, {
      cuentaId, tipo: 'ingreso', montoMinor: 900_000,
      ocurridoEn: d('2026-08-30'), nombre: 'ABONO LIDER SUELDO',
    });
    expect(aplicarCategorias(base.db, base.contexto)).toBe(0);
  });

  it('lo que el catalogo no reconoce se queda sin categoria', () => {
    gasto('TRASPASO A:Juan Perez');
    expect(aplicarCategorias(base.db, base.contexto)).toBe(0);
    expect(listarMovimientos(base.db, base.contexto)[0]?.categoriaId).toBeNull();
  });

  it('aplicar dos veces seguidas no cambia nada la segunda', () => {
    gasto('PAGO:SUPERMERCADO LIDER');
    expect(aplicarCategorias(base.db, base.contexto)).toBe(1);
    expect(aplicarCategorias(base.db, base.contexto)).toBe(0);
  });

  it('dice cuantos cambiarian antes de cambiarlos', () => {
    gasto('PAGO:SUPERMERCADO LIDER');
    gasto('TRASPASO A:Juan Perez');
    expect(sinCategoriaQueSeReconocen(base.db, base.contexto)).toHaveLength(1);
    // Y no escribio nada.
    expect(listarMovimientos(base.db, base.contexto)[0]?.categoriaId).toBeNull();
  });
});
