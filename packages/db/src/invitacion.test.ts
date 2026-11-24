import { describe, expect, it } from 'vitest';
import { armarInvitacion, leerInvitacion } from './invitacion';

const cifrada = { hogar: 'HOGARDEPRUEBA00000000000000', frase: 'nieve-trineo-foca-042' };
const planilla = { hogar: 'HOGARDEPRUEBA00000000000000' };

describe('la invitación', () => {
  it('se lee igual a como se armó', () => {
    expect(leerInvitacion(armarInvitacion(cifrada))).toEqual(cifrada);
    expect(leerInvitacion(armarInvitacion(planilla))).toEqual(planilla);
  });

  it('se encuentra dentro del mensaje entero', () => {
    const mensaje = `Únete a mi hogar en Iceberg.\n\n${armarInvitacion(cifrada)}\n`;

    expect(leerInvitacion(mensaje)).toEqual(cifrada);
  });

  it('sin palabra es del modo planilla, aunque venga pegada al resto del mensaje', () => {
    // Un campo de una sola línea se come los saltos: lo que sigue queda pegado.
    expect(leerInvitacion(`Únete.${armarInvitacion(planilla)}`)).toEqual(planilla);
  });

  it('aguanta una palabra escrita a mano, con espacios y dos puntos', () => {
    const propia = { hogar: 'CASA1', frase: 'la casa: de los dos' };

    expect(leerInvitacion(armarInvitacion(propia))).toEqual(propia);
  });

  it('aguanta mayúsculas puestas por el teclado y espacios de más', () => {
    expect(leerInvitacion(`  Iceberg:${cifrada.hogar}:${cifrada.frase}   `)).toEqual(cifrada);
  });

  it('una palabra de puros espacios es como no tenerla', () => {
    expect(leerInvitacion(`iceberg:${cifrada.hogar}:   `)).toEqual(planilla);
  });

  it('un texto cualquiera no es una invitación', () => {
    expect(leerInvitacion(cifrada.hogar)).toBeNull();
    expect(leerInvitacion('hola')).toBeNull();
  });
});
