/**
 * Cómo se mueven las transiciones de la interfaz.
 *
 * Las duraciones son tokens (`durations`); acá van las curvas y el respeto por
 * "quitar animaciones": con esa opción del sistema activa todo dura cero, y el
 * cambio ocurre igual pero sin recorrido.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/** Lo que llega frena; lo que se va acelera. */
export const CURVA = {
  entra: Easing.out(Easing.cubic),
  sale: Easing.in(Easing.cubic),
} as const;

/** Si la persona pidió al sistema que la interfaz no se mueva. */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(false);
  useEffect(() => {
    let vigente = true;
    AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (vigente) setReducido(valor);
    });
    const suscripcion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducido);
    return () => {
      vigente = false;
      suscripcion.remove();
    };
  }, []);
  return reducido;
}

/** Lleva `valor` hasta `hacia`. Con movimiento reducido, de golpe. */
export function transicion(
  valor: Animated.Value,
  hacia: number,
  { duracion, curva = CURVA.entra, reducido = false, nativo = true }: {
    duracion: number;
    curva?: (t: number) => number;
    reducido?: boolean;
    /** El color no se anima en el hilo nativo; la posición y la opacidad sí. */
    nativo?: boolean;
  },
): Animated.CompositeAnimation {
  return Animated.timing(valor, {
    toValue: hacia,
    duration: reducido ? 0 : duracion,
    easing: curva,
    useNativeDriver: nativo,
  });
}
