/**
 * Aparecer y desaparecer sin cortes: un panel que se desvanece subiendo unos
 * píxeles se lee como algo que estaba ahí; uno que sale de golpe, como un
 * cambio de pantalla.
 *
 * Se queda montado mientras se va, o la animación de salida no se vería nunca.
 */

import { durations } from '@iceberg/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { CURVA, transicion, useMovimientoReducido } from '../datos/animacion';

export function Aparecer(
  { visible, children, estilo, desplazamiento = 6 }: {
    visible: boolean;
    children: ReactNode;
    estilo?: StyleProp<ViewStyle>;
    /** Cuántos píxeles sube al entrar. Cero para solo desvanecer. */
    desplazamiento?: number;
  },
) {
  const [montado, setMontado] = useState(visible);
  const progreso = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const reducido = useMovimientoReducido();

  useEffect(() => {
    if (visible) setMontado(true);
    transicion(progreso, visible ? 1 : 0, {
      duracion: visible ? durations.entrada : durations.salida,
      curva: visible ? CURVA.entra : CURVA.sale,
      reducido,
    }).start(({ finished }) => {
      if (finished && !visible) setMontado(false);
    });
  }, [visible, progreso, reducido]);

  if (!montado) return null;

  return (
    <Animated.View
      style={[
        estilo,
        {
          opacity: progreso,
          transform: [{
            translateY: progreso.interpolate({
              inputRange: [0, 1],
              outputRange: [-desplazamiento, 0],
            }),
          }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
