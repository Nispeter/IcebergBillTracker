/**
 * Listado completo de movimientos, con filtros.
 *
 * Home muestra los ultimos ocho; esta es la vista para buscar. El filtro viaja a
 * SQL, no se aplica sobre todo lo cargado en memoria.
 */

import { categories, dates, money } from '@iceberg/core';
import type { FiltroDeMovimientos, Movimiento, TipoDeMovimiento } from '@iceberg/db';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, themes, type Theme, type ThemeName,
} from '@iceberg/ui';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { iconoDeCategoria } from '../components/iconos';
import { useMovimientosFiltrados } from '../datos/consultas';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export default function Movimientos() {
  const sistema = useColorScheme();
  const [tema, setTema] = useState<ThemeName>(sistema === 'dark' ? 'dark' : 'light');
  const theme = themes[tema];
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const router = useRouter();

  const [tipo, setTipo] = useState<TipoDeMovimiento | null>(null);
  const [categoriaId, setCategoriaId] = useState<categories.CategoryId | null>(null);

  const filtro = useMemo<FiltroDeMovimientos>(
    () => ({
      ...(tipo === null ? {} : { tipo }),
      ...(categoriaId === null ? {} : { categoriaId }),
    }),
    [tipo, categoriaId],
  );
  const movimientos = useMovimientosFiltrados(filtro);

  const total = useMemo(
    () => money.money(movimientos.reduce((s, m) => s + m.montoMinor, 0), 'CLP'),
    [movimientos],
  );

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.contenido}>

        <View style={styles.encabezado}>
          <Pressable
            onPress={() => router.back()}
            style={styles.volver}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <CaretLeft size={16} weight="bold" color={theme.silencio} />
            <Text style={styles.volverTexto}>Home</Text>
          </Pressable>
          <Pressable
            onPress={() => setTema(tema === 'dark' ? 'light' : 'dark')}
            accessibilityRole="button"
            accessibilityLabel={`Cambiar a tema ${tema === 'dark' ? 'claro' : 'oscuro'}`}
          >
            <Text style={styles.cambioTema}>{tema === 'dark' ? 'Deshielo' : 'Noche polar'}</Text>
          </Pressable>
        </View>

        <Text style={styles.titulo}>Movimientos</Text>
        <Text style={styles.resumen}>
          {movimientos.length} {movimientos.length === 1 ? 'movimiento' : 'movimientos'} · {money.format(total)}
        </Text>

        <View style={styles.filtros}>
          <Chip styles={styles} activo={tipo === null} onPress={() => setTipo(null)} texto="Todos" />
          <Chip styles={styles} activo={tipo === 'gasto'} onPress={() => setTipo('gasto')} texto="Gastos" />
          <Chip styles={styles} activo={tipo === 'ingreso'} onPress={() => setTipo('ingreso')} texto="Ingresos" />
        </View>

        <View style={styles.filtros}>
          <Chip
            styles={styles}
            activo={categoriaId === null}
            onPress={() => setCategoriaId(null)}
            texto="Toda categoría"
          />
          {categories.CATEGORIES.map((categoria) => (
            <Chip
              key={categoria.id}
              styles={styles}
              activo={categoriaId === categoria.id}
              onPress={() => setCategoriaId(categoriaId === categoria.id ? null : categoria.id)}
              texto={categoria.nombreCorto}
            />
          ))}
        </View>

        {movimientos.length === 0 ? (
          <Text style={styles.vacio}>Ningún movimiento con esos filtros.</Text>
        ) : (
          <View style={styles.lista}>
            {movimientos.map((tx: Movimiento) => {
              const fecha = tx.ocurridoEn as dates.PlainDate;
              const Icono = tx.categoriaId ? iconoDeCategoria(tx.categoriaId) : null;
              return (
                <Link key={tx.id} href={{ pathname: '/movimiento/[id]', params: { id: tx.id } }} asChild>
                  <Pressable
                    style={styles.fila}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${tx.nombre}`}
                  >
                    <View style={styles.marcaFecha}>
                      <Text style={styles.dia}>{dates.day(fecha)}</Text>
                      <Text style={styles.mes}>{MESES[dates.month(fecha) - 1]}</Text>
                    </View>
                    <View style={styles.textoMovimiento}>
                      <Text style={styles.nombre} numberOfLines={1}>{tx.nombre}</Text>
                      <View style={styles.meta}>
                        {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
                        <Text style={styles.categoria}>
                          {tx.categoriaId ? categories.categoryName(tx.categoriaId) : 'Ingreso'}
                        </Text>
                      </View>
                    </View>
                    <Text style={tx.tipo === 'ingreso' ? styles.montoIngreso : styles.montoGasto}>
                      {tx.tipo === 'ingreso' ? '+' : '−'}
                      {money.formatNumber(money.money(tx.montoMinor))}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

function Chip(
  { styles, activo, onPress, texto }:
  { styles: Estilos; activo: boolean; onPress: () => void; texto: string },
) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, activo && styles.chipActivo]}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
    >
      <Text style={activo ? styles.chipTextoActivo : styles.chipTexto}>{texto}</Text>
    </Pressable>
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

    filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    chip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    chipActivo: { backgroundColor: theme.tinta, borderColor: theme.tinta },
    chipTexto: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    chipTextoActivo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.fondo },

    vacio: {
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: fontSizes.sm,
      color: theme.silencio,
      marginTop: spacing.xxl,
      textAlign: 'center',
    },

    lista: { marginTop: spacing.lg },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    marcaFecha: { width: 30, alignItems: 'center' },
    dia: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.tinta },
    mes: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, textTransform: 'uppercase' },
    textoMovimiento: { flex: 1, gap: 2 },
    nombre: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.tinta },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    categoria: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    montoGasto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.md, color: theme.gasto },
    montoIngreso: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.ingresoTexto },
  });
}
