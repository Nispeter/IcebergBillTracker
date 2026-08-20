/**
 * Cifrar el archivo de sincronizacion con una frase.
 *
 * El respaldo va a vivir en una carpeta de nube compartida, y ahi adentro esta
 * **todo**: cuanto gana, en que gasta, donde compra, con quien transfiere. Si esa
 * carpeta se filtra o la nube se equivoca de permisos, un JSON en claro es el
 * historial financiero completo de alguien.
 *
 * El sobre es autocontenido: lleva la sal, el nonce y los parametros de
 * derivacion. Descifrar necesita el archivo y la frase, nada mas. Sin eso, un
 * respaldo de hace un ano seria ilegible en cuanto cambiaran los parametros.
 *
 * ## Decisiones
 *
 * - **scrypt** y no un hash a secas: derivar la clave tiene que costar. Una
 *   frase humana tiene poca entropia, y sin una KDF lenta un ataque por
 *   diccionario contra el archivo robado es cuestion de minutos.
 * - **XChaCha20-Poly1305** y no AES-GCM. El nonce de 24 bytes se puede sortear
 *   al azar sin miedo a repetirlo; el de 12 de AES-GCM obliga a llevar un
 *   contador, y repetir un nonce con la misma clave rompe el cifrado entero.
 * - **Autenticado**: si alguien toca un byte, descifrar falla en vez de
 *   devolver datos corrompidos que la app escribiria como si nada.
 * - **Sal y nonce nuevos en cada cifrado.** Dos respaldos de la misma base con
 *   la misma frase dan archivos distintos, y comparar dos versiones no revela
 *   si cambio algo.
 *
 * No inventa criptografia: usa `@noble/ciphers` y `@noble/hashes`, que son TS
 * puro sin dependencias y corren igual en Node y en el telefono.
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToUtf8, randomBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { scrypt } from '@noble/hashes/scrypt.js';

export class CifradoError extends Error {
  override name = 'CifradoError';
}

/** Version del formato del sobre. Sube si cambian los parametros o el cifrado. */
export const VERSION_DE_SOBRE = 1;

/**
 * Parametros de scrypt.
 *
 * `N = 2^15` con `r = 8` pide 32 MB de memoria y tarda del orden de cien
 * milisegundos: molesto de repetir millones de veces, imperceptible al abrir un
 * archivo. Van **dentro del sobre** para que subirlos no vuelva ilegible lo ya
 * cifrado.
 */
const KDF = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 } as const;

const LARGO_SAL = 16;
/** XChaCha usa nonce de 24 bytes: al azar no se repite en la practica. */
const LARGO_NONCE = 24;

export interface Sobre {
  readonly version: number;
  readonly kdf: 'scrypt';
  readonly n: number;
  readonly r: number;
  readonly p: number;
  /** Todo en base64: el sobre viaja como JSON. */
  readonly sal: string;
  readonly nonce: string;
  readonly cifrado: string;
}

/** Si un objeto cualquiera tiene forma de sobre cifrado. */
export function esSobre(crudo: unknown): crudo is Sobre {
  if (typeof crudo !== 'object' || crudo === null) return false;
  const posible = crudo as Partial<Sobre>;
  return posible.kdf === 'scrypt'
    && typeof posible.version === 'number'
    && typeof posible.sal === 'string'
    && typeof posible.nonce === 'string'
    && typeof posible.cifrado === 'string';
}

/* eslint-disable no-bitwise */

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64 a mano.
 *
 * `btoa` no existe en React Native y `Buffer` no existe en el navegador, asi que
 * cualquiera de los dos dejaria a `core` atado a una plataforma. Son veinte
 * lineas y se prueban solas.
 */
export function aBase64(bytes: Uint8Array): string {
  let salida = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    salida += ALFABETO[a >> 2];
    salida += ALFABETO[((a & 3) << 4) | ((b ?? 0) >> 4)];
    salida += b === undefined ? '=' : ALFABETO[((b & 15) << 2) | ((c ?? 0) >> 6)];
    salida += c === undefined ? '=' : ALFABETO[c & 63];
  }
  return salida;
}

export function deBase64(texto: string): Uint8Array {
  const limpio = texto.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array((limpio.length * 3) >> 2);
  let escritos = 0;
  let acumulado = 0;
  let bits = 0;

  for (const caracter of limpio) {
    const valor = ALFABETO.indexOf(caracter);
    if (valor < 0) throw new CifradoError('el archivo tiene caracteres que no son base64');
    acumulado = (acumulado << 6) | valor;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[escritos++] = (acumulado >> bits) & 0xff;
    }
  }
  return bytes.subarray(0, escritos);
}

/* eslint-enable no-bitwise */

function derivarClave(frase: string, sal: Uint8Array, n: number, r: number, p: number): Uint8Array {
  return scrypt(utf8ToBytes(frase.normalize('NFC')), sal, { N: n, r, p, dkLen: KDF.dkLen });
}

/**
 * Cifra un texto con una frase.
 *
 * La frase se normaliza a NFC: la misma frase escrita con tildes compuestas o
 * descompuestas tiene que abrir el mismo archivo, y en un teclado de telefono
 * eso pasa sin que nadie lo note.
 */
export function cifrar(textoPlano: string, frase: string): Sobre {
  if (frase.length === 0) throw new CifradoError('la frase no puede estar vacía');

  const sal = randomBytes(LARGO_SAL);
  const nonce = randomBytes(LARGO_NONCE);
  const clave = derivarClave(frase, sal, KDF.N, KDF.r, KDF.p);
  const cifrado = xchacha20poly1305(clave, nonce).encrypt(utf8ToBytes(textoPlano));

  return {
    version: VERSION_DE_SOBRE,
    kdf: 'scrypt',
    n: KDF.N,
    r: KDF.r,
    p: KDF.p,
    sal: aBase64(sal),
    nonce: aBase64(nonce),
    cifrado: aBase64(cifrado),
  };
}

/**
 * Descifra un sobre. Revienta si la frase esta mal o el archivo fue tocado.
 *
 * Los dos casos dan el **mismo mensaje** a proposito: distinguir "frase
 * incorrecta" de "archivo corrupto" le dice a quien prueba frases que va por
 * buen camino.
 */
export function descifrar(sobre: unknown, frase: string): string {
  if (!esSobre(sobre)) throw new CifradoError('el archivo no es un respaldo cifrado');
  if (sobre.version > VERSION_DE_SOBRE) {
    throw new CifradoError(
      `el archivo se cifró con una versión más nueva de la app (${sobre.version})`,
    );
  }

  const sal = deBase64(sobre.sal);
  const nonce = deBase64(sobre.nonce);
  if (sal.length === 0 || nonce.length !== LARGO_NONCE) {
    throw new CifradoError('el archivo cifrado está incompleto');
  }
  // Los parametros vienen del archivo, pero con techo: un sobre manipulado con
  // `n` gigante colgaria la app pidiendo terabytes de memoria.
  if (sobre.n > 2 ** 20 || sobre.r > 32 || sobre.p > 16) {
    throw new CifradoError('el archivo pide parámetros de descifrado fuera de rango');
  }

  const clave = derivarClave(frase, sal, sobre.n, sobre.r, sobre.p);
  try {
    return bytesToUtf8(
      xchacha20poly1305(clave, nonce).decrypt(deBase64(sobre.cifrado)),
    );
  } catch {
    throw new CifradoError('No se pudo abrir el archivo: la frase no coincide, o el archivo cambió.');
  }
}

/**
 * Que tan buena es una frase, para poder decirlo antes de usarla.
 *
 * No es un medidor de entropia serio y no pretende serlo: es lo justo para
 * frenar "1234". Lo que de verdad protege es scrypt.
 */
export function fraseDebil(frase: string): string | null {
  if (frase.length < 8) return 'Usa al menos 8 caracteres.';
  if (/^\d+$/.test(frase)) return 'Solo números es fácil de adivinar. Mezcla palabras.';
  if (new Set(frase).size < 4) return 'Muy pocos caracteres distintos.';
  return null;
}
