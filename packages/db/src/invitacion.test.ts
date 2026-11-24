import { describe, expect, it } from 'vitest';
import { armarInvitacion, leerInvitacion } from './invitacion';

const invitacion = { hogar: 'HOGARDEPRUEBA00000000000000', frase: 'nieve-trineo-foca-042' };

describe('la invitación', () => {
  it('se lee igual a como se armó', () => {
    expect(leerInvitacion(armarInvitacion(invitacion))).toEqual(invitacion);
  });

  it('se encuentra dentro del mensaje entero', () => {
    const mensaje = `Únete a mi hogar en Iceberg.\n\n${armarInvitacion(invitacion)}\n`;

    expect(leerInvitacion(mensaje)).toEqual(invitacion);
  });

  it('aguanta una palabra escrita a mano, con espacios y dos puntos', () => {
    const propia = { hogar: 'CASA1', frase: 'la casa: de los dos' };

    expect(leerInvitacion(armarInvitacion(propia))).toEqual(propia);
  });

  it('aguanta mayúsculas puestas por el teclado y espacios de más', () => {
    expect(leerInvitacion(`  Iceberg:${invitacion.hogar}:${invitacion.frase}   `)).toEqual(invitacion);
  });

  it('un texto cualquiera no es una invitación', () => {
    expect(leerInvitacion(invitacion.hogar)).toBeNull();
    expect(leerInvitacion('hola')).toBeNull();
    expect(leerInvitacion(`iceberg:${invitacion.hogar}:   `)).toBeNull();
  });
});
