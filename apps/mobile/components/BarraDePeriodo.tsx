/**
 * La barra de periodo: flechas para moverse y el nombre al medio.
 *
 * Va en **todas** las vistas. Es deliberadamente chica —una linea— porque no es
 * el contenido, es el marco: lo que importa es lo que hay debajo.
 *
 * El tipo se elige tocando el nombre, en una lista corta que se abre y se
 * cierra. No hay fila de pestañas permanente: el tipo se elige una vez y
 * despues uno navega de periodo en periodo con las flechas, que es lo que se
 * hace casi siempre.
 */

import { dates } from '@iceberg/core';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TIPOS, nombreDePeriodo, usePeriodo, type TipoDePeriodo } from '../datos/periodo';
import { ConDesplegable } from './ConDesplegable';

export function BarraDePeriodo(
  { theme, permitirFuturo }: {
    theme: Theme;
    /**
     * Deja avanzar mas alla del ultimo periodo con datos.
     *
     * Por defecto la flecha se apaga ahi, para no pasear por meses vacios. Pero
     * Tempanos habla justamente de lo que **todavia no paso**: sin esto, crear
     * una cuenta que vence el mes que viene la volvia invisible.
     */
    permitirFuturo?: boolean;
  },
) {
  const styles = crearEstilos(theme);
  const periodo = usePeriodo();
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState<string>(periodo.rango.start);
  const [hasta, setHasta] = useState<string>(periodo.rango.end);

  const desdeOk = dates.parsePlainDate(desde);
  const hastaOk = dates.parsePlainDate(hasta);
  const rangoValido = desdeOk !== null && hastaOk !== null && desdeOk <= hastaOk;

  const frenado = periodo.esElUltimo && permitirFuturo !== true;

  const elegir = (tipo: TipoDePeriodo) => {
    if (tipo === 'custom') {
      setDesde(periodo.rango.start);
      setHasta(periodo.rango.end);
      periodo.cambiarTipo('custom');
      return;
    }
    periodo.cambiarTipo(tipo);
    setAbierto(false);
  };

  const barra = (
    <View style={styles.barra}>
        <Pressable
          onPress={periodo.anterior}
          style={styles.flecha}
          accessibilityRole="button"
          accessibilityLabel="Período anterior"
          hitSlop={10}
        >
          <CaretLeft size={13} weight="bold" color={theme.tinta} />
        </Pressable>

        <Pressable
          onPress={() => setAbierto(!abierto)}
          style={styles.centro}
          accessibilityRole="button"
          accessibilityLabel={`${nombreDePeriodo(periodo.tipo, periodo.rango)}. Tocar para cambiar el período`}
          accessibilityState={{ expanded: abierto }}
        >
          <Text style={styles.nombre} numberOfLines={1}>
            {nombreDePeriodo(periodo.tipo, periodo.rango)}
          </Text>
          <CaretDown size={10} weight="bold" color={theme.silencio} />
        </Pressable>

        <Pressable
          onPress={periodo.siguiente}
          style={styles.flecha}
          disabled={frenado}
          accessibilityRole="button"
          accessibilityLabel="Período siguiente"
          hitSlop={10}
        >
          <CaretRight size={13} weight="bold" color={frenado ? theme.hairline : theme.tinta} />
      </Pressable>
    </View>
  );

  return (
    <ConDesplegable
      abierto={abierto}
      disparador={barra}
      panel={(
        <View style={styles.panel}>
          {TIPOS.map((t, indice) => {
            const activo = t.valor === periodo.tipo;
            return (
              <Pressable
                key={t.valor}
                onPress={() => elegir(t.valor)}
                style={[styles.opcion, indice > 0 && styles.opcionConLinea]}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
              >
                <Text style={activo ? styles.opcionTextoActivo : styles.opcionTexto}>{t.etiqueta}</Text>
                {activo ? <Check size={12} weight="bold" color={theme.acentoTexto} /> : null}
              </Pressable>
            );
          })}

          {periodo.tipo === 'custom' ? (
            <View style={styles.libre}>
              <View style={styles.campos}>
                <TextInput
                  value={desde}
                  onChangeText={setDesde}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={theme.silencio}
                  style={[styles.entrada, desdeOk === null && styles.entradaMala]}
                  autoCapitalize="none"
                  accessibilityLabel="Desde"
                />
                <Text style={styles.guion}>—</Text>
                <TextInput
                  value={hasta}
                  onChangeText={setHasta}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={theme.silencio}
                  style={[styles.entrada, hastaOk === null && styles.entradaMala]}
                  autoCapitalize="none"
                  accessibilityLabel="Hasta"
                />
              </View>
              <Pressable
                onPress={() => {
                  if (!rangoValido) return;
                  periodo.fijarRango(desdeOk, hastaOk);
                  setAbierto(false);
                }}
                disabled={!rangoValido}
                style={[styles.aplicar, !rangoValido && styles.aplicarApagado]}
                accessibilityRole="button"
                accessibilityLabel="Aplicar rango"
              >
                <Text style={styles.aplicarTexto}>
                  {rangoValido
                    ? `Aplicar · ${dates.daysBetween(desdeOk, hastaOk) + 1} días`
                    : 'Fechas inválidas'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!periodo.esElUltimo ? (
            <Pressable
              onPress={() => { periodo.alDia(); setAbierto(false); }}
              style={[styles.opcion, styles.opcionConLinea]}
              accessibilityRole="button"
            >
              <Text style={styles.opcionTexto}>Volver a hoy</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    />
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    // Todo el grupo va centrado en vez de estirarse: las flechas quedan al lado
    // del nombre, no en los extremos de la fila. El `hitSlop` de cada una
    // recupera el area tocable que el circulo daba antes.
    barra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    flecha: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
    centro: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    nombre: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },

    panel: {
      marginTop: spacing.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      borderRadius: radii.sm,
      backgroundColor: theme.superficie,
    },
    opcion: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    opcionConLinea: { borderTopWidth: elevation.hairlineWidth, borderTopColor: theme.hairline },
    opcionTexto: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    opcionTextoActivo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },

    libre: {
      padding: spacing.md,
      gap: spacing.sm,
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
    },
    campos: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    entrada: {
      flex: 1,
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: fontSizes.xs,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: 4,
    },
    entradaMala: { borderBottomColor: theme.vencidoTexto },
    guion: { fontFamily: fonts.mono, fontSize: fontSizes.xs, color: theme.silencio },
    aplicar: {
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: radii.sm,
      backgroundColor: theme.acento,
    },
    aplicarApagado: { opacity: 0.4 },
    aplicarTexto: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.sobreAcento },
  });
}
