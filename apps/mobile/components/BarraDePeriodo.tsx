/**
 * La barra de periodo: flechas para moverse y el nombre al medio.
 *
 * Va en **todas** las vistas, arriba de todo. Antes eran pestañas de tipo de
 * rango, que servian para elegir "mes" pero no para ir al mes pasado — que es lo
 * que uno quiere hacer la mayoria de las veces.
 *
 * El tipo se cambia tocando el nombre, no con una fila de pestañas siempre a la
 * vista: se elige una vez y despues uno navega de periodo en periodo.
 */

import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TIPOS, nombreDePeriodo, usePeriodo } from '../datos/periodo';

export function BarraDePeriodo({ theme }: { theme: Theme }) {
  const styles = crearEstilos(theme);
  const periodo = usePeriodo();
  const [eligiendo, setEligiendo] = useState(false);

  return (
    <View>
      <View style={styles.barra}>
        <Pressable
          onPress={periodo.anterior}
          style={styles.flecha}
          accessibilityRole="button"
          accessibilityLabel="Período anterior"
          hitSlop={8}
        >
          <CaretLeft size={14} weight="bold" color={theme.tinta} />
        </Pressable>

        <Pressable
          onPress={() => setEligiendo(!eligiendo)}
          style={styles.centro}
          accessibilityRole="button"
          accessibilityLabel={`${nombreDePeriodo(periodo.tipo, periodo.rango)}. Tocar para cambiar el tipo de período`}
          accessibilityState={{ expanded: eligiendo }}
        >
          <Text style={styles.nombre} numberOfLines={1}>
            {nombreDePeriodo(periodo.tipo, periodo.rango)}
          </Text>
          <Text style={styles.tipo}>
            {TIPOS.find((t) => t.valor === periodo.tipo)?.etiqueta.toLowerCase()} ▾
          </Text>
        </Pressable>

        <Pressable
          onPress={periodo.siguiente}
          style={[styles.flecha, periodo.esElUltimo && styles.flechaApagada]}
          disabled={periodo.esElUltimo}
          accessibilityRole="button"
          accessibilityLabel="Período siguiente"
          hitSlop={8}
        >
          <CaretRight size={14} weight="bold" color={periodo.esElUltimo ? theme.hairline : theme.tinta} />
        </Pressable>
      </View>

      {eligiendo ? (
        <View style={styles.opciones}>
          {TIPOS.map((t) => {
            const activo = t.valor === periodo.tipo;
            return (
              <Pressable
                key={t.valor}
                onPress={() => { periodo.cambiarTipo(t.valor); setEligiendo(false); }}
                style={[styles.opcion, activo && styles.opcionActiva]}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
              >
                <Text style={activo ? styles.opcionTextoActivo : styles.opcionTexto}>{t.etiqueta}</Text>
              </Pressable>
            );
          })}
          {!periodo.esElUltimo ? (
            <Pressable
              onPress={() => { periodo.alDia(); setEligiendo(false); }}
              style={styles.opcion}
              accessibilityRole="button"
            >
              <Text style={styles.opcionTexto}>Hoy</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    barra: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    // Las flechas llevan borde: sin el no se leen como boton, se leen como
    // adorno al lado del titulo.
    flecha: {
      width: 28,
      height: 28,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    flechaApagada: { opacity: 0.4 },
    centro: { flex: 1, alignItems: 'center' },
    nombre: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.tinta },
    tipo: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.acentoTexto },

    opciones: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, justifyContent: 'center' },
    opcion: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    opcionActiva: { backgroundColor: theme.tinta, borderColor: theme.tinta },
    opcionTexto: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    opcionTextoActivo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.fondo },
  });
}
