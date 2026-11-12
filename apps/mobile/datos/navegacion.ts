/**
 * Volver atrás aunque no haya historial: llegando directo por URL (una recarga
 * en web estando en un formulario) la pila está vacía y `router.back()` falla.
 */

import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/** Ruta a la que caer cuando no hay historial: el resumen. */
const INICIO = '/(app)' as const;

export function volver(router: Router): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(INICIO);
}
