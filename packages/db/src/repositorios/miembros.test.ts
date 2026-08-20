import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import {
  NOMBRE_POR_DEFECTO, asegurarMiembro, listarMiembros, nombreDeMiembro, obtenerMiembro,
  renombrarMiembro,
} from './miembros';

let base: BaseDePrueba;

beforeEach(() => { base = crearBaseDePrueba({ memberId: 'miembro-de-este-aparato' }); });
afterEach(() => base.cerrar());

describe('asegurarMiembro', () => {
  it('crea la fila con el id que ya usaban los movimientos', () => {
    // Generar uno nuevo dejaria sin dueno toda la historia escrita antes de que
    // existiera la tabla.
    const miembro = asegurarMiembro(base.db, base.contexto);
    expect(miembro.id).toBe('miembro-de-este-aparato');
    expect(miembro.nombre).toBe(NOMBRE_POR_DEFECTO);
    expect(miembro.dispositivoId).toBe(base.contexto.deviceId);
  });

  it('es idempotente y no toca el updatedAt', () => {
    // Cada apertura de la app generaria una escritura que ganaria conflictos
    // contra el otro telefono sin que nadie hubiera editado nada.
    const primero = asegurarMiembro(base.db, base.contexto);
    const segundo = asegurarMiembro(base.db, base.contexto);
    expect(segundo.updatedAt).toBe(primero.updatedAt);
    expect(listarMiembros(base.db, base.contexto)).toHaveLength(1);
  });
});

describe('renombrar', () => {
  it('cambia el nombre', () => {
    const miembro = asegurarMiembro(base.db, base.contexto);
    renombrarMiembro(base.db, base.contexto, miembro.id, '  Teléfono de Nico  ');
    expect(obtenerMiembro(base.db, base.contexto, miembro.id)?.nombre).toBe('Teléfono de Nico');
  });

  it('rechaza un nombre vacio', () => {
    const miembro = asegurarMiembro(base.db, base.contexto);
    expect(() => renombrarMiembro(base.db, base.contexto, miembro.id, '   ')).toThrow();
  });

  it('devuelve null si el miembro no existe', () => {
    expect(renombrarMiembro(base.db, base.contexto, 'no-existe', 'X')).toBeNull();
  });

  it('renombrar avanza el updatedAt: es una edicion que tiene que viajar', () => {
    const miembro = asegurarMiembro(base.db, base.contexto);
    const despues = renombrarMiembro(base.db, base.contexto, miembro.id, 'Otro nombre');
    expect(despues!.updatedAt > miembro.updatedAt).toBe(true);
  });
});

describe('nombreDeMiembro', () => {
  it('devuelve el nombre cuando lo conoce', () => {
    const miembro = asegurarMiembro(base.db, base.contexto);
    renombrarMiembro(base.db, base.contexto, miembro.id, 'Nico');
    expect(nombreDeMiembro(listarMiembros(base.db, base.contexto), miembro.id)).toBe('Nico');
  });

  it('devuelve el id crudo si no lo conoce', () => {
    // Pasa con filas que llegaron por sincronizacion antes que la fila de
    // miembro del otro aparato. Feo pero honesto; inventar un nombre seria peor.
    expect(nombreDeMiembro([], 'un-id-cualquiera')).toBe('un-id-cualquiera');
  });

  it('devuelve una raya si no hay autor', () => {
    expect(nombreDeMiembro([], null)).toBe('—');
  });
});
