/**
 * Qué día es hoy, y que deje de serlo a medianoche. `dates.today()` contesta
 * una vez; una app que se deja abierta seguía marcando ayer a la mañana siguiente.
 *
 * Vuelve a preguntar al volver del fondo (Android no corre temporizadores con
 * el proceso dormido) y con una alarma a medianoche, topada en una hora: la
 * medianoche sale del reloj del teléfono y `today()` de la zona de Chile, y con
 * el tope cualquier diferencia se corrige sola.
 */

import { dates } from '@iceberg/core';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Cada cuanto se revisa como maximo, aunque la medianoche este mas lejos. */
const TOPE = 60 * 60 * 1000;

/** Unos segundos despues de las doce, para no caer justo en el borde. */
function faltaParaMedianoche(ahora: Date): number {
  const proxima = new Date(ahora);
  proxima.setHours(24, 0, 5, 0);
  return Math.min(proxima.getTime() - ahora.getTime(), TOPE);
}

export function useHoy(): dates.PlainDate {
  const [hoy, setHoy] = useState(dates.today);

  useEffect(() => {
    let alarma: ReturnType<typeof setTimeout>;

    const revisar = () => {
      // Si el dia no cambio, React descarta el estado igual y no redibuja nada:
      // por eso revisar de mas no cuesta.
      setHoy(dates.today());
      alarma = setTimeout(revisar, faltaParaMedianoche(new Date()));
    };

    revisar();
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') return;
      clearTimeout(alarma);
      revisar();
    });

    return () => { clearTimeout(alarma); suscripcion.remove(); };
  }, []);

  return hoy;
}
