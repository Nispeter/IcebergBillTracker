/**
 * Una fila de movimiento, compartida por Home y por el listado.
 *
 * Estaba duplicada en las dos pantallas y las dos tenian el mismo error: la
 * etiqueta de abajo se decidia mirando `categoriaId` en vez de `tipo`, asi que un
 * **gasto sin categoria** aparecia rotulado "Ingreso" al lado de un monto con
 * signo menos. Con un solo componente, esa decision vive en un solo lugar.
 */

import { categories, dates, money } from '@iceberg/core';
import type { Movimiento } from '@iceberg/db';
import {
  elevation, fontSizes, fonts, pesos, spacing, type Theme,
} from '@iceberg/ui';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { iconoDeCategoria } from './iconos';

/** Lo que dice el `?` de las pantallas que muestran el punto. */
export const EXPLICACION_ANOMALIA = 'El punto ámbar marca un gasto muy por encima de lo que '
  + 'sueles pagar en ese mismo lugar. Se compara contra todo tu historial, no contra este período.';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Lo que va bajo el nombre. Depende del **tipo**, no de si hay categoria. */
function subtitulo(tx: Movimiento): string {
  if (tx.tipo === 'ingreso') return 'Ingreso';
  if (tx.tipo === 'transferencia') return 'Transferencia';
  return tx.categoriaId === null ? 'Sin categoría' : categories.categoryName(tx.categoriaId);
}

/** Los ingresos suman, todo lo demas resta. */
function signo(tx: Movimiento): string {
  return tx.tipo === 'ingreso' ? '+' : '−';
}

export function FilaMovimiento(
  { tx, theme, anomala }: {
    tx: Movimiento;
    theme: Theme;
    /** Marca el gasto como muy por encima de lo normal para su categoria. */
    anomala?: boolean;
  },
) {
  const styles = crearEstilos(theme);
  const fecha = tx.ocurridoEn as dates.PlainDate;
  const Icono = tx.categoriaId ? iconoDeCategoria(tx.categoriaId) : null;

  return (
    <Link href={{ pathname: '/movimiento/[id]', params: { id: tx.id } }} asChild>
      <Pressable
        style={styles.fila}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${tx.nombre}`}
      >
        <View style={styles.marcaFecha}>
          <Text style={styles.dia}>{dates.day(fecha)}</Text>
          <Text style={styles.mes}>{MESES[dates.month(fecha) - 1]}</Text>
        </View>
        <View style={styles.texto}>
          <Text style={styles.nombre} numberOfLines={1}>{tx.nombre}</Text>
          <View style={styles.meta}>
            {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
            <Text style={styles.subtitulo}>{subtitulo(tx)}</Text>
          </View>
        </View>
        {/* Un punto ambar y nada mas. El ambar es el color de "esto pide
            atencion" y no hay lugar en una fila para explicar por que; la
            explicacion vive una sola vez, en el `?` del encabezado. */}
        {anomala ? <View style={styles.punto} /> : null}
        <Text style={tx.tipo === 'ingreso' ? styles.montoIngreso : styles.montoGasto}>
          {signo(tx)}{money.formatNumber(money.money(tx.montoMinor))}
        </Text>
      </Pressable>
    </Link>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
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
    mes: {
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: 10,
      color: theme.silencio,
      textTransform: 'uppercase',
    },
    texto: { flex: 1, gap: 2 },
    nombre: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.tinta },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    subtitulo: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.acento },
    montoGasto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.md, color: theme.gasto },
    // `ingresoTexto` es la aurora en su version legible: en claro se oscurece
    // hasta cumplir AA, en oscuro es la misma aurora viva.
    montoIngreso: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.ingresoTexto },
  });
}
