import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { csv, dates } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { crearCuenta } from './cuentas';
import { crearMovimiento, listarMovimientos, obtenerMovimiento, editarMovimiento } from './movimientos';
import {
  deshacerLote, importarLote, listarLotes, movimientosDelLote, previsualizarImportacion,
} from './importaciones';

const d = dates.requirePlainDate;

let base: BaseDePrueba;
let cuentaId: string;

beforeEach(() => {
  base = crearBaseDePrueba();
  cuentaId = crearCuenta(base.db, base.contexto, { nombre: 'Cuenta corriente', tipo: 'corriente' }).id;
});

afterEach(() => base.cerrar());

const fila = (
  parcial: Partial<csv.MovimientoImportado> = {},
): csv.MovimientoImportado => {
  const completo = {
    ocurridoEn: d('2026-01-05'),
    descripcion: 'PAGO:SUPERMERCADO LIDER',
    canal: 'INTERNET',
    montoMinor: 45_000,
    tipo: 'gasto' as const,
    saldoMinor: null,
    ...parcial,
  };
  return {
    ...completo,
    clave: parcial.clave ?? csv.claveDeDedupe(
      completo.ocurridoEn, completo.descripcion, completo.montoMinor, completo.canal, 0,
    ),
  };
};

const cartola = () => [
  fila(),
  fila({
    ocurridoEn: d('2026-01-20'),
    descripcion: 'ABONO REMUNERACION',
    montoMinor: 850_000,
    tipo: 'ingreso',
    clave: 'a|ABONO REMUNERACION|850000|CENTRAL|0',
  }),
  fila({
    ocurridoEn: d('2026-01-28'),
    descripcion: 'PAGO CUENTA ENEL',
    montoMinor: 32_000,
    clave: 'b|PAGO CUENTA ENEL|32000|OF|0',
  }),
];

const importar = (movimientos = cartola(), archivo = 'cartola_30012026.xls') =>
  importarLote(base.db, base.contexto, { cuentaId, archivo, movimientos });

describe('previsualizar', () => {
  it('dice cuantos entran, cuantos ya estaban y el rango', () => {
    const previa = previsualizarImportacion(base.db, base.contexto, {
      cuentaId, archivo: 'x.xls', movimientos: cartola(),
    });
    expect(previa.nuevos).toHaveLength(3);
    expect(previa.duplicados).toBe(0);
    expect(previa.desde).toBe('2026-01-05');
    expect(previa.hasta).toBe('2026-01-28');
  });

  it('categoriza los gastos por el comercio', () => {
    const previa = previsualizarImportacion(base.db, base.contexto, {
      cuentaId, archivo: 'x.xls', movimientos: cartola(),
    });
    const lider = previa.nuevos.find((m) => m.nombre.includes('LIDER'));
    const enel = previa.nuevos.find((m) => m.nombre.includes('ENEL'));
    expect(lider?.categoriaId).toBe('comida');
    expect(enel?.categoriaId).toBe('servicios');
    expect(previa.categorizados).toBe(2);
  });

  it('el ingreso no lleva categoria: un sueldo no es un tipo de gasto', () => {
    const previa = previsualizarImportacion(base.db, base.contexto, {
      cuentaId, archivo: 'x.xls', movimientos: cartola(),
    });
    expect(previa.nuevos.find((m) => m.tipo === 'ingreso')?.categoriaId).toBeNull();
  });

  it('no escribe nada', () => {
    previsualizarImportacion(base.db, base.contexto, {
      cuentaId, archivo: 'x.xls', movimientos: cartola(),
    });
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(0);
    expect(listarLotes(base.db, base.contexto)).toHaveLength(0);
  });
});

describe('importar', () => {
  it('escribe los movimientos y el lote', () => {
    const lote = importar();
    expect(lote?.cantidad).toBe(3);
    expect(lote?.archivo).toBe('cartola_30012026.xls');
    expect(lote?.desde).toBe('2026-01-05');
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(3);
  });

  it('cada movimiento queda enlazado a su lote y a su clave de origen', () => {
    const lote = importar()!;
    for (const movimiento of movimientosDelLote(base.db, base.contexto, lote.id)) {
      expect(movimiento.loteId).toBe(lote.id);
      expect(movimiento.origenClave).not.toBeNull();
    }
  });

  it('el monto entra entero y el signo lo da el tipo', () => {
    importar();
    const sueldo = listarMovimientos(base.db, base.contexto).find((m) => m.tipo === 'ingreso');
    expect(sueldo?.montoMinor).toBe(850_000);
  });

  it('rechaza un archivo sin nombre', () => {
    expect(() => importar(cartola(), '   ')).toThrow();
  });
});

describe('reimportar el mismo archivo no duplica nada', () => {
  it('la segunda vez no entra ninguno', () => {
    // Es el criterio de verificacion de F4, tal cual esta en el plan.
    importar();
    const segundo = importar();
    expect(segundo).toBeNull();
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(3);
  });

  it('la previsualizacion de la segunda vez los cuenta como duplicados', () => {
    importar();
    const previa = previsualizarImportacion(base.db, base.contexto, {
      cuentaId, archivo: 'x.xls', movimientos: cartola(),
    });
    expect(previa.nuevos).toHaveLength(0);
    expect(previa.duplicados).toBe(3);
  });

  it('un archivo con filas nuevas mete solo las nuevas', () => {
    importar();
    const ampliada = [...cartola(), fila({
      ocurridoEn: d('2026-02-03'),
      descripcion: 'PAGO:JUMBO',
      montoMinor: 61_800,
      clave: 'c|PAGO:JUMBO|61800|INTERNET|0',
    })];
    const lote = importar(ampliada, 'cartola_27022026.xls');
    expect(lote?.cantidad).toBe(1);
    expect(lote?.duplicados).toBe(3);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(4);
  });

  it('dos compras iguales el mismo dia entran las dos', () => {
    // El ordinal de la clave es lo que las distingue. Sin el, la segunda se
    // perderia en silencio y la base quedaria descuadrada contra el banco.
    const conDuplicado = [
      fila({ clave: csv.claveDeDedupe(d('2026-01-12'), 'PAGO:MERCADOPAGO*CONCE', 3_600, 'INTERNET', 0), descripcion: 'PAGO:MERCADOPAGO*CONCE', montoMinor: 3_600 }),
      fila({ clave: csv.claveDeDedupe(d('2026-01-12'), 'PAGO:MERCADOPAGO*CONCE', 3_600, 'INTERNET', 1), descripcion: 'PAGO:MERCADOPAGO*CONCE', montoMinor: 3_600 }),
    ];
    expect(importar(conDuplicado)?.cantidad).toBe(2);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(2);
  });

  it('lo cargado a mano no estorba: no tiene clave de origen', () => {
    crearMovimiento(base.db, base.contexto, {
      cuentaId, tipo: 'gasto', montoMinor: 45_000,
      ocurridoEn: d('2026-01-05'), nombre: 'PAGO:SUPERMERCADO LIDER',
    });
    expect(importar()?.cantidad).toBe(3);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(4);
  });

  it('la misma clave en otra cuenta no cuenta como duplicado', () => {
    const otra = crearCuenta(base.db, base.contexto, { nombre: 'Vista', tipo: 'vista' }).id;
    importar();
    const lote = importarLote(base.db, base.contexto, {
      cuentaId: otra, archivo: 'x.xls', movimientos: cartola(),
    });
    expect(lote?.cantidad).toBe(3);
  });
});

describe('deshacer el lote', () => {
  it('borra todos sus movimientos y el lote', () => {
    const lote = importar()!;
    expect(deshacerLote(base.db, base.contexto, lote.id)).toBe(3);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(0);
    expect(listarLotes(base.db, base.contexto)).toHaveLength(0);
  });

  it('no toca lo que se cargo a mano', () => {
    const aMano = crearMovimiento(base.db, base.contexto, {
      cuentaId, tipo: 'gasto', montoMinor: 9_900,
      ocurridoEn: d('2026-01-06'), nombre: 'Kiosco',
    });
    const lote = importar()!;
    deshacerLote(base.db, base.contexto, lote.id);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(1);
    expect(obtenerMovimiento(base.db, base.contexto, aMano.id)).not.toBeNull();
  });

  it('no toca otros lotes', () => {
    const primero = importar()!;
    const segundo = importar([fila({
      ocurridoEn: d('2026-02-03'), descripcion: 'PAGO:JUMBO', montoMinor: 61_800,
      clave: 'otro|JUMBO|61800|INTERNET|0',
    })], 'cartola_27022026.xls')!;

    deshacerLote(base.db, base.contexto, primero.id);
    expect(movimientosDelLote(base.db, base.contexto, segundo.id)).toHaveLength(1);
    expect(listarLotes(base.db, base.contexto)).toHaveLength(1);
  });

  it('se lleva tambien lo que se edito a mano despues de importar', () => {
    // Dejarlo huerfano seria peor: volveria a entrar en la proxima importacion,
    // porque su clave ya no estaria, y quedaria duplicado.
    const lote = importar()!;
    const uno = movimientosDelLote(base.db, base.contexto, lote.id)[0]!;
    editarMovimiento(base.db, base.contexto, uno.id, { categoriaId: 'personales' });

    deshacerLote(base.db, base.contexto, lote.id);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(0);
  });

  it('deshacer y volver a importar deja la base igual que la primera vez', () => {
    const primero = importar()!;
    deshacerLote(base.db, base.contexto, primero.id);
    const segundo = importar();
    expect(segundo?.cantidad).toBe(3);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(3);
  });

  it('deshacer un lote que no existe no hace nada', () => {
    expect(deshacerLote(base.db, base.contexto, 'no-existe')).toBe(0);
  });
});
