import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { CLAVE_DISPOSITIVO, escribirAjuste, leerAjuste, leerOCrear } from './ajustes';

let base: BaseDePrueba;
beforeEach(() => { base = crearBaseDePrueba(); });
afterEach(() => base.cerrar());

describe('ajustes', () => {
  it('leer una clave que no existe devuelve null', () => {
    expect(leerAjuste(base.db, 'nada')).toBeNull();
  });

  it('escribir y leer', () => {
    escribirAjuste(base.db, CLAVE_DISPOSITIVO, 'telefono1');
    expect(leerAjuste(base.db, CLAVE_DISPOSITIVO)).toBe('telefono1');
  });

  it('escribir dos veces la misma clave actualiza, no duplica', () => {
    escribirAjuste(base.db, CLAVE_DISPOSITIVO, 'viejo');
    escribirAjuste(base.db, CLAVE_DISPOSITIVO, 'nuevo');
    expect(leerAjuste(base.db, CLAVE_DISPOSITIVO)).toBe('nuevo');
  });

  it('leerOCrear genera la primera vez y despues devuelve lo mismo', () => {
    // Es la garantia que sostiene la identidad del dispositivo: si cambiara
    // entre arranques, el origin_device_id de las filas ya escritas mentiria.
    let llamadas = 0;
    const generar = () => { llamadas += 1; return `generado${llamadas}`; };

    const primera = leerOCrear(base.db, CLAVE_DISPOSITIVO, generar);
    const segunda = leerOCrear(base.db, CLAVE_DISPOSITIVO, generar);
    const tercera = leerOCrear(base.db, CLAVE_DISPOSITIVO, generar);

    expect(primera).toBe('generado1');
    expect(segunda).toBe('generado1');
    expect(tercera).toBe('generado1');
    expect(llamadas).toBe(1);
  });
});
