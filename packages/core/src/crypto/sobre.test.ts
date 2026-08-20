import { describe, expect, it } from 'vitest';
import {
  CifradoError, VERSION_DE_SOBRE, aBase64, cifrar, deBase64, descifrar, esSobre, fraseDebil,
} from './sobre';

const FRASE = 'una frase larga y difícil';

describe('base64 propio', () => {
  it('va y vuelve con cualquier largo', () => {
    // Los tres restos posibles al dividir por 3 son los tres casos del relleno.
    for (const largo of [0, 1, 2, 3, 4, 5, 17, 64, 255]) {
      const bytes = Uint8Array.from({ length: largo }, (_, i) => (i * 37) % 256);
      expect([...deBase64(aBase64(bytes))]).toEqual([...bytes]);
    }
  });

  it('coincide con el base64 de siempre', () => {
    const bytes = new TextEncoder().encode('hola mundo');
    expect(aBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('lee lo que produce cualquier codificador estandar', () => {
    const original = 'ñandú con acentos y símbolos: €%&';
    const desdeNode = Buffer.from(original, 'utf8').toString('base64');
    expect(new TextDecoder().decode(deBase64(desdeNode))).toBe(original);
  });
});

describe('cifrar y descifrar', () => {
  it('vuelve el mismo texto', () => {
    const sobre = cifrar('{"movimientos":[]}', FRASE);
    expect(descifrar(sobre, FRASE)).toBe('{"movimientos":[]}');
  });

  it('aguanta acentos, emoji y textos largos', () => {
    const texto = `ñ á é í ó ú 🐧 ${'x'.repeat(50_000)}`;
    expect(descifrar(cifrar(texto, FRASE), FRASE)).toBe(texto);
  });

  it('el sobre no contiene el texto en claro', () => {
    const sobre = cifrar('SUELDO SECRETO 1234567', FRASE);
    expect(JSON.stringify(sobre)).not.toContain('SUELDO');
    expect(JSON.stringify(sobre)).not.toContain('1234567');
  });

  it('el sobre tampoco contiene la frase', () => {
    const sobre = cifrar('algo', FRASE);
    expect(JSON.stringify(sobre)).not.toContain(FRASE);
  });

  it('es JSON: viaja como archivo', () => {
    const sobre = cifrar('algo', FRASE);
    expect(descifrar(JSON.parse(JSON.stringify(sobre)), FRASE)).toBe('algo');
  });

  it('rechaza una frase vacia', () => {
    expect(() => cifrar('algo', '')).toThrow(CifradoError);
  });
});

describe('cada cifrado es distinto', () => {
  it('el mismo texto con la misma frase da dos archivos distintos', () => {
    // Sal y nonce nuevos cada vez: comparar dos respaldos no revela si cambio algo.
    const uno = cifrar('lo mismo', FRASE);
    const otro = cifrar('lo mismo', FRASE);
    expect(uno.cifrado).not.toBe(otro.cifrado);
    expect(uno.sal).not.toBe(otro.sal);
    expect(uno.nonce).not.toBe(otro.nonce);
  });

  it('y los dos abren igual', () => {
    expect(descifrar(cifrar('lo mismo', FRASE), FRASE)).toBe('lo mismo');
    expect(descifrar(cifrar('lo mismo', FRASE), FRASE)).toBe('lo mismo');
  });
});

describe('lo que tiene que fallar', () => {
  it('con la frase equivocada', () => {
    const sobre = cifrar('secreto', FRASE);
    expect(() => descifrar(sobre, 'otra frase distinta')).toThrow(CifradoError);
  });

  it('si le tocan un byte al texto cifrado', () => {
    // Poly1305 autentica: un archivo alterado no devuelve datos corrompidos, falla.
    const sobre = cifrar('secreto', FRASE);
    const bytes = deBase64(sobre.cifrado);
    bytes[0] = bytes[0]! ^ 0xff;
    expect(() => descifrar({ ...sobre, cifrado: aBase64(bytes) }, FRASE)).toThrow(CifradoError);
  });

  it('si le cambian la sal', () => {
    const sobre = cifrar('secreto', FRASE);
    const sal = deBase64(sobre.sal);
    sal[0] = sal[0]! ^ 0xff;
    expect(() => descifrar({ ...sobre, sal: aBase64(sal) }, FRASE)).toThrow(CifradoError);
  });

  it('el mensaje no distingue frase mala de archivo tocado', () => {
    // Distinguirlas le diria a quien prueba frases que va por buen camino.
    const sobre = cifrar('secreto', FRASE);
    const bytes = deBase64(sobre.cifrado);
    bytes[0] = bytes[0]! ^ 0xff;

    const porFrase = (() => { try { descifrar(sobre, 'mala'); } catch (e) { return (e as Error).message; } })();
    const porBytes = (() => {
      try { descifrar({ ...sobre, cifrado: aBase64(bytes) }, FRASE); } catch (e) { return (e as Error).message; }
    })();
    expect(porFrase).toBe(porBytes);
  });

  it('con un JSON que no es un sobre', () => {
    expect(() => descifrar({ hola: 'mundo' }, FRASE)).toThrow(CifradoError);
    expect(() => descifrar(null, FRASE)).toThrow(CifradoError);
    expect(() => descifrar('texto suelto', FRASE)).toThrow(CifradoError);
  });

  it('con un sobre de una version mas nueva', () => {
    const sobre = { ...cifrar('secreto', FRASE), version: VERSION_DE_SOBRE + 1 };
    expect(() => descifrar(sobre, FRASE)).toThrow(/más nueva/);
  });

  it('con parametros de scrypt absurdos, en vez de colgar la app', () => {
    // Un sobre manipulado con `n` gigante pediria terabytes de memoria.
    const sobre = { ...cifrar('secreto', FRASE), n: 2 ** 30 };
    expect(() => descifrar(sobre, FRASE)).toThrow(/fuera de rango/);
  });

  it('con un nonce del largo equivocado', () => {
    const sobre = { ...cifrar('secreto', FRASE), nonce: aBase64(new Uint8Array(8)) };
    expect(() => descifrar(sobre, FRASE)).toThrow(/incompleto/);
  });
});

describe('esSobre', () => {
  it('reconoce uno cifrado', () => {
    expect(esSobre(cifrar('algo', FRASE))).toBe(true);
  });

  it('no confunde un respaldo en claro con uno cifrado', () => {
    // Es lo que decide si la pantalla pide la frase o abre el archivo directo.
    expect(esSobre({ version: 2, cuentas: [], movimientos: [] })).toBe(false);
  });
});

describe('fraseDebil', () => {
  it('acepta una frase razonable', () => {
    expect(fraseDebil('caballo batería grapa')).toBeNull();
  });

  it('rechaza las cortas, las de puros números y las repetitivas', () => {
    expect(fraseDebil('corta')).not.toBeNull();
    expect(fraseDebil('12345678')).not.toBeNull();
    expect(fraseDebil('aaaaaaaaaa')).not.toBeNull();
  });
});

describe('la frase se normaliza', () => {
  it('la misma frase con tildes compuestas o descompuestas abre igual', () => {
    // En un teclado de telefono esto pasa sin que nadie lo note.
    const compuesta = 'contraseña única';
    const descompuesta = compuesta.normalize('NFD');
    expect(compuesta).not.toBe(descompuesta);
    expect(descifrar(cifrar('secreto', compuesta), descompuesta)).toBe('secreto');
  });
});
