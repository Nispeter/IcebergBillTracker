import { describe, expect, it } from 'vitest';
import {
  HlcError, hlcCompare, hlcNow, hlcParse, hlcReceive, hlcToString, type Hlc,
} from './hlc';

const T0 = 1_756_000_000_000;

describe('hlcNow', () => {
  it('arranca en el reloj de pared con el contador en cero', () => {
    expect(hlcNow(null, 'tel1', T0)).toEqual({ millis: T0, counter: 0, nodeId: 'tel1' });
  });

  it('avanza el milisegundo cuando el reloj de pared avanzo', () => {
    const a = hlcNow(null, 'tel1', T0);
    expect(hlcNow(a, 'tel1', T0 + 5)).toEqual({ millis: T0 + 5, counter: 0, nodeId: 'tel1' });
  });

  it('usa el contador cuando dos escrituras caen en el mismo milisegundo', () => {
    const a = hlcNow(null, 'tel1', T0);
    const b = hlcNow(a, 'tel1', T0);
    const c = hlcNow(b, 'tel1', T0);
    expect([b.counter, c.counter]).toEqual([1, 2]);
    expect(hlcCompare(a, b)).toBe(-1);
    expect(hlcCompare(b, c)).toBe(-1);
  });

  it('nunca retrocede aunque el reloj del sistema se atrase', () => {
    // Pasa de verdad: al ajustar la hora o al cambiar de zona horaria.
    const a = hlcNow(null, 'tel1', T0);
    const b = hlcNow(a, 'tel1', T0 - 60_000);
    expect(b.millis).toBe(T0);
    expect(hlcCompare(a, b)).toBe(-1);
  });

  it('desborda al milisegundo siguiente si se agota el contador', () => {
    const lleno: Hlc = { millis: T0, counter: 99_999, nodeId: 'tel1' };
    const siguiente = hlcNow(lleno, 'tel1', T0);
    expect(siguiente).toEqual({ millis: T0 + 1, counter: 0, nodeId: 'tel1' });
    expect(hlcCompare(lleno, siguiente)).toBe(-1);
  });

  it('rechaza nodeId vacio o con guiones, que romperian el formato', () => {
    expect(() => hlcNow(null, '', T0)).toThrow(HlcError);
    expect(() => hlcNow(null, 'tel-1', T0)).toThrow(HlcError);
  });

  it('rechaza un reloj invalido', () => {
    expect(() => hlcNow(null, 'tel1', Number.NaN)).toThrow(HlcError);
    expect(() => hlcNow(null, 'tel1', -1)).toThrow(HlcError);
  });
});

describe('hlcReceive', () => {
  it('adelanta el reloj local cuando el remoto viene del futuro', () => {
    // El caso que justifica todo: el otro telefono tiene el reloj adelantado.
    const local = hlcNow(null, 'tel1', T0);
    const remoto: Hlc = { millis: T0 + 10_000, counter: 3, nodeId: 'tel2' };
    const fusionado = hlcReceive(local, remoto, 'tel1', T0);
    expect(fusionado.millis).toBe(T0 + 10_000);
    expect(hlcCompare(remoto, fusionado)).toBe(-1);
  });

  it('lo que se escribe despues de recibir queda ordenado despues', () => {
    const local = hlcNow(null, 'tel1', T0);
    const remoto: Hlc = { millis: T0 + 10_000, counter: 3, nodeId: 'tel2' };
    const tras = hlcReceive(local, remoto, 'tel1', T0);
    const siguiente = hlcNow(tras, 'tel1', T0);
    expect(hlcCompare(remoto, siguiente)).toBe(-1);
  });

  it('desempata por contador cuando el milisegundo coincide', () => {
    const local: Hlc = { millis: T0, counter: 1, nodeId: 'tel1' };
    const remoto: Hlc = { millis: T0, counter: 7, nodeId: 'tel2' };
    const fusionado = hlcReceive(local, remoto, 'tel1', T0);
    expect(fusionado.millis).toBe(T0);
    expect(fusionado.counter).toBe(8);
  });

  it('ignora un remoto viejo y solo avanza lo propio', () => {
    const local = hlcNow(null, 'tel1', T0);
    const remoto: Hlc = { millis: T0 - 50_000, counter: 0, nodeId: 'tel2' };
    const fusionado = hlcReceive(local, remoto, 'tel1', T0);
    expect(fusionado.millis).toBe(T0);
    expect(hlcCompare(local, fusionado)).toBe(-1);
  });
});

describe('texto', () => {
  it('el orden lexicografico coincide con el orden causal', () => {
    // Es lo que permite que SQLite ordene por la columna sin funciones propias.
    const serie: Hlc[] = [];
    let actual = hlcNow(null, 'tel1', T0);
    serie.push(actual);
    for (const salto of [0, 0, 1, 999, 100_000]) {
      actual = hlcNow(actual, 'tel1', actual.millis + salto);
      serie.push(actual);
    }
    const porTexto = [...serie].sort((a, b) => hlcToString(a).localeCompare(hlcToString(b)));
    const porOrden = [...serie].sort(hlcCompare);
    expect(porTexto).toEqual(porOrden);
  });

  it('el texto tiene ancho fijo en millis y contador', () => {
    const texto = hlcToString({ millis: T0, counter: 7, nodeId: 'tel1' });
    expect(texto).toBe('001756000000000-00007-tel1');
  });

  it('ida y vuelta', () => {
    const hlc: Hlc = { millis: T0, counter: 42, nodeId: 'telefonoDeNico' };
    expect(hlcParse(hlcToString(hlc))).toEqual(hlc);
  });

  it('parse devuelve null con basura, en vez de lanzar', () => {
    // Puede venir de otro dispositivo con otra version de la app.
    expect(hlcParse('')).toBeNull();
    expect(hlcParse('2026-08-19T00:00:00Z')).toBeNull();
    expect(hlcParse('123-45-tel1')).toBeNull();
  });
});

describe('hlcCompare', () => {
  it('ordena por millis, despues por contador, despues por nodo', () => {
    expect(hlcCompare({ millis: 1, counter: 9, nodeId: 'z' }, { millis: 2, counter: 0, nodeId: 'a' })).toBe(-1);
    expect(hlcCompare({ millis: 1, counter: 0, nodeId: 'z' }, { millis: 1, counter: 1, nodeId: 'a' })).toBe(-1);
    expect(hlcCompare({ millis: 1, counter: 0, nodeId: 'a' }, { millis: 1, counter: 0, nodeId: 'z' })).toBe(-1);
  });

  it('dos identicos son iguales', () => {
    const h: Hlc = { millis: 1, counter: 0, nodeId: 'a' };
    expect(hlcCompare(h, { ...h })).toBe(0);
  });

  it('el desempate por nodo es estable: dos dispositivos convergen al mismo orden', () => {
    // Sin esta regla, dos telefonos podrian ordenar distinto el mismo par y no
    // converger nunca.
    const a: Hlc = { millis: 1, counter: 0, nodeId: 'tel1' };
    const b: Hlc = { millis: 1, counter: 0, nodeId: 'tel2' };
    expect(hlcCompare(a, b)).toBe(-1);
    expect(hlcCompare(b, a)).toBe(1);
  });
});
