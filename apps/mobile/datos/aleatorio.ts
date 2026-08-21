/**
 * `crypto.getRandomValues` para Hermes.
 *
 * En el navegador este metodo viene con la plataforma. En React Native **no
 * existe**: Hermes no trae la Web Crypto API, y ningun polyfill entra solo. El
 * sintoma no fue obvio --la app arrancaba y moria con "No se pudo abrir la base:
 * Failed to find a reliable PRNG"-- porque quien lo pide primero es `ulid`, al
 * generar el identificador de la primera fila.
 *
 * Y lo pide **mas de uno**: ademas de los ULID de cada movimiento, `@noble` lo
 * usa para la sal del cifrado del respaldo. Los dos leen el mismo global, asi
 * que se arregla una vez y en un solo lugar.
 *
 * Va con `expo-crypto` y no con `react-native-get-random-values`, que es el
 * polyfill habitual: ese es un modulo nativo de terceros y **no viene dentro de
 * Expo Go**, asi que habria obligado a un development build --justo lo que se
 * queria evitar para poder probar en el telefono--. `expo-crypto` es parte del
 * SDK y ya viene incluido.
 *
 * **Se importa por su efecto, no por lo que exporta**, y tiene que ser lo
 * primero que corra en la app. En web no hace nada: si el metodo ya esta, no se
 * toca.
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
