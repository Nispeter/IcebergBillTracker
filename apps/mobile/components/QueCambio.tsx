/**
 * Que categoria explica el cambio del periodo.
 *
 * Es lo unico de la app que responde **por que** en vez de cuanto: "gasto
 * $1.394.390, −5%" no dice que hacer; "comida $265.890, y son $63.610 menos que
 * en julio" si.
 *
 * Vive en Categorias y no en el Resumen: es la misma pregunta que la torta
 * —en que se me va— mirada en el tiempo en vez de en un momento. En el Resumen
 * era densidad que nadie pidio a primera vista.
 *
 * **Cada columna se explica sola.** La primera version mostraba el cambio y un
 * "explica 23%", que es la parte del movimiento total del periodo que aporta esa
 * categoria. Es la metrica mas fina que calcula el motor y no se entendia: 23%
 * de que. Mostrar el gasto **y** el cambio dice lo mismo sin pedir que nadie
 * aprenda una definicion, y el orden de las filas ya deja ver cual pesa mas.
 * `explicacion` sigue calculado en `core`, por si alguna vez tiene donde ir.
 */

import { analytics, money } from '@iceberg/core';
import { elevation, fontSizes, fonts, pesos, spacing, type Theme } from '@iceberg/ui';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Panel } from './Panel';
import { Titulo } from './Titulo';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { iconoDeCategoria } from './iconos';
import { useCategorias } from '../datos/catalogo';

/** Cuantas filas entran antes de que la lista deje de informar y solo ocupe. */
const FILAS = 3;

/** Anchos fijos: dos columnas de numeros solo se leen si estan alineadas. */
const ANCHO_COLUMNA = 84;

/** El ancho que ocupa el `>` de las filas que llevan a algun lado. */
const ANCHO_CARET = 12;

export function QueCambio(
  { deriva, referencia, theme, onElegir }:
  {
    deriva: readonly analytics.DerivaDeCategoria[];
    /** Contra que se compara, ya escrito: "julio 2026", "10 al 16 de agosto". */
    referencia: string;
    theme: Theme;
    /** Si viene, cada fila lleva al listado filtrado por esa categoria. */
    onElegir?: (categoriaId: string) => void;
  },
) {
  const styles = crearEstilos(theme);
  const categorias = useCategorias();

  // Una categoria que gasto lo mismo que el periodo pasado no explica nada:
  // ocuparia una fila para decir "0". `deriva` ya viene ordenada por cuanto
  // movio la aguja, asi que las que sobreviven son las tres que mas pesaron.
  const filas = deriva.filter((fila) => !money.isZero(fila.delta)).slice(0, FILAS);

  return (
    <View>
      {/* El "contra que" va en el titulo y no en un encabezado de columna:
          "vs. 10 al 16 de agosto" no entra en 84px, y sin el la seccion no se
          entiende en ningun alcance. */}
      <Titulo
        texto="Qué cambió"
        theme={theme}
        derecha={<Text style={styles.referencia} numberOfLines={1}>vs. {referencia}</Text>}
      />

      {filas.length === 0 ? (
        <Text style={styles.vacio}>Sin cambios contra el período anterior.</Text>
      ) : (
        <Panel theme={theme}>
          <View style={styles.cabecera}>
            <View style={styles.hueco} />
            <View style={styles.relleno} />
            <Text style={styles.cabeceraTexto}>gasto</Text>
            <Text style={styles.cabeceraTexto}>cambio</Text>
            <View style={styles.sinCaret} />
          </View>

          {filas.map((fila) => {
            const esSinCategoria = fila.categoriaId === analytics.SIN_CATEGORIA;
            const Icono = esSinCategoria ? null : iconoDeCategoria(fila.categoriaId);
            const nombre = categorias.nombreCorto(
              esSinCategoria ? undefined : fila.categoriaId,
            );
            // Los delta en cero ya quedaron fuera: no negativo es subida.
            const subio = !money.isNegative(fila.delta);
            // Una categoria que bajo a cero no tiene a donde llevar; el listado
            // filtrado saldria vacio. Se muestra igual —bajar a cero es
            // justamente lo que explica el cambio— pero sin prometer un
            // drill-down que no hay. La columna de gasto en $0 lo deja claro.
            const tieneADonde = onElegir !== undefined && !esSinCategoria && !money.isZero(fila.total);

            const contenido = (
              <>
                {Icono
                  ? <Icono size={13} weight="regular" color={theme.silencio} />
                  : <View style={styles.hueco} />}
                <Text style={styles.nombre} numberOfLines={1}>{nombre}</Text>
                <Text style={styles.gasto}>{money.format(fila.total)}</Text>
                {/* El color sale de si conviene, no del signo, igual que las
                    cifras del Resumen. En gasto, subir nunca conviene. */}
                <Text style={[styles.cambio, { color: subio ? theme.vencidoTexto : theme.ingresoTexto }]}>
                  {money.formatSigned(fila.delta)}
                </Text>
              </>
            );

            return tieneADonde ? (
              <Pressable
                key={fila.categoriaId}
                onPress={() => onElegir?.(fila.categoriaId)}
                style={styles.fila}
                accessibilityRole="button"
                accessibilityLabel={`Ver movimientos de ${nombre}`}
              >
                {contenido}
                <CaretRight size={ANCHO_CARET} weight="bold" color={theme.silencio} />
              </Pressable>
            ) : (
              <View key={fila.categoriaId} style={styles.fila}>
                {contenido}
                {/* Una categoria que bajo a cero no lleva a ningun lado, pero
                    reserva el hueco para que las columnas no se corran. */}
                <View style={styles.sinCaret} />
              </View>
            );
          })}
        </Panel>
      )}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  const columna = {
    width: ANCHO_COLUMNA,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: fontSizes.xs,
  } as const;

  return StyleSheet.create({
    referencia: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },

    cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: 2 },
    relleno: { flex: 1 },
    cabeceraTexto: {
      width: ANCHO_COLUMNA,
      textAlign: 'right',
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: 10,
      // Va sobre el fondo hundido del panel, donde el gris de siempre no llega
      // a AA en el tema claro.
      color: theme.silencioHondo,
    },

    // Sin subrayado: lo tocable lo dice el `>`, igual que en la leyenda de la
    // torta. Ver el comentario largo alla.
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
    sinCaret: { width: ANCHO_CARET },
    hueco: { width: 13 },
    nombre: { flex: 1, fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    gasto: { ...columna, fontWeight: pesos.regular, color: theme.tinta },
    cambio: { ...columna, fontWeight: pesos.medium },
    vacio: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio, paddingVertical: spacing.md },
  });
}
