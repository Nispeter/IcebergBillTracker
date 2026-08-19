/**
 * Volver atras sin depender de que haya historial.
 *
 * `router.back()` solo funciona si la pantalla actual se abrio desde otra. Si se
 * llega directo por URL —cosa normal en web: un enlace compartido, una recarga
 * estando en el modal, o abrir `/nuevo` a mano— la pila esta vacia y el
 * navegador tira `The action 'GO_BACK' was not handled by any navigator`.
 *
 * Se resuelve preguntando primero y cayendo a una ruta conocida si no hay a
 * donde volver.
 */

import type { useRouter } from 'expo-router';

// Se deriva del hook en vez de importar el tipo por nombre: asi no se rompe si
// expo-router lo renombra entre versiones.
type Router = ReturnType<typeof useRouter>;

/** Ruta a la que caer cuando no hay historial. */
const INICIO = '/' as const;

export function volver(router: Router): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(INICIO);
}
