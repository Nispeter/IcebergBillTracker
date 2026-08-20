import { describe, expect, it } from 'vitest';
import { crearContexto } from './contexto';

const RELOJ = 1_756_000_000_000;
const crear = (deviceId: string) =>
  crearContexto({ householdId: 'h', deviceId, memberId: 'm', reloj: () => RELOJ });

/**
 * Un sello ajeno con el mismo instante pero contador alto.
 *
 * Se arma a partir de uno real en vez de escribirlo a mano: el formato lleva
 * relleno de ancho fijo y equivocarse de posicion hace que el test compare otra
 * cosa. La primera version de este archivo tenia justamente ese error.
 */
function selloAjeno(): string {
  const propio = crear('cualquiera').ahora();
  const [millis] = propio.split('-');
  return `${millis}-09999-otro`;
}

describe('recibir adelanta el reloj', () => {
  it('sin recibir, lo propio nace perdiendo contra un sello mayor', () => {
    const ajeno = selloAjeno();
    expect(crear('aparatoA').ahora() > ajeno).toBe(false);
  });

  it('despues de recibirlo, lo propio le gana', () => {
    // Es el bug que rompia la fusion sin que se viera: el usuario editaba
    // despues de sincronizar y su cambio nacia perdiendo contra lo recibido.
    const ajeno = selloAjeno();
    const local = crear('aparatoA');
    local.recibir(ajeno);
    expect(local.ahora() > ajeno).toBe(true);
  });

  it('un sello ilegible se ignora en vez de reventar', () => {
    const local = crear('aparatoA');
    expect(() => local.recibir('no es un hlc')).not.toThrow();
    expect(() => local.ahora()).not.toThrow();
  });

  it('recibir algo viejo no atrasa el reloj', () => {
    const local = crear('aparatoA');
    const primero = local.ahora();
    local.recibir('000000000000001-00000-otro');
    expect(local.ahora() > primero).toBe(true);
  });

  it('rechaza un reloj remoto absurdamente adelantado', () => {
    // Es la guarda de deriva: un aparato con la hora mal puesta no puede dejar
    // a los demas sin poder escribir nada que le gane.
    const local = crear('aparatoA');
    const futuro = `${String(RELOJ + 60 * 60 * 1000).padStart(15, '0')}-00000-otro`;
    expect(() => local.recibir(futuro)).toThrow();
  });
});
