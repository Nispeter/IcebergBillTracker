/**
 * Que dia es hoy, **y que deje de serlo cuando deje de serlo**.
 *
 * `dates.today()` contesta bien, pero contesta una vez: lo que devuelve queda
 * congelado en el render donde se llamo. Una app de telefono no se cierra, se
 * deja abierta, y a la mañana siguiente seguia marcando el dia anterior en el
 * calendario. Nada estaba mal calculado; nadie volvia a preguntar.
 *
 * Por eso es un hook y no una funcion: React necesita que algo le avise para
 * volver a dibujar, y ese algo es el estado de aca adentro.
 *
 * ## Cuando vuelve a preguntar
 *
 * En dos momentos, porque son dos formas distintas de cruzar la medianoche:
 *
 * - **Al volver del fondo**, que es el caso comun. El telefono estuvo apagado
 *   toda la noche y con el ni los temporizadores: Android no los corre mientras
 *   el proceso duerme, asi que esperar solo la alarma no alcanza.
 * - **Con una alarma a la medianoche**, para la app que se queda abierta y a la
 *   vista mientras cambia el dia.
 *
 * La alarma se topa en una hora aunque falte mas. La medianoche se calcula con
 * el reloj del dispositivo y `today()` responde en la zona de Chile: si el
 * telefono esta en otra zona las dos no coinciden, y el tope hace que la
 * diferencia se corrija sola en menos de una hora en vez de durar todo un dia.
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
