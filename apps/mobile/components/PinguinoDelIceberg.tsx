/**
 * Los pingüinos que reaccionan al reparto del gasto.
 *
 * **Salta sobre el hielo cuando hay mucho gasto variable** y **nada en el mar
 * cuando hay poco.** Es la única pieza de la pantalla que dice algo sin una
 * cifra: se ve de reojo, antes de leer nada, y esa es toda su función.
 *
 * Van chicos a propósito. Lo que la pantalla vino a decir es el saldo y el
 * reparto; los pingüinos acompañan, no compiten. Cuántos hay se elige en
 * Ajustes, de uno a seis.
 *
 * **Cada uno arranca con su retraso.** Con todos en fase se ven como una sola
 * figura repetida; desfasados se ven como varios animales.
 *
 * ## Dónde se para
 *
 * En los dos casos, sobre **la línea de agua**: es el único borde del dibujo
 * cuya altura se conoce sin medir nada, porque `alturaDeLineaDeAgua` ya la
 * calculó para trazarla.
 *
 * A lo ancho se guía por `bordeDelHieloEn`, que dice hasta dónde llega el hielo
 * **a esa altura**. El ancho total no serviría: con mucho gasto variable la
 * línea sube casi hasta la punta y ahí el hielo mide cuatro píxeles, así que un
 * pingüino colocado por porcentaje del dibujo queda flotando al lado del pico.
 *
 * ## Las animaciones van por transformación
 *
 * `translateX` y `translateY` son de las pocas cosas que el hilo nativo sabe
 * interpolar solo, así que estas dos corren con `useNativeDriver` y no le
 * cuestan un cuadro a JavaScript. Es lo contrario de animar una propiedad de
 * SVG, que obliga a pasar por JS en cada cuadro.
 */

import { type Theme } from '@iceberg/ui';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { Pinguino } from './Pinguino';

/** Desde qué proporción de gasto variable el pingüino se pone a saltar. */
const MUCHO_VARIABLE = 0.5;

const TAMANO = 18;
/** El alto real: el dibujo es más alto que ancho. Ver `Pinguino`. */
const ALTO = TAMANO * (72 / 64);

/** Cuánto sube en cada salto. */
const SALTO = 9;
/** Cuánto se mece nadando, a lo ancho y a lo alto. */
const VAIVEN = 7;
const CABECEO = 3;

export function PinguinosDelIceberg(
  { theme, variable, yLinea, bordeDelHielo, cuantos }: {
    theme: Theme;
    /** Proporción del gasto que es variable, de 0 a 1. */
    variable: number;
    /** Altura de la línea de agua, en píxeles desde el techo de la escena. */
    yLinea: number;
    /** Hasta dónde llega el hielo a esa altura, en píxeles desde el centro. */
    bordeDelHielo: number;
    /** Cuántos dibujar. Ver `usePinguinos`. */
    cuantos: number;
  },
) {
  const salta = variable > MUCHO_VARIABLE;

  return (
    <>
      {Array.from({ length: cuantos }, (_, indice) => (
        <Uno
          key={indice}
          theme={theme}
          salta={salta}
          yLinea={yLinea}
          x={donde(salta, indice, cuantos, bordeDelHielo)}
          retraso={indice * (salta ? 240 : 380)}
        />
      ))}
    </>
  );
}

/**
 * Dónde se para el pingüino `indice` de `cuantos`, en píxeles desde el centro.
 *
 * Saltando se reparten sobre el ancho del hielo **a la altura de la línea**, que
 * es el único tramo donde hay dónde pararse. Nadando salen al mar alternando
 * lados, para no amontonarse a la derecha.
 */
function donde(salta: boolean, indice: number, cuantos: number, borde: number): number {
  if (salta) {
    // Repartidos dentro del hielo, sin llegar al borde mismo.
    const util = Math.max(TAMANO, borde * 1.5);
    const paso = (util * 2) / (cuantos + 1);
    return -util + paso * (indice + 1) - TAMANO / 2;
  }
  const aLaDerecha = indice % 2 === 0;
  const escalon = Math.floor(indice / 2);
  const lejos = borde + TAMANO * (1 + escalon * 1.5);
  return aLaDerecha ? lejos : -lejos - TAMANO;
}

function Uno(
  { theme, salta, yLinea, x, retraso }: {
    theme: Theme;
    salta: boolean;
    yLinea: number;
    x: number;
    retraso: number;
  },
) {
  const paso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    paso.setValue(0);
    const ciclo = Animated.loop(
      salta
        ? Animated.sequence([
          Animated.timing(paso, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(paso, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          // La pausa es lo que lo hace un salto y no un temblor.
          Animated.delay(1100),
        ])
        : Animated.sequence([
          Animated.timing(paso, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(paso, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
    );
    // El retraso va aca y no dentro del ciclo: adentro se repetiria en cada
    // vuelta y los pinguinos volverian a juntarse.
    const arranque = setTimeout(() => ciclo.start(), retraso);
    return () => { clearTimeout(arranque); ciclo.stop(); };
  }, [salta, paso, retraso]);

  const movimiento = salta
    ? [{ translateY: paso.interpolate({ inputRange: [0, 1], outputRange: [0, -SALTO] }) }]
    : [
      { translateX: paso.interpolate({ inputRange: [0, 1], outputRange: [-VAIVEN, VAIVEN] }) },
      { translateY: paso.interpolate({ inputRange: [0, 1], outputRange: [0, CABECEO] }) },
    ];

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      style={[
        styles.enLaEscena,
        {
          // Saltando se para sobre el hielo; nadando, medio hundido en el agua.
          top: salta ? yLinea - ALTO : yLinea - ALTO * 0.62,
          marginLeft: x,
          transform: movimiento,
        },
      ]}
    >
      <Pinguino theme={theme} tamano={TAMANO} estado="contento" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Anclado al centro de la escena, que es donde el iceberg esta centrado; el
  // `marginLeft` de arriba lo corre hasta su lugar.
  enLaEscena: { position: 'absolute', left: '50%' },
});
