/**
 * El período como grilla de días, con el gasto de cada uno: la vista que hace
 * evidente que el gasto no es parejo. El tono dice cuánto de un vistazo y el
 * monto escrito, cuánto exactamente.
 */

import { dates, money } from '@iceberg/core';
import type { analytics } from '@iceberg/core';
import { charts, radii, spacing } from '@iceberg/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pinguino } from './Pinguino';
import { useEstilos, type Estilo } from '../datos/estilos';

/** Lunes primero, como el resto de la app. */
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Opacidad mínima de un día con gasto, para que nunca desaparezca. */
const PISO = 0.22;

/**
 * El pingüino de hoy, en proporción de la celda: un séptimo de la pantalla no
 * mide lo mismo en todos los teléfonos. Con más, tocaba el monto a 360 px.
 */
const PROPORCION_DE_HOY = 0.32;
const TAMANO_MINIMO_DE_HOY = 12;

/** Desde acá la celda es lo bastante intensa como para escribir encima en tinta profunda. */
const FUERTE = 0.55;

/**
 * La intensidad, comprimida con raíz cuadrada. El gasto tiene una cola larga
 * (el arriendo contra un día cualquiera), y en escala lineal casi todo el mes
 * quedaba en el mismo tono con una sola celda encendida.
 */
function intensidadDe(gastado: number, mayor: number): number {
  if (mayor === 0 || gastado === 0) return 0;
  return PISO + Math.sqrt(gastado / mayor) * (1 - PISO);
}

/** A miles: en una celda de 45 px no entra "150.000". */
function abreviar(minor: number): string {
  if (minor === 0) return '';
  if (minor < 1_000) return String(minor);
  const miles = minor / 1_000;
  return miles >= 100 ? `${Math.round(miles)}k` : `${miles.toFixed(miles < 10 ? 1 : 0)}k`;
}

export function Calendario(
  { serie, hoy, onElegirDia }:
  {
    serie: readonly analytics.DiaDeLaSerie[];
    hoy: dates.PlainDate;
    onElegirDia?: (fecha: dates.PlainDate) => void;
  },
) {
  const styles = useEstilos(crearEstilos);
  // El ancho de la celda es un porcentaje: se sabe al medir la grilla.
  const [anchoDeCelda, setAnchoDeCelda] = useState(0);
  if (serie.length === 0) return null;

  const tamanoDeHoy = Math.max(TAMANO_MINIMO_DE_HOY, anchoDeCelda * PROPORCION_DE_HOY);
  const mayor = serie.reduce((max, dia) => Math.max(max, dia.gasto.amountMinor), 0);
  // El período no siempre empieza en lunes: se rellena para que cada columna
  // sea siempre el mismo día de la semana.
  const relleno = dates.weekday(serie[0]!.fecha) - 1;

  return (
    <View>
      <View style={styles.cabecera}>
        {DIAS.map((inicial, indice) => (
          // eslint-disable-next-line react/no-array-index-key
          <Text key={indice} style={styles.diaSemana}>{inicial}</Text>
        ))}
      </View>

      <View
        style={styles.grilla}
        onLayout={(e) => setAnchoDeCelda(e.nativeEvent.layout.width / DIAS.length)}
      >
        {/* Una marca de agua, detrás y apagada; sin `pointerEvents` se comería
            los toques de los días. */}
        <View style={styles.marcaDeAgua} pointerEvents="none">
          <Pinguino tamano={150} estado="contento" />
        </View>

        {Array.from({ length: relleno }, (_, i) => <View key={`v${i}`} style={styles.celda} />)}

        {serie.map((dia) => {
          const gastado = dia.gasto.amountMinor;
          const intensidad = intensidadDe(gastado, mayor);
          const esHoy = dia.fecha === hoy;
          const fuerte = intensidad > FUERTE;

          return (
            <Pressable
              key={dia.fecha}
              style={styles.celda}
              onPress={onElegirDia ? () => onElegirDia(dia.fecha) : undefined}
              disabled={!onElegirDia || gastado === 0}
              accessibilityRole={onElegirDia && gastado > 0 ? 'button' : undefined}
              accessibilityLabel={`${esHoy ? 'Hoy, ' : ''}${dates.formatDateLong(dia.fecha)}: ${money.format(dia.gasto)}`}
            >
              {/* Un día sin gasto no dibuja ni contorno: en un mapa de calor lo
                  que no pasa no se dibuja. Queda el número, apagado. */}
              {gastado === 0 ? null : (
                <View style={[styles.marca, { backgroundColor: charts[0], opacity: intensidad }]} />
              )}
              {esHoy ? (
                <>
                  <View style={styles.contornoDeHoy} pointerEvents="none" />
                  <View style={styles.hoy} pointerEvents="none">
                    <Pinguino tamano={tamanoDeHoy} />
                  </View>
                </>
              ) : null}
              <View style={styles.textos}>
                <Text style={[styles.numero, gastado === 0 && styles.apagado, fuerte && styles.sobreElAgua]}>
                  {dates.day(dia.fecha)}
                </Text>
                <Text style={[styles.monto, fuerte && styles.sobreElAgua]}>{abreviar(gastado)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function crearEstilos({ theme, t, letra }: Estilo) {
  const encuadre = { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: radii.sm } as const;
  return StyleSheet.create({
    cabecera: { flexDirection: 'row', marginBottom: spacing.xs },
    diaSemana: { ...t.nota, width: `${100 / 7}%`, textAlign: 'center', fontWeight: t.accion.fontWeight },
    grilla: { flexDirection: 'row', flexWrap: 'wrap' },
    celda: { width: `${100 / 7}%`, aspectRatio: 0.95, padding: 2, alignItems: 'center', justifyContent: 'center' },
    // Al 6 %: se ve solo si uno se detiene a mirar, y no compite con los montos.
    marcaDeAgua: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', opacity: 0.06 },
    marca: encuadre,
    // Hoy se señala con el pingüino y un contorno punteado, no con color: el
    // cian ya dice "variable" y "seleccionado". Punteado porque hoy no está
    // seleccionado, está señalado.
    contornoDeHoy: { ...encuadre, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.silencio },
    // Al costado del número, donde sobra lugar, y absoluto para no desalinear la grilla.
    hoy: { position: 'absolute', top: 2, left: 1 },
    textos: { alignItems: 'center' },
    numero: { ...t.cifraDeGrafico, color: theme.tinta },
    apagado: { color: theme.silencio },
    monto: { ...t.cifraDeGrafico, fontSize: letra.px(8) },
    // La tinta que se lee encima del agua en los dos temas.
    sobreElAgua: { color: theme.sobreElHielo },
  });
}
