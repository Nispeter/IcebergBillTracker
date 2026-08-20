/**
 * Aparecer y desaparecer sin cortes.
 *
 * Un panel que sale de golpe se lee como un cambio de pantalla; uno que se
 * desvanece subiendo unos píxeles se lee como algo que estaba ahí y se mostró.
 * La diferencia es de doscientos milisegundos y cambia por completo la sensación
 * de la app.
 *
 * **Se queda montado mientras se va.** Si se desmontara al cerrar, la animación
 * de salida no se vería nunca: el elemento ya no existiría cuando toca dibujarla.
 * Es lo mismo que hace el menú lateral.
 *
 * Sale más rápido de lo que entra —160 contra 200— porque al cerrar uno ya
 * decidió, y esperar la animación completa se siente lento.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

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

  useEffect(() => {
    if (visible) setMontado(true);
    Animated.timing(progreso, {
      toValue: visible ? 1 : 0,
      duration: visible ? 200 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMontado(false);
    });
  }, [visible, progreso]);

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
