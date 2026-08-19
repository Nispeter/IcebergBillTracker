/**
 * "¿De dónde sale este número?" — lo que va dentro de la hoja.
 *
 * Cada cifra del Resumen es el final de una cuenta, y una cuenta que no se puede
 * abrir hay que creerla. Aca se abre: una frase que dice como se calcula y
 * despues, o los renglones de la aritmetica, o los movimientos que la componen.
 *
 * La lista se corta en ocho. Mas que eso no cabe sin scroll y deja de ser una
 * respuesta rapida: para ver todo esta la pantalla de movimientos.
 */

import { money } from '@iceberg/core';
import type { Movimiento } from '@iceberg/db';
import { elevation, fontSizes, fonts, pesos, spacing, type Theme } from '@iceberg/ui';
import { StyleSheet, Text, View } from 'react-native';

/** Un paso de la cuenta: "Ingreso +$1.488.700". */
export interface Renglon {
  readonly etiqueta: string;
  readonly monto: money.Money;
  /** Si resta en vez de sumar. Cambia el signo que se dibuja, no el monto. */
  readonly resta?: boolean;
}

export interface Detalle {
  readonly total: money.Money;
  /** Como se calcula, en una frase. */
  readonly formula: string;
  readonly renglones?: readonly Renglon[];
  readonly movimientos?: readonly Movimiento[];
}

const TOPE = 8;

export function DetalleDeCifra({ detalle, theme }: { detalle: Detalle; theme: Theme }) {
  const styles = crearEstilos(theme);
  const movimientos = detalle.movimientos ?? [];
  const visibles = movimientos.slice(0, TOPE);
  const resto = movimientos.length - visibles.length;

  return (
    <View style={styles.raiz}>
      <Text style={styles.total}>{money.format(detalle.total)}</Text>
      <Text style={styles.formula}>{detalle.formula}</Text>

      {detalle.renglones?.map((renglon) => (
        <View key={renglon.etiqueta} style={styles.fila}>
          <Text style={styles.etiqueta}>{renglon.etiqueta}</Text>
          <Text style={styles.monto}>
            {renglon.resta ? '−' : '+'}{money.format(money.abs(renglon.monto))}
          </Text>
        </View>
      ))}

      {visibles.map((movimiento) => (
        <View key={movimiento.id} style={styles.fila}>
          <Text style={styles.etiqueta} numberOfLines={1}>{movimiento.nombre}</Text>
          <Text style={styles.monto}>{money.format(money.money(movimiento.montoMinor))}</Text>
        </View>
      ))}

      {resto > 0 ? (
        <Text style={styles.resto}>y {resto} {resto === 1 ? 'movimiento más' : 'movimientos más'}</Text>
      ) : null}

      {detalle.renglones === undefined && movimientos.length === 0 ? (
        <Text style={styles.resto}>Sin movimientos en este período.</Text>
      ) : null}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    raiz: { gap: 2 },
    total: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: 28, color: theme.tinta, letterSpacing: -0.5 },
    formula: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, lineHeight: 17, color: theme.silencio, paddingBottom: spacing.sm },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 5,
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
    },
    etiqueta: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    monto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    resto: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, paddingTop: spacing.sm },
  });
}
