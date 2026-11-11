/**
 * "¿De dónde sale este número?", dentro de la hoja.
 *
 * Una cifra que no se puede abrir hay que creerla. Acá se abre: cómo se calcula
 * en una frase y después la aritmética o los movimientos que la componen,
 * cortados en ocho: para ver todo está la pantalla de movimientos.
 */

import { money } from '@iceberg/core';
import type { Movimiento } from '@iceberg/db';
import { elevation, spacing } from '@iceberg/ui';
import { StyleSheet, Text, View } from 'react-native';
import { useEstilos, type Estilo } from '../datos/estilos';

/** Un paso de la cuenta: "Ingreso +$1.488.700". */
interface Renglon {
  readonly etiqueta: string;
  readonly monto: money.Money;
  /** Si resta en vez de sumar. Cambia el signo que se dibuja, no el monto. */
  readonly resta?: boolean;
}

export interface Detalle {
  readonly total: money.Money;
  /** Cómo se calcula, en una frase. */
  readonly formula: string;
  readonly renglones?: readonly Renglon[];
  readonly movimientos?: readonly Movimiento[];
}

const TOPE = 8;

export function DetalleDeCifra({ detalle }: { detalle: Detalle }) {
  const styles = useEstilos(crearEstilos);
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

function crearEstilos({ theme, t, letra }: Estilo) {
  return StyleSheet.create({
    raiz: { gap: 2 },
    total: { ...t.cifra, fontSize: letra.px(28), fontWeight: t.accion.fontWeight, letterSpacing: -0.5 },
    formula: { ...t.nota, lineHeight: letra.px(17), paddingBottom: spacing.sm },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 5,
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
    },
    etiqueta: { ...t.etiqueta, flex: 1, color: theme.tinta },
    monto: t.cifra,
    resto: { ...t.nota, paddingTop: spacing.sm },
  });
}
