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
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FilaMovimiento } from '../components/FilaMovimiento';
import { ChipDisparador, ListaDeOpciones } from '../components/SelectorDesplegable';
import { iconoDeCategoria } from '../components/iconos';
import { useMovimientosFiltrados, useResumenDeFiltro } from '../datos/consultas';
import { volver } from '../datos/navegacion';
import { useTema } from '../datos/tema';

/** Cuantos se traen de la base por tanda. */
const POR_PAGINA = 40;

type Desplegable = 'tipo' | 'categoria' | null;

export default function Movimientos() {
  const { nombre: tema, theme, alternar } = useTema();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const router = useRouter();

  const [tipo, setTipo] = useState<TipoDeMovimiento | null>(null);
  const [categoriaId, setCategoriaId] = useState<categories.CategoryId | null>(null);
  const [abierto, setAbierto] = useState<Desplegable>(null);
  const [pagina, setPagina] = useState(1);

  const filtro = useMemo<FiltroDeMovimientos>(
    () => ({
      ...(tipo === null ? {} : { tipo }),
      ...(categoriaId === null ? {} : { categoriaId }),
    }),
    [tipo, categoriaId],
  );

  const movimientos = useMovimientosFiltrados({ ...filtro, limite: pagina * POR_PAGINA });
  const resumen = useResumenDeFiltro(filtro);
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
    <View>
      <View style={styles.barra}>
        <Pressable
          onPress={() => volver(router)}
          style={styles.volver}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <CaretLeft size={16} weight="bold" color={theme.silencio} />
          <Text style={styles.volverTexto}>Home</Text>
        </Pressable>
        <Pressable
          onPress={alternar}
          accessibilityRole="button"
          accessibilityLabel={`Cambiar a tema ${tema === 'dark' ? 'claro' : 'oscuro'}`}
        >
          <Text style={styles.cambioTema}>{tema === 'dark' ? 'Deshielo' : 'Noche polar'}</Text>
        </Pressable>
      </View>

      <Text style={styles.titulo}>Movimientos</Text>
      <Text style={styles.resumen}>
        {resumen.cantidad} {resumen.cantidad === 1 ? 'movimiento' : 'movimientos'}
        {' · '}{money.formatSigned(resumen.neto)}
      </Text>

      {/* Los dos disparadores en una linea, y un solo panel debajo a lo ancho. */}
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

      {abierto === 'tipo' ? (
        <ListaDeOpciones
          theme={theme}
          opciones={opcionesDeTipo}
          seleccionado={tipo}
          onElegir={(valor) => cambiarFiltro(() => setTipo(valor))}
        />
      ) : null}
      {abierto === 'categoria' ? (
        <ListaDeOpciones
          theme={theme}
          opciones={opcionesDeCategoria}
          seleccionado={categoriaId}
          onElegir={(valor) => cambiarFiltro(() => setCategoriaId(valor))}
        />
      ) : null}

      <View style={styles.espacio} />
    </View>
  );

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <FlatList
        data={movimientos}
        keyExtractor={(tx) => tx.id}
        renderItem={({ item }: { item: Movimiento }) => (
          <FilaMovimiento tx={item} theme={theme} />
        )}
        ListHeaderComponent={encabezado}
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
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: theme.fondo },
    contenido: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
    },

    barra: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xl,
    },
    volver: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    volverTexto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.silencio },
    cambioTema: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },

    titulo: { fontFamily: fonts.ui, fontWeight: pesos.bold, fontSize: fontSizes.xl, color: theme.tinta },
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
