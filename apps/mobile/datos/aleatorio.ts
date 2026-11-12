/**
 * `crypto.getRandomValues` para Hermes, que no trae la Web Crypto API. Lo piden
 * `ulid` (el id de cada fila) y `@noble` (la sal del cifrado); sin esto la app
 * muere al abrir la base con "Failed to find a reliable PRNG".
 *
 * Con `expo-crypto`, que viene en Expo Go, y no con el polyfill de terceros
 * habitual, que obligaría a un development build. Se importa por su efecto y
 * tiene que correr primero. En web no toca nada.
 */

import { getRandomValues } from 'expo-crypto';

// `globalThis.crypto` puede no existir, o existir sin el metodo. Los dos casos
// terminan igual, asi que se arma lo que falte en vez de asumir cual es.
const raiz = globalThis as { crypto?: { getRandomValues?: unknown } };

if (raiz.crypto === undefined) {
  Object.defineProperty(raiz, 'crypto', { value: {}, writable: true, configurable: true });
}

if (typeof raiz.crypto?.getRandomValues !== 'function') {
  Object.defineProperty(raiz.crypto as object, 'getRandomValues', {
    value: getRandomValues,
    writable: true,
    configurable: true,
  });
}
