/**
 * La linea de saldo del periodo, en SVG, con sus ejes.
 *
 * Cada punto es el saldo al cerrar ese dia, no un promedio: la linea baja
 * durante el mes y pega el salto el dia que entra el sueldo. Esa forma de
 * diente de sierra **es** el mes, y suavizarla lo esconderia.
 *
 * **Los ejes se agregaron despues y hacian falta.** Sin ellos la curva mostraba
 * la forma y no la escala: la misma silueta puede ser un mes que se movio entre
 * $700.000 y $760.000 o uno que se hundio a numeros rojos, y no habia como
 * distinguirlos. El eje vertical marca el techo, el piso y el cero cuando
 * corresponde, y el horizontal el primer y el ultimo dia.
 *
 * **Las cifras del eje van adentro, no en una canaleta.** La primera version les
 * reservaba 56px a la izquierda, y eso corria el dibujo entero hacia la derecha:
 * el grafico empezaba 56px mas adentro que el titulo de la seccion y que el pie
 * de "Mas bajo", asi que la pantalla se veia desalineada y la culpa parecia del
 * pie. Escritas dentro del margen de aire que el trazo ya dejaba arriba y abajo
 * no cuestan ancho, y la curva usa la pantalla completa.
 *
 * En `react-native-svg` y no en Victory Native XL, que depende de Skia, y Skia
 * en web necesita CanvasKit por WASM. Una linea son dos `path`; no vale la pena
 * pagar esa dependencia por eso.
 *
 * El ancho lo da `onLayout` en vez de estirar un `viewBox` fijo: estirar
 * deformaria el grosor del trazo en horizontal.
 *
 * ## Se puede tocar
 *
 * Una curva sola muestra la forma y esconde los dias: se ve que hubo una caida
 * pero no cuando ni de cuanto. Tocarla elige el dia mas cercano y lo dice con
 * numeros --que quedaba al cerrarlo y que se movio ese dia--, que es la pregunta
 * que la curva provoca y no contestaba.
 *
 * **Es un toque y no un arrastre.** Arrastrar obligaria a reclamar el gesto
 * desde que el dedo baja, y este grafico vive dentro de un `ScrollView`: un dedo
 * que empieza sobre la curva casi siempre viene a desplazar la pantalla. Un
 * `Pressable` cede solo si el dedo se mueve, asi que el desplazamiento sigue
 * funcionando encima del dibujo.
 */

import { dates, money } from '@iceberg/core';
import type { analytics } from '@iceberg/core';
import { charts, elevation, fonts, pesos, spacing, type Letra, type Theme } from '@iceberg/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as TextoSvg } from 'react-native-svg';
import { useLetra } from '../datos/letra';

/**
 * 180 y no 120.
 *
 * A 120 la curva de un mes entero se aplastaba en una franja mas baja que una
 * fila de la lista de movimientos: la forma de diente de sierra --que es todo
 * lo que la linea tiene que mostrar-- quedaba comprimida hasta ser un garabato.
 */
const ALTO = 180;
/**
 * Aire arriba y abajo. Sirve para dos cosas: que el trazo no toque los bordes ni
 * se corte el punto, y que las cifras del eje tengan donde escribirse sin
 * pisar la curva.
 */
const MARGEN = 18;

/** Como se escribe un monto en un eje: corto, porque compite con la curva. */
function abreviar(minor: number): string {
  const signo = minor < 0 ? '−' : '';
  const valor = Math.abs(minor);
  if (valor >= 1_000_000) return `${signo}${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `${signo}${Math.round(valor / 1_000)}k`;
  return `${signo}${valor}`;
}

/**
 * A que distancia del borde izquierdo del grafico cayo el toque.
 *
 * En Android viene en `locationX`, que es el campo de React Native y ya es
 * relativo al elemento. En web ese campo **no llega**: el evento que pasa
 * react-native-web es el del DOM, donde lo equivalente se llama `offsetX`. Sin
 * el respaldo la curva no responde en el navegador, que es donde se prueba.
 *
 * Devuelve `NaN` si no hay ninguno de los dos, y quien llama decide que hacer.
 */
function dondeSeToco(evento: { locationX?: number; offsetX?: number }): number {
  return evento.locationX ?? evento.offsetX ?? NaN;
}

export function LineaDeSaldo(
  { serie, theme }: { serie: readonly analytics.DiaConSaldo[]; theme: Theme },
) {
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);
  const [ancho, setAncho] = useState(0);
  /** Que dia se esta mirando, por indice. `null` es "ninguno". */
  const [elegido, setElegido] = useState<number | null>(null);

  if (serie.length < 2) {
    return <Text style={styles.vacio}>Se necesitan al menos dos días para dibujar la línea.</Text>;
  }

  const valores = serie.map((d) => d.saldo.amountMinor);
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  /**
   * Un periodo sin movimientos es una recta: el saldo no cambia en todo el mes.
   *
   * Hay que tratarlo aparte y no solo evitar la division por cero. Con el piso de
   * `|| 1`, la proporcion de todos los puntos daba 0 y la recta se dibujaba
   * **pegada al borde de abajo**, como si el saldo hubiera tocado fondo. Plana va
   * al medio, que es lo unico que se puede afirmar cuando no hay rango.
   */
  const plano = maximo === minimo;
  const alcance = maximo - minimo || 1;

  const x = (indice: number) => (indice / (serie.length - 1)) * Math.max(ancho, 1);
  const y = (valor: number) => {
    const parte = plano ? 0.5 : 1 - (valor - minimo) / alcance;
    return MARGEN + parte * (ALTO - MARGEN * 2);
  };

  const trazo = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const relleno = `${trazo} L${ancho},${ALTO} L0,${ALTO} Z`;

  const indiceMinimo = valores.indexOf(minimo);
  const fondo = serie[indiceMinimo]!;
  const cierre = serie[serie.length - 1]!;
  const cruzaCero = minimo < 0 && maximo >= 0;

  /**
   * Las marcas del eje vertical. El cero solo si la curva lo cruza.
   *
   * Sin de-duplicar, dos marcas pueden coincidir y React recibe dos hijos con la
   * misma `key`. Pasa en dos casos reales: un periodo sin ningun movimiento
   * --donde el saldo no se mueve, asi que techo y piso son el mismo numero-- y
   * uno que termina justo en cero, donde el techo **es** el cero.
   */
  const marcas = [...new Set(cruzaCero ? [maximo, 0, minimo] : [maximo, minimo])];

  /**
   * De donde se toco al dia mas cercano, o `null` si no se puede saber.
   *
   * Redondeando y no truncando: truncar le da al dia de la izquierda todo el
   * tramo hasta el siguiente, asi que tocar justo encima de un punto elegia el
   * anterior. El extremo derecho ademas se volvia inalcanzable.
   *
   * El `isFinite` no es paranoia: `locationX` puede no venir --paso con eventos
   * sinteticos en web-- y entonces la cuenta da `NaN`. `NaN` sobrevive a
   * `Math.min` y a `Math.max`, asi que se colaba hasta el indice y dejaba la
   * pantalla en blanco. Una curva no puede tumbar la pantalla por un toque raro.
   */
  const diaTocado = (x: number): number | null => {
    if (!Number.isFinite(x)) return null;
    const crudo = Math.round((x / Math.max(ancho, 1)) * (serie.length - 1));
    return Math.min(Math.max(crudo, 0), serie.length - 1);
  };

  // `?? null` y no `!`: al cambiar de periodo la serie se acorta y el indice
  // guardado puede quedar apuntando afuera.
  const dia = elegido === null ? null : serie[elegido] ?? null;

  return (
    <View>
      <Pressable
        style={styles.lienzo}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        onPress={(e) => {
          const cual = diaTocado(dondeSeToco(e.nativeEvent));
          if (cual === null) return;
          // Volver a tocar el mismo dia lo suelta: es la salida sin agregar
          // un boton de cerrar a un grafico de 180 px.
          setElegido((antes) => (antes === cual ? null : cual));
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Saldo día a día"
        accessibilityHint="Tocar un punto de la curva para ver el saldo de ese día"
      >
        {ancho > 0 ? (
          <Svg width={ancho} height={ALTO}>
            {/* Las guias horizontales van primero: son fondo, no dibujo. */}
            {marcas.map((valor) => (
              <Line
                key={valor}
                x1={0}
                y1={y(valor)}
                x2={ancho}
                y2={y(valor)}
                stroke={valor === 0 ? theme.vencido : theme.hairline}
                strokeWidth={1}
                strokeDasharray={valor === 0 ? '3 3' : undefined}
              />
            ))}
            {/* Cada cifra **encima** de su guia si es el techo o el cero, y
                **debajo** si es el piso: asi las tres caen en el aire de los
                margenes y ninguna queda escrita sobre el trazo. */}
            {marcas.map((valor) => (
              <TextoSvg
                key={`t${valor}`}
                x={0}
                y={valor === minimo ? y(valor) + 13 : y(valor) - 5}
                textAnchor="start"
                fontSize={letra.px(9)}
                fontFamily={fonts.mono}
                fill={valor === 0 ? theme.vencidoTexto : theme.silencio}
              >
                {abreviar(valor)}
              </TextoSvg>
            ))}

            <Path d={relleno} fill={charts[0]} fillOpacity={0.12} />
            <Path d={trazo} stroke={charts[0]} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {/* En `alerta` y no en `acento`: el acento paso a ser el agua, que es el
                mismo color de la curva, asi que el punto desaparecia encima de ella.
                El ambar quedo como la unica señal de "mira esto". */}
            <Circle cx={x(indiceMinimo)} cy={y(minimo)} r={3.5} fill={theme.alerta} />

            {/* El dia elegido va al final: es lo unico que tiene que quedar
                por encima de la curva y del punto ambar. */}
            {elegido === null || dia === null ? null : (
              <>
                <Line
                  x1={x(elegido)}
                  y1={0}
                  x2={x(elegido)}
                  y2={ALTO}
                  stroke={theme.silencio}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                {/* Dos circulos y no uno: el de abajo es del color del fondo y
                    hace de aro, para que el punto no se pierda encima del
                    trazo, que es del mismo color. */}
                <Circle cx={x(elegido)} cy={y(dia.saldo.amountMinor)} r={6} fill={theme.fondo} />
                <Circle cx={x(elegido)} cy={y(dia.saldo.amountMinor)} r={4} fill={charts[0]} />
              </>
            )}
          </Svg>
        ) : null}
      </Pressable>

      {/* El eje horizontal va en texto y no en SVG: son dos etiquetas, y asi
          heredan la fuente y el color del tema sin repetirlos. */}
      <View style={styles.ejeX}>
        <Text style={styles.fecha}>{dates.formatDate(serie[0]!.fecha)}</Text>
        <Text style={styles.fecha}>{dates.formatDate(cierre.fecha)}</Text>
      </View>

      {/*
        El dia elegido va arriba del pie y no en su lugar: "mas bajo" y "cierra"
        son del periodo entero y siguen siendo ciertos mientras uno recorre los
        dias. Reemplazarlos obligaba a soltar el dia para volver a verlos.
      */}
      {dia === null ? (
        <Text style={styles.pista}>Tocá la curva para ver un día.</Text>
      ) : (
        <View style={styles.elegido}>
          <View style={styles.filaElegido}>
            <Text style={styles.fechaElegida}>{dates.formatDateLong(dia.fecha)}</Text>
            <Text style={styles.saldoElegido}>{money.format(dia.saldo)}</Text>
          </View>
          <Text style={styles.movimientoElegido}>{queSeMovio(dia)}</Text>
        </View>
      )}

      <View style={styles.pie}>
        <Text style={styles.dato}>
          <Text style={styles.etiqueta}>Más bajo </Text>
          {money.format(fondo.saldo)} el {dates.day(fondo.fecha)}
        </Text>
        <Text style={styles.dato}>
          <Text style={styles.etiqueta}>Cierra </Text>
          {money.format(cierre.saldo)}
        </Text>
      </View>
    </View>
  );
}

/**
 * Que paso ese dia, en una linea.
 *
 * Un dia quieto se dice y no se deja en blanco: en una curva plana, "no se movió
 * nada" **es** la respuesta a por que no baja, y un espacio vacio se lee como
 * que falta un dato.
 */
function queSeMovio(dia: analytics.DiaConSaldo): string {
  const gasto = dia.gasto.amountMinor;
  const ingreso = dia.ingreso.amountMinor;
  if (gasto === 0 && ingreso === 0) return 'No se movió nada';
  const partes: string[] = [];
  if (ingreso > 0) partes.push(`entró ${money.format(dia.ingreso)}`);
  if (gasto > 0) partes.push(`salió ${money.format(dia.gasto)}`);
  return partes.join(' · ');
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    lienzo: { height: ALTO, width: '100%' },
    // Sin `marginLeft` y sin regla: el trazo ya llega a los dos bordes, asi que
    // las fechas se alinean solas con el y con el resto de la pantalla.
    ejeX: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.xs },
    fecha: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.px(9), color: theme.silencio },
    /**
     * La invitacion a tocar y el detalle ocupan el mismo lugar.
     *
     * No mide lo mismo cada uno, pero se turnan: sin reservar el sitio, elegir
     * un dia empujaba media pantalla hacia abajo y el grafico se movia bajo el
     * dedo justo al tocarlo.
     */
    pista: {
      minHeight: 34,
      paddingTop: spacing.sm,
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.px(10),
      color: theme.silencio,
    },
    elegido: { minHeight: 34, paddingTop: spacing.sm },
    filaElegido: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    fechaElegida: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.xs, color: theme.tinta },
    saldoElegido: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: letra.xs, color: theme.tinta },
    movimientoElegido: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.silencio },

    pie: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm },
    dato: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.tinta },
    etiqueta: { fontFamily: fonts.texto, color: theme.silencio },
    vacio: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.silencio, paddingVertical: spacing.md },
  });
}
