/**
 * El periodo como grilla de dias, con el gasto de cada uno.
 *
 * Es la vista que hace evidente algo que ninguna cifra dice: **el gasto no es
 * parejo**. El dia 5 se va el arriendo, el fin de semana se carga el delivery,
 * y hay semanas casi en blanco. Es lo que el modelo de proyeccion por perfil ya
 * sabia y que no se veia en ninguna parte.
 *
 * Cada celda muestra **el monto**, no solo la intensidad. El color dice "cuanto"
 * de un vistazo; el numero contesta "cuanto exactamente" sin tener que tocar.
 */

import { dates, money } from '@iceberg/core';
import type { analytics } from '@iceberg/core';
import {
  charts, elevation, fonts, pesos, radii, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLetra } from '../datos/letra';
import { Pinguino } from './Pinguino';

/** Lunes primero, como el resto de la app. */
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Opacidad minima de un dia con gasto, para que nunca desaparezca. */
const PISO = 0.22;

/**
 * Cuanto de la celda ocupa el pinguino que marca hoy.
 *
 * Va en proporcion y no en pixeles porque la celda es un septimo del ancho de
 * la pantalla: un tamano fijo que se ve bien en un telefono grande queda encima
 * del numero en uno chico.
 *
 * El tope lo pone el monto, que es el texto mas ancho de la celda: cuatro
 * caracteres centrados dejan libre poco menos de un tercio a cada lado. Con
 * 0,34 el pinguino ya lo tocaba en pantallas de 360 px de ancho.
 */
const PROPORCION_DE_HOY = 0.32;

/** Por si la medicion todavia no llego: es el tamano que tenia antes. */
const TAMANO_MINIMO_DE_HOY = 12;

/**
 * La intensidad de una celda, comprimida con raiz cuadrada.
 *
 * En escala lineal el mapa no funcionaba: el gasto de un mes tiene una cola
 * larguisima --el dia del arriendo son $490.000 y un dia cualquiera $17.000--
 * asi que dividir por el maximo dejaba a casi todos los dias en 0,25 y solo uno
 * encendido. Cuarenta celdas del mismo tono no son un mapa de calor, son un
 * fondo con una mancha.
 *
 * La raiz reparte el rango donde estan los datos en vez de donde esta el
 * maximo: ese mismo dia de $17.000 pasa de 0,25 a 0,37 y uno de $143.000 a
 * 0,64. Es la correccion de siempre para intensidad sobre datos sesgados.
 */
function intensidadDe(gastado: number, mayor: number): number {
  if (mayor === 0 || gastado === 0) return 0;
  return PISO + Math.sqrt(gastado / mayor) * (1 - PISO);
}

/** Abrevia a miles: en una celda de 45px no entra "150.000". */
function abreviar(minor: number): string {
  if (minor === 0) return '';
  if (minor < 1_000) return String(minor);
  const miles = minor / 1_000;
  return miles >= 100 ? `${Math.round(miles)}k` : `${miles.toFixed(miles < 10 ? 1 : 0)}k`;
}

export function Calendario(
  { serie, theme, hoy, onElegirDia }:
  {
    serie: readonly analytics.DiaDeLaSerie[];
    theme: Theme;
    hoy: dates.PlainDate;
    onElegirDia?: (fecha: dates.PlainDate) => void;
  },
) {
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);
  // El ancho de la celda no se sabe hasta que la grilla se mide: es un
  // porcentaje. Lo unico que depende de el es el pinguino de hoy.
  const [anchoDeCelda, setAnchoDeCelda] = useState(0);
  if (serie.length === 0) return null;

  const tamanoDeHoy = Math.max(TAMANO_MINIMO_DE_HOY, anchoDeCelda * PROPORCION_DE_HOY);

  const mayor = serie.reduce((max, dia) => Math.max(max, dia.gasto.amountMinor), 0);
  // El periodo no empieza en lunes: se rellena para que cada columna sea
  // siempre el mismo dia de la semana.
  const relleno = dates.weekday(serie[0]!.fecha) - 1;

  return (
    <View>
      <View style={styles.cabecera}>
        {DIAS.map((inicial, indice) => (
          <Text key={indice} style={styles.diaSemana}>{inicial}</Text>
        ))}
      </View>

      <View
        style={styles.grilla}
        onLayout={(e) => setAnchoDeCelda(e.nativeEvent.layout.width / DIAS.length)}
      >
        {/*
          Detrás de la rejilla y muy apagado: es una marca de agua, no un
          dibujo. `pointerEvents="none"` porque cubre las celdas y si no se
          comería los toques de los días.

          Contento y no dormido: acá siempre hay algo que mirar --el calendario
          se dibuja solo cuando hay serie-- así que el dormido, que es el de las
          pantallas vacías, decía lo contrario de lo que se está viendo.
        */}
        <View style={styles.marcaDeAgua} pointerEvents="none">
          <Pinguino theme={theme} tamano={150} estado="contento" />
        </View>

        {Array.from({ length: relleno }, (_, i) => <View key={`v${i}`} style={styles.celda} />)}

        {serie.map((dia) => {
          const gastado = dia.gasto.amountMinor;
          const intensidad = intensidadDe(gastado, mayor);
          const esHoy = dia.fecha === hoy;
          const fuerte = intensidad > 0.55;

          return (
            <Pressable
              key={dia.fecha}
              style={styles.celda}
              onPress={onElegirDia ? () => onElegirDia(dia.fecha) : undefined}
              disabled={!onElegirDia || gastado === 0}
              accessibilityRole={onElegirDia && gastado > 0 ? 'button' : undefined}
              accessibilityLabel={`${esHoy ? 'Hoy, ' : ''}${dates.formatDate(dia.fecha)}: ${money.format(dia.gasto)}`}
            >
              {gastado === 0 ? null : (
                <View style={[styles.marca, { backgroundColor: charts[0], opacity: intensidad }]} />
              )}
              {esHoy ? (
                <>
                  <View style={styles.contornoDeHoy} pointerEvents="none" />
                  <View style={styles.hoy} pointerEvents="none">
                    <Pinguino theme={theme} tamano={tamanoDeHoy} />
                  </View>
                </>
              ) : null}
              <View style={styles.textos}>
                <Text style={[
                  styles.numero,
                  gastado === 0 && styles.numeroApagado,
                  fuerte && styles.sobreFuerte,
                ]}>
                  {dates.day(dia.fecha)}
                </Text>
                <Text style={[styles.monto, fuerte && styles.sobreFuerte]}>{abreviar(gastado)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    cabecera: { flexDirection: 'row', marginBottom: spacing.xs },
    diaSemana: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: letra.px(9),
      color: theme.silencio,
    },
    grilla: { flexDirection: 'row', flexWrap: 'wrap' },
    celda: { width: `${100 / 7}%`, aspectRatio: 0.95, padding: 2, alignItems: 'center', justifyContent: 'center' },
    /**
     * El pingüino de fondo.
     *
     * Al 6 % se ve solo cuando uno se detiene a mirar, que es lo que tiene que
     * hacer una marca de agua: no puede competir con los montos, que son lo que
     * la pantalla vino a decir.
     */
    marcaDeAgua: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.06,
    },
    marca: { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: radii.sm },
    /**
     * El contorno punteado de hoy.
     *
     * Va **encima** de la marca de color y con el mismo encuadre, para que sea
     * el borde de esa misma pastilla y no un segundo rectangulo desalineado.
     *
     * Punteado y no lleno: un borde continuo se lee como seleccion --como el dia
     * que uno acaba de tocar-- y hoy no esta seleccionado, esta señalado. En
     * `silencio` por lo mismo que el pinguino no usa cian: el color ya tiene dos
     * trabajos en la app y este no necesita uno nuevo.
     */
    contornoDeHoy: {
      position: 'absolute',
      top: 2,
      right: 2,
      bottom: 2,
      left: 2,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.silencio,
    },
    /**
     * Un dia sin gasto no dibuja nada, ni siquiera un contorno.
     *
     * La primera version le ponia una hairline alrededor. En un mes con diez
     * dias sin gastar eso son diez cajas vacias compitiendo con las que si
     * tienen algo, y un mapa de calor funciona justamente al reves: lo que no
     * pasa no se dibuja. Queda el numero, apagado, que ya dice que el dia existe.
     */
    numeroApagado: { color: theme.silencio },
    textos: { alignItems: 'center' },
    numero: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.tinta },
    /**
     * Hoy se marca con el pinguino, no con color.
     *
     * Antes era el numero en cian y en negrita. El cian de la app quiere decir
     * "variable" en el iceberg y "seleccionado" en los controles; gastarlo
     * tambien en "hoy" le agrega un tercer significado a un color que ya tenia
     * dos. El pinguino no le quita el puesto a nada y se encuentra igual de
     * rapido, porque en una grilla de numeros lo que salta es la figura.
     *
     * Va **al costado** del numero, no encima. Encima solo cabe un pinguino
     * diminuto: el numero y el monto son de tamano fijo y quedan centrados, asi
     * que sobre ellos hay una banda que en un telefono no llega a los 15 px.
     * A los lados sobra harto mas, porque el numero son dos digitos en el medio
     * de la celda. De ahi que se pueda hacer casi el doble de grande.
     *
     * Absoluto y no en el flujo: en el flujo empujaria el monto y desalinearia
     * la grilla solo en la columna de hoy.
     */
    hoy: { position: 'absolute', top: 2, left: 1 },
    monto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.px(8), color: theme.silencio },
    // Sobre una celda muy saturada, la tinta del tema claro no contrasta: se
    // usa el fondo, que es su opuesto por definicion.
    sobreFuerte: { color: theme.fondo },
  });
}
