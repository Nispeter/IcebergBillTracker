/**
 * Qué categoría explica el cambio del período: lo único de la app que responde
 * "por qué" en vez de "cuánto". Muestra el gasto y el cambio de las tres que más
 * movieron la aguja; las que quedaron igual no explican nada.
 */

import { analytics, money } from '@iceberg/core';
import { spacing } from '@iceberg/ui';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { iconoDeCategoria } from './iconos';
import { Panel } from './Panel';
import { Titulo } from './Titulo';
import { useCategorias } from '../datos/catalogo';
import { useEstilos, type Estilo } from '../datos/estilos';
import { useTema } from '../datos/tema';

/** Más filas dejan de informar y solo ocupan. */
const FILAS = 3;

/** Dos columnas de números solo se leen si están alineadas. */
const ANCHO_COLUMNA = 84;

/** Lo que ocupa el `>`. Las filas que no llevan a ningún lado reservan el hueco igual. */
const ANCHO_CARET = 12;

const ANCHO_ICONO = 13;

export function QueCambio(
  { deriva, referencia, onElegir }:
  {
    deriva: readonly analytics.DerivaDeCategoria[];
    /** Contra qué se compara, ya escrito: "julio 2026". */
    referencia: string;
    /** Si viene, cada fila lleva al listado filtrado por esa categoría. */
    onElegir?: (categoriaId: string) => void;
  },
) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  const categorias = useCategorias();

  // `deriva` ya viene ordenada por cuánto movió la aguja.
  const filas = deriva.filter((fila) => !money.isZero(fila.delta)).slice(0, FILAS);

  return (
    <View>
      <Titulo
        texto="Variación por categoría"
        ayuda={'Compara lo gastado en cada categoría contra el período anterior del '
          + 'mismo largo. En rojo lo que subió, en verde lo que bajó.\n\n'
          + 'Solo aparecen las categorías que cambiaron: las que quedaron igual no '
          + 'explican nada.\n\n'
          + 'La flecha lleva al listado filtrado por esa categoría. Una que bajó a cero '
          + 'no la lleva, porque el listado saldría vacío.'}
        derecha={<Text style={styles.referencia} numberOfLines={1}>vs. {referencia}</Text>}
      />

      {filas.length === 0 ? (
        <Text style={styles.vacio}>Sin cambios contra el período anterior.</Text>
      ) : (
        <Panel>
          <View style={styles.fila}>
            <View style={styles.icono} />
            <View style={styles.relleno} />
            <Text style={styles.cabecera}>gasto</Text>
            <Text style={styles.cabecera}>cambio</Text>
            <View style={styles.caret} />
          </View>

          {filas.map((fila) => {
            const esSinCategoria = fila.categoriaId === analytics.SIN_CATEGORIA;
            const Icono = esSinCategoria ? null : iconoDeCategoria(fila.categoriaId);
            const nombre = categorias.nombreCorto(esSinCategoria ? undefined : fila.categoriaId);
            // Los delta en cero ya se fueron: no negativo es subida, y en gasto
            // subir nunca conviene.
            const subio = !money.isNegative(fila.delta);
            // Una que bajó a cero no tiene listado que mostrar.
            const tieneADonde = onElegir !== undefined && !esSinCategoria && !money.isZero(fila.total);

            const contenido = (
              <>
                {Icono
                  ? <Icono size={ANCHO_ICONO} weight="regular" color={theme.silencio} />
                  : <View style={styles.icono} />}
                <Text style={styles.nombre} numberOfLines={1}>{nombre}</Text>
                <Text style={styles.gasto}>{money.format(fila.total)}</Text>
                <Text style={[styles.cambio, { color: subio ? theme.vencidoTexto : theme.ingresoTexto }]}>
                  {money.formatSigned(fila.delta)}
                </Text>
              </>
            );

            return tieneADonde ? (
              <Pressable
                key={fila.categoriaId}
                onPress={() => onElegir?.(fila.categoriaId)}
                style={({ pressed }) => [styles.fila, pressed && styles.apretada]}
                accessibilityRole="button"
                accessibilityLabel={`Ver movimientos de ${nombre}`}
              >
                {contenido}
                <CaretRight size={ANCHO_CARET} weight="bold" color={theme.silencio} />
              </Pressable>
            ) : (
              <View key={fila.categoriaId} style={styles.fila}>
                {contenido}
                <View style={styles.caret} />
              </View>
            );
          })}
        </Panel>
      )}
    </View>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  const columna = { ...t.cifra, width: ANCHO_COLUMNA, textAlign: 'right' } as const;
  return StyleSheet.create({
    referencia: t.nota,
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
    apretada: { opacity: 0.6 },
    relleno: { flex: 1 },
    // Sobre el panel hundido el gris de siempre no llega a AA en el tema claro.
    cabecera: { ...t.nota, width: ANCHO_COLUMNA, textAlign: 'right', color: theme.silencioHondo },
    caret: { width: ANCHO_CARET },
    icono: { width: ANCHO_ICONO },
    nombre: { ...t.etiqueta, flex: 1, color: theme.tinta },
    gasto: columna,
    cambio: { ...columna, fontWeight: t.accion.fontWeight },
    vacio: { ...t.etiqueta, paddingVertical: spacing.md },
  });
}
