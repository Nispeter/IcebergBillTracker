/**
 * Los pingüinos que reaccionan al reparto del gasto: saltan sobre el hielo
 * cuando hay mucho gasto variable y nadan en el mar cuando hay poco. Dicen algo
 * sin una cifra, de reojo, y por eso van chicos: acompañan, no compiten.
 *
 * Se paran sobre la línea de agua, la única altura que se conoce sin medir, y a
 * lo ancho se guían por `bordeDelHieloEn`: con la línea cerca de la punta el
 * hielo mide cuatro píxeles. Cada uno arranca con su retraso, o se verían como
 * una sola figura repetida.
 *
 * Las animaciones son transformaciones con el driver nativo, y con "quitar
 * animaciones" activado se quedan quietos.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { Pinguino } from './Pinguino';
import { useMovimientoReducido } from '../datos/animacion';

/** Desde qué proporción de gasto variable se ponen a saltar. */
const MUCHO_VARIABLE = 0.5;

const TAMANO = 18;
/** El dibujo es más alto que ancho. */
const ALTO = TAMANO * (72 / 64);

const SALTO = 9;
/** Cuánto se mece nadando, a lo ancho y a lo alto. */
const VAIVEN = 7;
const CABECEO = 3;

export function PinguinosDelIceberg(
  { variable, yLinea, bordeDelHielo, cuantos }: {
    /** Proporción del gasto que es variable, de 0 a 1. */
    variable: number;
    /** Altura de la línea de agua, en píxeles desde el techo de la escena. */
    yLinea: number;
    /** Hasta dónde llega el hielo a esa altura, en píxeles desde el centro. */
    bordeDelHielo: number;
    cuantos: number;
  },
) {
  const salta = variable > MUCHO_VARIABLE;
  return (
    <>
      {Array.from({ length: cuantos }, (_, indice) => (
        <Uno
          // eslint-disable-next-line react/no-array-index-key
          key={indice}
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
 * Dónde se para el pingüino `indice`, en píxeles desde el centro. Saltando se
 * reparten sobre el hielo (con un mínimo para no montarse unos sobre otros en
 * la punta); nadando salen al mar alternando lados.
 */
function donde(salta: boolean, indice: number, cuantos: number, borde: number): number {
  if (salta) {
    const minimo = (TAMANO * 0.8 * (cuantos + 1)) / 2;
    const util = Math.max(minimo, borde * 1.5);
    const paso = (util * 2) / (cuantos + 1);
    return -util + paso * (indice + 1) - TAMANO / 2;
  }
  const aLaDerecha = indice % 2 === 0;
  const escalon = Math.floor(indice / 2);
  const lejos = borde + TAMANO * (1 + escalon * 1.5);
  return aLaDerecha ? lejos : -lejos - TAMANO;
}

/**
 * A qué altura se dibuja. Nunca por encima del techo de la escena, donde
 * empieza el título; saltando el piso es `SALTO`, porque el brinco sube desde ahí.
 */
function alto(salta: boolean, yLinea: number): number {
  return salta ? Math.max(SALTO, yLinea - ALTO) : Math.max(0, yLinea - ALTO * 0.62);
}

function Uno(
  { salta, yLinea, x, retraso }: { salta: boolean; yLinea: number; x: number; retraso: number },
) {
  const quieto = useMovimientoReducido();
  const paso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    paso.setValue(0);
    if (quieto) return undefined;
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
    // El retraso afuera del ciclo: adentro se repetiría en cada vuelta y volverían a juntarse.
    const arranque = setTimeout(() => ciclo.start(), retraso);
    return () => { clearTimeout(arranque); ciclo.stop(); };
  }, [salta, paso, retraso, quieto]);

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
      style={[styles.enLaEscena, { top: alto(salta, yLinea), marginLeft: x, transform: movimiento }]}
    >
      <Pinguino tamano={TAMANO} estado="contento" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Anclado al centro de la escena, donde está el iceberg; `marginLeft` lo corre.
  enLaEscena: { position: 'absolute', left: '50%' },
});
