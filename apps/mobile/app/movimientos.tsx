/**
 * Listado completo de movimientos, con filtros.
 *
 * Home muestra los ultimos ocho; esta es la vista para buscar. El filtro viaja a
 * SQL, no se aplica sobre todo lo cargado en memoria.
 */


import { categories, money } from '@iceberg/core';
import type { FiltroDeMovimientos, Movimiento, TipoDeMovimiento } from '@iceberg/db';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FilaMovimiento } from '../components/FilaMovimiento';
import { SelectorDesplegable } from '../components/SelectorDesplegable';
import { iconoDeCategoria } from '../components/iconos';
import { useMovimientosFiltrados } from '../datos/consultas';
import { volver } from '../datos/navegacion';
import { useTema } from '../datos/tema';

export default function Movimientos() {
  const { nombre: tema, theme, alternar } = useTema();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const router = useRouter();

  const [tipo, setTipo] = useState<TipoDeMovimiento | null>(null);
  const [categoriaId, setCategoriaId] = useState<categories.CategoryId | null>(null);
  const [abierto, setAbierto] = useState<'tipo' | 'categoria' | null>(null);

  const filtro = useMemo<FiltroDeMovimientos>(
    () => ({
      ...(tipo === null ? {} : { tipo }),
      ...(categoriaId === null ? {} : { categoriaId }),
    }),
    [tipo, categoriaId],
  );
  const movimientos = useMovimientosFiltrados(filtro);

  const opcionesDeTipo = useMemo(() => [
    { valor: null, etiqueta: 'Todos' },
    { valor: 'gasto' as const, etiqueta: 'Gastos' },
    { valor: 'ingreso' as const, etiqueta: 'Ingresos' },
  ], []);

  const opcionesDeCategoria = useMemo(() => [
    { valor: null, etiqueta: 'Todas' },
    ...categories.CATEGORIES.map((categoria) => ({
      valor: categoria.id,
      etiqueta: categoria.nombreCorto,
      icono: iconoDeCategoria(categoria.id),
    })),
  ], []);

  // Los montos se guardan **sin signo**; el signo lo da el tipo. Sumarlos a
  // secas daba un numero sin sentido: $500.000 de ingreso mas $300.000 de gasto
  // mostraban $800.000.
  const total = useMemo(
    () => money.money(
      movimientos.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.montoMinor : -m.montoMinor), 0),
      'CLP',
    ),
    [movimientos],
  );

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.contenido}>

        <View style={styles.encabezado}>
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
          {movimientos.length} {movimientos.length === 1 ? 'movimiento' : 'movimientos'} · {money.formatSigned(total)}
        </Text>

        {/* Antes eran quince chips siempre a la vista: empujaban la lista
            fuera de la primera pantalla para mostrar un filtro que la mayoria
            de las veces esta en "todos". */}
        <View style={styles.filtros}>
          <SelectorDesplegable
            theme={theme}
            resumen={tipo === null ? 'Todos los movimientos' : tipo === 'gasto' ? 'Solo gastos' : 'Solo ingresos'}
            vacio={tipo === null}
            abierto={abierto === 'tipo'}
            onAlternar={() => setAbierto(abierto === 'tipo' ? null : 'tipo')}
            opciones={opcionesDeTipo}
            seleccionado={tipo}
            onElegir={(valor) => { setTipo(valor); setAbierto(null); }}
            accesible="Filtrar por tipo"
          />
          <SelectorDesplegable
            theme={theme}
            resumen={categoriaId === null ? 'Todas las categorías' : categories.categoryName(categoriaId)}
            icono={categoriaId === null ? null : iconoDeCategoria(categoriaId)}
            vacio={categoriaId === null}
            abierto={abierto === 'categoria'}
            onAlternar={() => setAbierto(abierto === 'categoria' ? null : 'categoria')}
            opciones={opcionesDeCategoria}
            seleccionado={categoriaId}
            onElegir={(valor) => { setCategoriaId(valor); setAbierto(null); }}
            accesible="Filtrar por categoría"
          />
        </View>

        {movimientos.length === 0 ? (
          <Text style={styles.vacio}>Ningún movimiento con esos filtros.</Text>
        ) : (
          <View style={styles.lista}>
            {movimientos.map((tx: Movimiento) => (
              <FilaMovimiento key={tx.id} tx={tx} theme={theme} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

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

    encabezado: {
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
      marginBottom: spacing.xl,
    },

    filtros: { marginBottom: spacing.md },

    vacio: {
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: fontSizes.sm,
      color: theme.silencio,
      marginTop: spacing.xxl,
      textAlign: 'center',
    },

    lista: { marginTop: spacing.lg },
  });
}
