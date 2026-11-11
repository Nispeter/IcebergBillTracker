/**
 * Una fila de movimiento, compartida por el Resumen y el listado. Se toca para
 * editarlo.
 *
 * Sin líneas entre filas: el bloque de fecha y los dos renglones ya agrupan, y
 * el aire entre filas es el triple que el que hay entre renglones.
 */

import { dates, money } from '@iceberg/core';
import type { Movimiento } from '@iceberg/db';
import { spacing } from '@iceberg/ui';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { iconoDeCategoria } from './iconos';
import { MarcaDeFecha } from './MarcaDeFecha';
import { useCategorias } from '../datos/catalogo';
import { useEstilos, type Estilo } from '../datos/estilos';
import { useTema } from '../datos/tema';

/** Lo que dice la `i` de las pantallas que muestran el punto. */
export const EXPLICACION_ANOMALIA = 'El punto ámbar marca un gasto muy por encima de lo que '
  + 'sueles pagar en ese mismo lugar. Se compara contra todo tu historial, no contra este período.';

/**
 * Lo que va bajo el nombre. Depende del tipo y no de si hay categoría: un gasto
 * sin categoría no es un ingreso.
 */
function subtitulo(tx: Movimiento, nombreDeCategoria: (id: string | null) => string): string {
  if (tx.tipo === 'ingreso') return 'Ingreso';
  if (tx.tipo === 'transferencia') return 'Transferencia';
  return nombreDeCategoria(tx.categoriaId);
}

export function FilaMovimiento(
  { tx, anomala }: {
    tx: Movimiento;
    /** Un gasto muy por encima de lo normal para ese comercio. */
    anomala?: boolean;
  },
) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  const categorias = useCategorias();
  // Dentro de `Link asChild` el estilo tiene que ser un objeto plano: la
  // respuesta al toque se lleva con estado.
  const [apretada, setApretada] = useState(false);
  const Icono = tx.categoriaId ? iconoDeCategoria(tx.categoriaId) : null;
  const esIngreso = tx.tipo === 'ingreso';

  return (
    <Link href={{ pathname: '/movimiento/[id]', params: { id: tx.id } }} asChild>
      <Pressable
        style={StyleSheet.flatten([styles.fila, apretada && styles.apretada])}
        onPressIn={() => setApretada(true)}
        onPressOut={() => setApretada(false)}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${tx.nombre}`}
      >
        <MarcaDeFecha fecha={tx.ocurridoEn as dates.PlainDate} />
        <View style={styles.texto}>
          <Text style={styles.nombre} numberOfLines={1}>{tx.nombre}</Text>
          <View style={styles.meta}>
            {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
            <Text style={styles.subtitulo}>{subtitulo(tx, categorias.nombre)}</Text>
          </View>
        </View>
        {/* La explicación del punto vive una vez, en la `i` del encabezado. */}
        {anomala ? <View style={styles.punto} /> : null}
        <Text style={esIngreso ? styles.montoIngreso : styles.montoGasto}>
          {esIngreso ? '+' : '−'}{money.formatNumber(money.money(tx.montoMinor))}
        </Text>
      </Pressable>
    </Link>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.md,
    },
    apretada: { opacity: 0.55 },
    texto: { flex: 1, gap: 2 },
    nombre: t.nombre,
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    subtitulo: t.etiqueta,
    // `alerta` y no el acento: el acento es el agua y se confunde con el resto.
    punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.alerta },
    montoGasto: { ...t.cifraGrande, color: theme.gasto },
    montoIngreso: { ...t.cifraGrande, fontWeight: t.accion.fontWeight, color: theme.ingresoTexto },
  });
}
