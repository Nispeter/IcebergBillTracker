/**
 * Que categoria explica el cambio del periodo.
 *
 * Es la unica cifra de la pantalla que responde **por que** en vez de cuanto.
 * "Gasto $1.394.390, −5%" no dice que hacer con esa informacion; "comida subio
 * $80.000 y es el 70% de todo lo que se movio" si.
 *
 * El motor ya viene resuelto de `core/analytics`: aca solo se elige que mostrar
 * y se ordena en pantalla.
 */

import { analytics, categories, money } from '@iceberg/core';
import { elevation, fontSizes, fonts, pesos, spacing, type Theme } from '@iceberg/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { iconoDeCategoria } from './iconos';

/** Cuantas filas entran antes de que la lista deje de informar y solo ocupe. */
const FILAS = 3;

/** Una fila que si mueve la aguja: cambio distinto de cero y peso conocido. */
type ConPeso = analytics.DerivaDeCategoria & { readonly explicacion: number };

/** Anchos fijos: las columnas de numeros se leen si estan alineadas. */
const ANCHO_CAMBIO = 84;
const ANCHO_EXPLICA = 46;

export function QueCambio(
  { deriva, theme, onElegir }:
  {
    deriva: readonly analytics.DerivaDeCategoria[];
    theme: Theme;
    /** Si viene, cada fila lleva al listado filtrado por esa categoria. */
    onElegir?: (categoriaId: string) => void;
  },
) {
  const styles = crearEstilos(theme);

  // Una categoria que gasto lo mismo que el periodo pasado no explica nada:
  // ocuparia una fila para decir "0". `deriva` ya viene ordenada por |delta|,
  // asi que las que sobreviven son las tres que mas movieron la aguja.
  //
  // El filtro tambien deja fuera el unico caso en que `explicacion` es null
  // —que no se haya movido nada— asi que abajo el porcentaje siempre existe y
  // no hace falta una rama para pintar un guion que nunca se veria.
  const filas = deriva
    .filter((fila): fila is ConPeso => !money.isZero(fila.delta) && fila.explicacion !== null)
    .slice(0, FILAS);

  if (filas.length === 0) {
    return <Text style={styles.vacio}>Sin cambios contra el período anterior.</Text>;
  }

  return (
    <View>
      <View style={styles.cabecera}>
        {/* Dos huecos del ancho del icono y del nombre: sin ellos los titulos
            no caen sobre sus columnas. */}
        <View style={styles.sinIcono} />
        <View style={styles.relleno} />
        <Text style={styles.cabeceraCambio}>CAMBIO</Text>
        <Text style={styles.cabeceraExplica}>EXPLICA</Text>
      </View>

      {filas.map((fila) => {
        const esSinCategoria = fila.categoriaId === analytics.SIN_CATEGORIA;
        // Una categoria que bajo a cero no tiene a donde llevar: el listado
        // filtrado saldria vacio. Se muestra igual —bajar a cero es justamente
        // lo que explica el cambio— pero sin prometer un drill-down que no hay.
        const tieneADonde = onElegir !== undefined && !esSinCategoria && !money.isZero(fila.total);
        const Icono = esSinCategoria ? null : iconoDeCategoria(fila.categoriaId);
        const nombre = esSinCategoria
          ? categories.categoryShortName(undefined)
          : categories.categoryShortName(fila.categoriaId);
        // Los delta en cero ya quedaron fuera, asi que no negativo es subida.
        const subio = !money.isNegative(fila.delta);

        const contenido = (
          <>
            {Icono
              ? <Icono size={13} weight="regular" color={theme.silencio} />
              : <View style={styles.sinIcono} />}
            <Text style={styles.nombre} numberOfLines={1}>{nombre}</Text>
            {/* Mismo criterio que las tres cifras de arriba: el color sale de si
                conviene, no del signo. En gasto, subir nunca conviene. */}
            <Text style={[styles.delta, { color: subio ? theme.vencidoTexto : theme.ingresoTexto }]}>
              {/* El signo se arma aca y no con `formatSigned` porque ese usa el
                  guion ASCII: al lado de un `−` de la lista de abajo, en
                  monoespaciada, se ve como otro caracter. */}
              {subio ? '+' : '−'}{money.format(money.abs(fila.delta))}
            </Text>
            <Text style={styles.explica}>{Math.round(fila.explicacion * 100)}%</Text>
          </>
        );

        return tieneADonde ? (
          <Pressable
            key={fila.categoriaId}
            onPress={() => onElegir?.(fila.categoriaId)}
            style={styles.filaTocable}
            accessibilityRole="button"
            accessibilityLabel={`Ver movimientos de ${nombre}`}
          >
            {contenido}
          </Pressable>
        ) : (
          <View key={fila.categoriaId} style={styles.fila}>{contenido}</View>
        );
      })}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  const etiqueta = {
    fontFamily: fonts.ui,
    fontWeight: pesos.regular,
    fontSize: 10,
    color: theme.silencio,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'right',
  } as const;

  return StyleSheet.create({
    // Encabezados de columna en vez de una frase que los explique: dicen lo
    // mismo y no gastan una linea de prosa.
    cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: 2 },
    relleno: { flex: 1 },
    cabeceraCambio: { ...etiqueta, width: ANCHO_CAMBIO },
    cabeceraExplica: { ...etiqueta, width: ANCHO_EXPLICA },

    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
    // Subrayada porque lleva a algun lado, igual que la leyenda de la torta.
    filaTocable: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 5,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    sinIcono: { width: 13 },
    nombre: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    delta: { width: ANCHO_CAMBIO, textAlign: 'right', fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.xs },
    explica: { width: ANCHO_EXPLICA, textAlign: 'right', fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    vacio: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio, paddingVertical: spacing.md },
  });
}
