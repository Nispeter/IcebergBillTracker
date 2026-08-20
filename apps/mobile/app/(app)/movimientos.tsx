/**
 * Listado completo de movimientos, con filtros y paginado.
 *
 * Home muestra los ultimos ocho; esta es la vista para buscar.
 *
 * Tres decisiones que sostienen la pantalla:
 *
 * - **El filtro viaja a SQL**, no se aplica sobre todo lo cargado en memoria.
 * - **El encabezado sale de un agregado**, no de contar las filas visibles: con
 *   paginado tiene que decir cuantos hay en total, no cuantos se trajeron.
 * - **`FlatList` y no `ScrollView`**: con seiscientas filas, montarlas todas de
 *   una hace que la pantalla tarde en aparecer y que el scroll se sienta pesado.
 */

import { categories, money } from '@iceberg/core';
import type { FiltroDeMovimientos, Movimiento, TipoDeMovimiento } from '@iceberg/db';
import {
  capas, elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ayuda } from '../../components/Ayuda';
import { ConDesplegable } from '../../components/ConDesplegable';
import { EXPLICACION_ANOMALIA, FilaMovimiento } from '../../components/FilaMovimiento';
import { Pantalla } from '../../components/Pantalla';
import { ChipDisparador, ListaDeOpciones } from '../../components/SelectorDesplegable';
import { iconoDeCategoria } from '../../components/iconos';
import { useAnomalias, useMovimientosFiltrados, useResumenDeFiltro } from '../../datos/consultas';
import { usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

/** Cuantos se traen de la base por tanda. */
const POR_PAGINA = 40;

type Desplegable = 'tipo' | 'categoria' | null;

export default function Movimientos() {
  const { theme } = useTema();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const { rango } = usePeriodo();
  // Se puede llegar aca desde una categoria de la torta o desde un dia del
  // calendario. El parametro precarga el filtro.
  const params = useLocalSearchParams<{ categoria?: string; dia?: string }>();

  const [tipo, setTipo] = useState<TipoDeMovimiento | null>(null);
  const [categoriaId, setCategoriaId] = useState<categories.CategoryId | null>(
    (params.categoria as categories.CategoryId | undefined) ?? null,
  );
  const [abierto, setAbierto] = useState<Desplegable>(null);
  const [pagina, setPagina] = useState(1);

  const filtro = useMemo<FiltroDeMovimientos>(
    () => ({
      // El listado vive dentro del periodo global, como el resto de las vistas.
      desde: params.dia ? (params.dia as never) : rango.start,
      hasta: params.dia ? (params.dia as never) : rango.end,
      ...(tipo === null ? {} : { tipo }),
      ...(categoriaId === null ? {} : { categoriaId }),
    }),
    [tipo, categoriaId, rango.start, rango.end, params.dia],
  );

  const movimientos = useMovimientosFiltrados({ ...filtro, limite: pagina * POR_PAGINA });
  const resumen = useResumenDeFiltro(filtro);
  const anomalias = useAnomalias();
  const hayMas = movimientos.length < resumen.cantidad;

  /** Cambiar de filtro vuelve a la primera pagina: si no, se veria un tramo suelto. */
  const cambiarFiltro = useCallback((accion: () => void) => {
    accion();
    setPagina(1);
    setAbierto(null);
  }, []);

  const opcionesDeTipo = useMemo(() => [
    { valor: null, etiqueta: 'Todos los movimientos' },
    { valor: 'gasto' as const, etiqueta: 'Solo gastos' },
    { valor: 'ingreso' as const, etiqueta: 'Solo ingresos' },
  ], []);

  const opcionesDeCategoria = useMemo(() => [
    { valor: null, etiqueta: 'Todas las categorías' },
    ...categories.CATEGORIES.map((categoria) => ({
      valor: categoria.id,
      etiqueta: categoria.nombre,
      icono: iconoDeCategoria(categoria.id),
    })),
  ], []);

  const encabezado = (
    // Elevado para que el panel del filtro tape las filas de abajo. El `zIndex`
    // del panel solo compite dentro de este subarbol; sin esto, cada fila de la
    // lista —que viene despues en el orden del documento— le pasa por encima.
    <View style={styles.encabezado}>
      <View style={styles.cabecera}>
        <Text style={styles.resumen}>
          {resumen.cantidad} {resumen.cantidad === 1 ? 'movimiento' : 'movimientos'}
          {' · '}{money.formatSigned(resumen.neto)}
        </Text>
        <Ayuda theme={theme} texto={EXPLICACION_ANOMALIA} />
      </View>

      {/* Los dos disparadores en una linea, y un solo panel **encima** a lo
          ancho: abrir un filtro no puede empujar la lista de movimientos. */}
      <ConDesplegable
        abierto={abierto !== null}
        disparador={(
          <View style={styles.filtros}>
            <ChipDisparador
              theme={theme}
              etiqueta={tipo === null ? 'Todos' : tipo === 'gasto' ? 'Gastos' : 'Ingresos'}
              abierto={abierto === 'tipo'}
              activo={tipo !== null}
              onPress={() => setAbierto(abierto === 'tipo' ? null : 'tipo')}
              accesible="Filtrar por tipo"
            />
            <ChipDisparador
              theme={theme}
              etiqueta={categoriaId === null ? 'Categoría' : categories.categoryShortName(categoriaId)}
              icono={categoriaId === null ? null : iconoDeCategoria(categoriaId)}
              abierto={abierto === 'categoria'}
              activo={categoriaId !== null}
              onPress={() => setAbierto(abierto === 'categoria' ? null : 'categoria')}
              accesible="Filtrar por categoría"
            />
          </View>
        )}
        panel={abierto === 'tipo' ? (
          <ListaDeOpciones
            theme={theme}
            opciones={opcionesDeTipo}
            seleccionado={tipo}
            onElegir={(valor) => cambiarFiltro(() => setTipo(valor))}
          />
        ) : (
          <ListaDeOpciones
            theme={theme}
            opciones={opcionesDeCategoria}
            seleccionado={categoriaId}
            onElegir={(valor) => cambiarFiltro(() => setCategoriaId(valor))}
          />
        )}
      />

      <View style={styles.espacio} />
    </View>
  );

  return (
    <Pantalla>
      {/* Los filtros van **fuera** de la lista, no en su `ListHeaderComponent`.
          Ahi adentro no podian abrirse por encima: el envoltorio que FlatList
          le pone al encabezado lleva `zIndex: 0`, que crea un contexto de
          apilado y encierra todo lo de adentro por debajo de las filas. De
          paso quedan fijos, que para un filtro es mejor: no se van con el
          scroll justo cuando uno quiere cambiarlo. */}
      <View style={styles.fijo}>{encabezado}</View>
      <FlatList
        data={movimientos}
        keyExtractor={(tx) => tx.id}
        renderItem={({ item }: { item: Movimiento }) => (
          <FilaMovimiento tx={item} theme={theme} anomala={anomalias.has(item.id)} />
        )}
        ListEmptyComponent={<Text style={styles.vacio}>Ningún movimiento con esos filtros.</Text>}
        ListFooterComponent={
          hayMas ? (
            <Pressable
              onPress={() => setPagina(pagina + 1)}
              style={styles.verMas}
              accessibilityRole="button"
              accessibilityLabel="Ver más movimientos"
            >
              <Text style={styles.verMasTexto}>
                Ver más · {movimientos.length} de {resumen.cantidad}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.pie}>
              {resumen.cantidad === 0 ? '' : `${resumen.cantidad} en total`}
            </Text>
          )
        }
        // Al llegar al final se trae la tanda siguiente sola; el boton queda
        // para quien prefiera pedirla.
        onEndReached={() => { if (hayMas) setPagina((actual) => actual + 1); }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
      />
    </Pantalla>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },


    encabezado: { zIndex: capas.desplegable },
    fijo: {
      paddingHorizontal: spacing.lg,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      zIndex: capas.desplegable,
    },
    cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 },
    resumen: {
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: fontSizes.sm,
      color: theme.silencio,
      marginBottom: spacing.lg,
    },

    filtros: { flexDirection: 'row', gap: spacing.sm },
    espacio: { height: spacing.lg },

    vacio: {
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: fontSizes.sm,
      color: theme.silencio,
      marginTop: spacing.xxl,
      textAlign: 'center',
    },

    verMas: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      borderRadius: radii.sm,
    },
    verMasTexto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.acentoTexto },
    pie: {
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: fontSizes.xs,
      color: theme.silencio,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
  });
}
