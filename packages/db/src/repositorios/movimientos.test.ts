import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dates, sync } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { crearCuenta } from './cuentas';
import {
  RepositorioError, borrarMovimiento, contarMovimientos, crearMovimiento, editarMovimiento,
  listarConLapidas, listarMovimientos, obtenerMovimiento, totalPorTipo,
} from './movimientos';

const d = dates.requirePlainDate;

let base: BaseDePrueba;
let cuentaId: string;

beforeEach(() => {
  base = crearBaseDePrueba();
  cuentaId = crearCuenta(base.db, base.contexto, { nombre: 'Cuenta corriente', tipo: 'corriente' }).id;
});

afterEach(() => base.cerrar());

const nuevo = (parcial: Partial<Parameters<typeof crearMovimiento>[2]> = {}) =>
  crearMovimiento(base.db, base.contexto, {
    cuentaId,
    tipo: 'gasto',
    montoMinor: 45_000,
    ocurridoEn: d('2026-08-15'),
    nombre: 'Jumbo',
    categoriaId: 'comida',
    ...parcial,
  });

describe('crear', () => {
  it('guarda el movimiento y lo devuelve completo', () => {
    const mov = nuevo();
    expect(mov.montoMinor).toBe(45_000);
    expect(mov.nombre).toBe('Jumbo');
    expect(mov.categoriaId).toBe('comida');
    expect(mov.deletedAt).toBeNull();
  });

  it('llena las columnas de sync desde el contexto', () => {
    const mov = nuevo();
    expect(mov.householdId).toBe('hogar1');
    expect(mov.createdBy).toBe('nico');
    expect(mov.originDeviceId).toBe('telefono1');
    expect(sync.hlcParse(mov.createdAt)).not.toBeNull();
    expect(mov.updatedAt).toBe(mov.createdAt);
  });

  it('el monto tiene que ser un entero positivo', () => {
    expect(() => nuevo({ montoMinor: 0 })).toThrow(RepositorioError);
    expect(() => nuevo({ montoMinor: -1_000 })).toThrow(RepositorioError);
    // El signo lo da el tipo, nunca el monto.
    expect(() => nuevo({ montoMinor: 1_234.5 })).toThrow();
  });

  it('el nombre no puede quedar vacio y se recorta', () => {
    expect(() => nuevo({ nombre: '   ' })).toThrow(RepositorioError);
    expect(nuevo({ nombre: '  Copec  ' }).nombre).toBe('Copec');
  });

  it('la categoria es opcional', () => {
    expect(nuevo({ categoriaId: null }).categoriaId).toBeNull();
  });
});

describe('persistencia', () => {
  it('crear tres movimientos y volver a leerlos los devuelve todos', () => {
    // Es el criterio de verificacion de F1.
    nuevo({ nombre: 'Jumbo', montoMinor: 45_000 });
    base.avanzarReloj(1_000);
    nuevo({ nombre: 'Copec', montoMinor: 32_000, categoriaId: 'transporte' });
    base.avanzarReloj(1_000);
    nuevo({ nombre: 'Sueldo', tipo: 'ingreso', montoMinor: 1_480_000, categoriaId: null });

    const leidos = listarMovimientos(base.db, base.contexto);
    expect(leidos).toHaveLength(3);
    expect(leidos.map((m) => m.nombre).sort()).toEqual(['Copec', 'Jumbo', 'Sueldo']);
    expect(contarMovimientos(base.db, base.contexto)).toBe(3);
  });

  it('obtenerMovimiento devuelve null si no existe', () => {
    expect(obtenerMovimiento(base.db, base.contexto, 'no-existe')).toBeNull();
  });
});

describe('listar y filtrar', () => {
  beforeEach(() => {
    nuevo({ nombre: 'Jumbo', ocurridoEn: d('2026-08-05'), categoriaId: 'comida' });
    base.avanzarReloj(1_000);
    nuevo({ nombre: 'Copec', ocurridoEn: d('2026-08-15'), categoriaId: 'transporte', montoMinor: 32_000 });
    base.avanzarReloj(1_000);
    nuevo({ nombre: 'Sueldo', ocurridoEn: d('2026-08-30'), tipo: 'ingreso', montoMinor: 1_480_000, categoriaId: null });
  });

  it('viene del mas nuevo al mas viejo', () => {
    expect(listarMovimientos(base.db, base.contexto).map((m) => m.nombre))
      .toEqual(['Sueldo', 'Copec', 'Jumbo']);
  });

  it('filtra por tipo', () => {
    expect(listarMovimientos(base.db, base.contexto, { tipo: 'ingreso' }).map((m) => m.nombre))
      .toEqual(['Sueldo']);
  });

  it('filtra por categoria', () => {
    expect(listarMovimientos(base.db, base.contexto, { categoriaId: 'comida' }).map((m) => m.nombre))
      .toEqual(['Jumbo']);
  });

  it('filtra por rango de fechas, con los bordes incluidos', () => {
    const enRango = listarMovimientos(base.db, base.contexto, {
      desde: d('2026-08-05'),
      hasta: d('2026-08-15'),
    });
    expect(enRango.map((m) => m.nombre)).toEqual(['Copec', 'Jumbo']);
  });

  it('respeta el limite', () => {
    expect(listarMovimientos(base.db, base.contexto, { limite: 2 })).toHaveLength(2);
  });

  it('totalPorTipo suma solo el tipo pedido', () => {
    expect(totalPorTipo(base.db, base.contexto, 'gasto').amountMinor).toBe(77_000);
    expect(totalPorTipo(base.db, base.contexto, 'ingreso').amountMinor).toBe(1_480_000);
  });
});

describe('editar', () => {
  it('cambia solo lo que se le pasa', () => {
    const mov = nuevo();
    base.avanzarReloj(5_000);
    const editado = editarMovimiento(base.db, base.contexto, mov.id, { montoMinor: 51_000 });
    expect(editado?.montoMinor).toBe(51_000);
    expect(editado?.nombre).toBe('Jumbo');
    expect(editado?.categoriaId).toBe('comida');
  });

  it('adelanta updatedAt pero no toca createdAt', () => {
    const mov = nuevo();
    base.avanzarReloj(5_000);
    const editado = editarMovimiento(base.db, base.contexto, mov.id, { nombre: 'Lider' })!;
    expect(editado.createdAt).toBe(mov.createdAt);
    expect(editado.updatedAt > mov.updatedAt).toBe(true);
  });

  it('permite dejar la categoria en null', () => {
    const mov = nuevo();
    expect(editarMovimiento(base.db, base.contexto, mov.id, { categoriaId: null })?.categoriaId).toBeNull();
  });

  it('valida igual que al crear', () => {
    const mov = nuevo();
    expect(() => editarMovimiento(base.db, base.contexto, mov.id, { montoMinor: -5 })).toThrow(RepositorioError);
    expect(() => editarMovimiento(base.db, base.contexto, mov.id, { nombre: '  ' })).toThrow(RepositorioError);
  });

  it('devuelve null si el movimiento no existe', () => {
    expect(editarMovimiento(base.db, base.contexto, 'no-existe', { nombre: 'x' })).toBeNull();
  });
});

describe('borrar', () => {
  it('deja lapida, no elimina la fila', () => {
    // Es el criterio de verificacion de F1.
    const mov = nuevo();
    expect(borrarMovimiento(base.db, base.contexto, mov.id)).toBe(true);

    const conLapidas = listarConLapidas(base.db, base.contexto);
    expect(conLapidas).toHaveLength(1);
    expect(conLapidas[0]?.deletedAt).not.toBeNull();
    expect(conLapidas[0]?.nombre).toBe('Jumbo');
  });

  it('desaparece de todo lo que lee la app', () => {
    const mov = nuevo();
    borrarMovimiento(base.db, base.contexto, mov.id);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(0);
    expect(obtenerMovimiento(base.db, base.contexto, mov.id)).toBeNull();
    expect(contarMovimientos(base.db, base.contexto)).toBe(0);
    expect(totalPorTipo(base.db, base.contexto, 'gasto').amountMinor).toBe(0);
  });

  it('la lapida adelanta updatedAt, para que el borrado gane al fusionar', () => {
    const mov = nuevo();
    base.avanzarReloj(5_000);
    borrarMovimiento(base.db, base.contexto, mov.id);
    const fila = listarConLapidas(base.db, base.contexto)[0]!;
    expect(fila.updatedAt > mov.updatedAt).toBe(true);
    expect(fila.deletedAt).toBe(fila.updatedAt);
  });

  it('borrar dos veces devuelve false la segunda', () => {
    const mov = nuevo();
    expect(borrarMovimiento(base.db, base.contexto, mov.id)).toBe(true);
    expect(borrarMovimiento(base.db, base.contexto, mov.id)).toBe(false);
  });

  it('editar un movimiento borrado no lo resucita', () => {
    const mov = nuevo();
    borrarMovimiento(base.db, base.contexto, mov.id);
    expect(editarMovimiento(base.db, base.contexto, mov.id, { nombre: 'zombi' })).toBeNull();
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(0);
  });
});

describe('aislamiento por hogar', () => {
  it('un hogar no ve los movimientos de otro', () => {
    nuevo();
    const otro = crearBaseDePrueba({ householdId: 'hogar2' });
    try {
      // Misma base fisica no, pero el filtro por hogar es lo que se prueba:
      // el contexto de otro hogar no puede leer estas filas.
      const ajeno = { ...base.contexto, householdId: 'hogar2' };
      expect(listarMovimientos(base.db, ajeno)).toHaveLength(0);
      expect(contarMovimientos(base.db, ajeno)).toBe(0);
    } finally {
      otro.cerrar();
    }
  });
});
