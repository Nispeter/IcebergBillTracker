/**
 * Resumen: como voy en este periodo.
 *
 * El saldo, el iceberg y las tres cifras del periodo. Nada mas: lo demas tiene
 * su propia pestaña.
 */

import { money } from '@iceberg/core';
import { charts, elevation, fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FilaMovimiento } from '../../components/FilaMovimiento';
import { Iceberg } from '../../components/Iceberg';
import { Pantalla } from '../../components/Pantalla';
import { useAnalisisDeRango, useMovimientos, useSaldo, useSaldoInicial } from '../../datos/consultas';
import { usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

export default function Resumen() {
  const { theme } = useTema();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const { rango, corte } = usePeriodo();

  const saldo = useSaldo(useSaldoInicial());
  const a = useAnalisisDeRango(rango, corte);
  const recientes = useMovimientos(4);

  const variable = money.subtract(a.resumen.gasto, a.fijo);
  const share = money.ratio(a.fijo, a.resumen.gasto) ?? 0;

  return (
    <Pantalla>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.hero}>
          <View style={styles.heroFila}>
            <Text style={styles.heroSimbolo}>$</Text>
            <Text style={styles.heroCifra}>{money.formatNumber(saldo)}</Text>
          </View>
          <Text style={styles.heroPie}>Saldo disponible</Text>
        </View>

        <View style={styles.trio}>
          <Celda styles={styles} theme={theme} etiqueta="Ingreso" valor={money.format(a.resumen.ingreso)}
            variacion={a.comparacion.ingreso.variacion} mejorSiSube />
          <Celda styles={styles} theme={theme} etiqueta="Gasto" valor={money.format(a.resumen.gasto)}
            variacion={a.comparacion.gasto.variacion} />
          <Celda styles={styles} theme={theme} etiqueta="Neto" valor={money.formatSigned(a.resumen.neto)} />
        </View>

        <View style={styles.bloqueIceberg}>
          <Iceberg shareComprometido={share} theme={theme} agua={charts[0]} profundidad={charts[1]} alto={160} />
          <View style={styles.leyendas}>
            <Leyenda styles={styles} color={theme.gasto} titulo="Comprometido" monto={money.format(a.fijo)} />
            <Leyenda styles={styles} color={charts[0]} titulo="Variable" monto={money.format(variable)} />
          </View>
        </View>

        <View style={styles.regla}>
          <Text style={styles.reglaTitulo}>Últimos movimientos</Text>
          <View style={styles.reglaLinea} />
        </View>
        {recientes.map((tx) => <FilaMovimiento key={tx.id} tx={tx} theme={theme} />)}

        <Link href="/movimientos" asChild>
          <Pressable style={styles.boton} accessibilityRole="button">
            <Text style={styles.botonTexto}>Ver todos los movimientos</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </Pantalla>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

function Celda(
  { styles, theme, etiqueta, valor, variacion, mejorSiSube }:
  { styles: Estilos; theme: Theme; etiqueta: string; valor: string; variacion?: number | null; mejorSiSube?: boolean },
) {
  return (
    <View style={styles.celda}>
      <Text style={styles.celdaEtiqueta}>{etiqueta}</Text>
      <Text style={styles.celdaValor} numberOfLines={1}>{valor}</Text>
      <Delta styles={styles} theme={theme} variacion={variacion ?? null} mejorSiSube={mejorSiSube} />
    </View>
  );
}

/**
 * El color no sale del signo sino de si **conviene**: que el gasto suba es malo
 * y que el ingreso suba es bueno, aunque los dos sean "+".
 */
function Delta(
  { styles, theme, variacion, mejorSiSube }:
  { styles: Estilos; theme: Theme; variacion: number | null; mejorSiSube?: boolean },
) {
  if (variacion === null) return <Text style={styles.deltaVacio}>—</Text>;
  const subio = variacion > 0;
  const conviene = mejorSiSube ? subio : !subio;
  const color = Math.abs(variacion) < 0.005 ? theme.silencio : conviene ? theme.ingresoTexto : theme.vencidoTexto;
  return <Text style={[styles.delta, { color }]}>{subio ? '+' : '−'}{Math.abs(variacion * 100).toFixed(0)}%</Text>;
}

function Leyenda(
  { styles, color, titulo, monto }:
  { styles: Estilos; color: string; titulo: string; monto: string },
) {
  return (
    <View style={styles.leyenda}>
      <View style={[styles.leyendaBarra, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.leyendaTitulo}>{titulo}</Text>
        <Text style={styles.leyendaMonto}>{monto}</Text>
      </View>
    </View>
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
    hero: { paddingTop: spacing.lg, paddingBottom: spacing.lg },
    heroFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
    heroSimbolo: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.md, color: theme.silencio, marginTop: 6 },
    heroCifra: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: 40, lineHeight: 44, color: theme.tinta, letterSpacing: -1 },
    heroPie: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },

    trio: { flexDirection: 'row', borderTopWidth: elevation.hairlineWidth, borderTopColor: theme.hairline, paddingTop: spacing.md },
    celda: { flex: 1, gap: 1 },
    celdaEtiqueta: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, textTransform: 'uppercase', letterSpacing: 0.8 },
    celdaValor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.tinta },
    delta: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10 },
    deltaVacio: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },

    bloqueIceberg: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
    leyendas: { flex: 1, gap: spacing.lg },
    leyenda: { flexDirection: 'row', gap: spacing.sm },
    leyendaBarra: { width: 3, borderRadius: radii.full },
    leyendaTitulo: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, textTransform: 'uppercase', letterSpacing: 0.8 },
    leyendaMonto: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.tinta },

    regla: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.xs },
    reglaTitulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    reglaLinea: { flex: 1, height: elevation.hairlineWidth, backgroundColor: theme.hairline },

    boton: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    botonTexto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.acentoTexto },
  });
}
