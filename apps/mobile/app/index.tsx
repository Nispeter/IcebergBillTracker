/**
 * Pantalla de verificacion de F0.
 *
 * No es la Home definitiva: existe para comprobar que los tokens, la tipografia
 * y la matematica de `@iceberg/core` estan bien conectados, y para poder mirar
 * la paleta en claro y en oscuro sin cambiar la configuracion del sistema.
 *
 * Ni un solo color literal en este archivo: todo sale de `@iceberg/ui`.
 */

import { categories, dates, money } from '@iceberg/core';
import { gastoPorCategoria, generateSeed, saldoActual, type SeedTransaction } from '@iceberg/seed';
import {
  charts, elevation, fontSizes, fonts, radii, spacing, themes,
  type Theme, type ThemeName,
} from '@iceberg/ui';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

export default function Pantalla() {
  const sistema = useColorScheme();
  const [tema, setTema] = useState<ThemeName>(sistema === 'dark' ? 'dark' : 'light');
  const theme = themes[tema];
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const resumen = useMemo(() => calcularResumen(), []);

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.contenido}>

        <View style={styles.encabezado}>
          <View>
            <Text style={styles.marca}>Iceberg</Text>
            <Text style={styles.periodo}>{resumen.periodo}</Text>
          </View>
          <Pressable
            onPress={() => setTema(tema === 'dark' ? 'light' : 'dark')}
            style={styles.interruptor}
            accessibilityRole="button"
            accessibilityLabel={`Cambiar a tema ${tema === 'dark' ? 'claro' : 'oscuro'}`}
          >
            <Text style={styles.interruptorTexto}>
              {tema === 'dark' ? 'Deshielo' : 'Noche polar'}
            </Text>
          </Pressable>
        </View>

        {/* La cifra que la gente abre la app para ver. */}
        <View style={styles.tarjeta}>
          <Text style={styles.etiqueta}>Plata restante</Text>
          <Text style={styles.cifraDisplay}>{money.format(resumen.saldo)}</Text>
          <Text style={styles.pieCifra}>al {dates.formatDateLong(resumen.corte)}</Text>

          <Separador styles={styles} />

          <View style={styles.filaCifras}>
            <Cifra styles={styles} etiqueta="Ingreso" valor={money.format(resumen.ingreso)} />
            <Cifra styles={styles} etiqueta="Gasto" valor={money.format(resumen.gasto)} />
            <Cifra styles={styles} etiqueta="Neto" valor={money.formatSigned(resumen.neto)} />
          </View>

          <Separador styles={styles} />

          {/* La metafora del iceberg: lo comprometido sobre la linea de agua,
              lo variable acumulado debajo. */}
          <Text style={styles.etiqueta}>Sobre la linea de agua</Text>
          <View style={styles.barra}>
            <View style={[styles.barraFijo, { flex: Math.max(resumen.fijo.amountMinor, 1) }]} />
            <View style={[styles.barraVariable, { flex: Math.max(resumen.variable.amountMinor, 1) }]} />
          </View>
          <View style={styles.filaLeyenda}>
            <Leyenda styles={styles} color={theme.gasto} texto={`Comprometido ${money.format(resumen.fijo)}`} />
            <Leyenda styles={styles} color={charts[0]} texto={`Variable ${money.format(resumen.variable)}`} />
          </View>
        </View>

        <Seccion styles={styles} titulo="Gasto por categoria">
          <View style={styles.tarjeta}>
            {resumen.porCategoria.map(({ categoria, total }, indice) => (
              <View key={categoria}>
                {indice > 0 ? <Separador styles={styles} /> : null}
                <View style={styles.filaCategoria}>
                  <Text style={styles.filaNombre} numberOfLines={1}>
                    {categories.categoryName(categoria)}
                  </Text>
                  <Text style={styles.monto}>
                    {money.formatNumber(total)}
                  </Text>
                </View>
                {/* Barra ordenada por tamano, no coloreada por categoria: doce
                    colores distintos serian un arcoiris, justo lo que el sistema
                    de diseno prohibe. */}
                <View style={styles.barraCategoria}>
                  <View
                    style={[
                      styles.barraCategoriaRelleno,
                      { flex: total.amountMinor },
                    ]}
                  />
                  <View style={{ flex: Math.max(resumen.mayorCategoria - total.amountMinor, 0) }} />
                </View>
              </View>
            ))}
          </View>
        </Seccion>

        <Seccion styles={styles} titulo="Ultimos movimientos">
          <View style={styles.tarjeta}>
            {resumen.recientes.map((tx, indice) => (
              <View key={tx.id}>
                {indice > 0 ? <Separador styles={styles} /> : null}
                <View style={styles.fila}>
                  <View style={styles.filaTexto}>
                    <Text style={styles.filaNombre} numberOfLines={1}>{tx.name}</Text>
                    <Text style={styles.filaMeta}>
                      {dates.formatDate(tx.occurredAt)}
                      {tx.category ? ` · ${categories.categoryName(tx.category)}` : ''}
                    </Text>
                  </View>
                  <Text style={tx.type === 'ingreso' ? styles.montoIngreso : styles.monto}>
                    {tx.type === 'ingreso' ? '+' : '−'}
                    {money.formatNumber(money.money(tx.amountMinor))}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Seccion>

        <Seccion styles={styles} titulo="Paleta">
          <View style={styles.muestrario}>
            {ROLES.map((rol) => (
              <View key={rol} style={styles.muestra}>
                <View style={[styles.muestraColor, { backgroundColor: theme[rol] }]} />
                <Text style={styles.muestraTexto}>{rol}</Text>
              </View>
            ))}
          </View>
        </Seccion>

        <Seccion styles={styles} titulo="Serie de graficos">
          <View style={styles.serie}>
            {charts.map((color, indice) => (
              <View
                key={color}
                style={[styles.serieBarra, { backgroundColor: color, height: 24 + (indice * 14) }]}
              />
            ))}
          </View>
        </Seccion>

        <Seccion styles={styles} titulo="Radios">
          <View style={styles.radios}>
            {RADIOS.map(([nombre, valor]) => (
              <View key={nombre} style={styles.radioItem}>
                <View style={[styles.radioCaja, { borderRadius: valor }]} />
                <Text style={styles.muestraTexto}>{nombre} · {valor}</Text>
              </View>
            ))}
          </View>
        </Seccion>

        <Text style={styles.pie}>
          {resumen.total} movimientos de semilla determinista
        </Text>
      </ScrollView>
    </View>
  );
}

const ROLES = [
  'fondo', 'superficie', 'tinta', 'silencio', 'hairline',
  'acento', 'acentoTexto', 'ingreso', 'ingresoTexto', 'vencido', 'vencidoTexto',
] as const;

const RADIOS = [['sm', radii.sm], ['md', radii.md], ['lg', radii.lg]] as const;

type Estilos = ReturnType<typeof crearEstilos>;

function Cifra({ styles, etiqueta, valor }: { styles: Estilos; etiqueta: string; valor: string }) {
  return (
    <View style={styles.cifraBloque}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={styles.cifraChica}>{valor}</Text>
    </View>
  );
}

function Seccion({ styles, titulo, children }: { styles: Estilos; titulo: string; children: ReactNode }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

function Separador({ styles }: { styles: Estilos }) {
  return <View style={styles.separador} />;
}

function Leyenda({ styles, color, texto }: { styles: Estilos; color: string; texto: string }) {
  return (
    <View style={styles.leyenda}>
      <View style={[styles.leyendaPunto, { backgroundColor: color }]} />
      <Text style={styles.leyendaTexto}>{texto}</Text>
    </View>
  );
}

function calcularResumen() {
  const dataset = generateSeed();
  const mes = dates.currentMonth(dataset.range.end);
  const delMes = dataset.transactions.filter((tx) => dates.containsDate(mes, tx.occurredAt));

  const total = (filtro: (tx: SeedTransaction) => boolean) =>
    money.sum(delMes.filter(filtro).map((tx) => money.money(tx.amountMinor)));

  const gasto = total((tx) => tx.type === 'gasto');
  const ingreso = total((tx) => tx.type === 'ingreso');
  const porCategoria = gastoPorCategoria(delMes);

  return {
    periodo: dates.formatDateLong(mes.start).replace(/^\d+ de /, ''),
    corte: dataset.range.end,
    // La plata que queda de verdad: saldo inicial mas todo lo que entro menos
    // todo lo que salio en los 18 meses, no solo el neto del mes.
    saldo: saldoActual(dataset),
    gasto,
    ingreso,
    neto: money.subtract(ingreso, gasto),
    fijo: total((tx) => tx.type === 'gasto' && tx.recurring),
    variable: total((tx) => tx.type === 'gasto' && !tx.recurring),
    porCategoria,
    mayorCategoria: porCategoria[0]?.total.amountMinor ?? 1,
    recientes: [...delMes].reverse().slice(0, 6),
    total: dataset.transactions.length,
  };
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: theme.fondo },
    contenido: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
      gap: spacing.xl,
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
    },

    encabezado: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.xxl,
    },
    marca: { fontFamily: fonts.ui.bold, fontSize: fontSizes.xl, color: theme.tinta, letterSpacing: -0.5 },
    periodo: {
      fontFamily: fonts.ui.medium,
      fontSize: fontSizes.sm,
      color: theme.silencio,
      textTransform: 'capitalize',
    },
    interruptor: {
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: theme.superficie,
    },
    interruptorTexto: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.xs, color: theme.acentoTexto },

    tarjeta: {
      backgroundColor: theme.superficie,
      borderRadius: radii.md,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      padding: spacing.xl,
      gap: spacing.md,
    },

    etiqueta: {
      fontFamily: fonts.ui.medium,
      fontSize: fontSizes.xs,
      color: theme.silencio,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    // Toda cifra de dinero va en monoespaciada, sin excepcion: es lo que hace
    // que las columnas de montos queden alineadas digito a digito.
    cifraDisplay: {
      fontFamily: fonts.mono.medium,
      fontSize: fontSizes.display,
      color: theme.tinta,
      letterSpacing: -1,
    },
    pieCifra: { fontFamily: fonts.ui.regular, fontSize: fontSizes.xs, color: theme.silencio },
    cifraChica: { fontFamily: fonts.mono.regular, fontSize: fontSizes.md, color: theme.tinta },
    filaCifras: { flexDirection: 'row', gap: spacing.xl },
    cifraBloque: { gap: spacing.xs },

    separador: {
      height: elevation.hairlineWidth,
      backgroundColor: theme.hairline,
      marginVertical: spacing.md,
    },

    barra: { flexDirection: 'row', height: 14, gap: 2 },
    barraFijo: { backgroundColor: theme.gasto, borderRadius: radii.sm },
    barraVariable: { backgroundColor: charts[0], borderRadius: radii.sm },
    filaLeyenda: { gap: spacing.xs },
    leyenda: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    leyendaPunto: { width: 8, height: 8, borderRadius: radii.full },
    leyendaTexto: { fontFamily: fonts.ui.regular, fontSize: fontSizes.sm, color: theme.silencio },

    seccion: { gap: spacing.md },
    seccionTitulo: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.lg, color: theme.tinta },

    filaCategoria: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.lg,
      marginBottom: spacing.sm,
    },
    barraCategoria: { flexDirection: 'row', height: 6 },
    barraCategoriaRelleno: { backgroundColor: charts[0], borderRadius: radii.sm },

    fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
    filaTexto: { flex: 1, gap: 2 },
    filaNombre: { fontFamily: fonts.ui.medium, fontSize: fontSizes.md, color: theme.tinta },
    filaMeta: { fontFamily: fonts.ui.regular, fontSize: fontSizes.xs, color: theme.silencio },
    monto: { fontFamily: fonts.mono.regular, fontSize: fontSizes.md, color: theme.gasto },
    // `ingresoTexto` es la aurora en su version legible: en claro se oscurece
    // hasta cumplir AA, en oscuro es la misma aurora viva.
    montoIngreso: { fontFamily: fonts.mono.medium, fontSize: fontSizes.md, color: theme.ingresoTexto },

    muestrario: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    muestra: { alignItems: 'center', gap: spacing.xs, width: 72 },
    muestraColor: {
      width: 56,
      height: 56,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    muestraTexto: { fontFamily: fonts.ui.regular, fontSize: fontSizes.xs, color: theme.silencio },

    serie: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 96 },
    serieBarra: { flex: 1, borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm },

    radios: { flexDirection: 'row', gap: spacing.xl },
    radioItem: { alignItems: 'center', gap: spacing.xs },
    radioCaja: {
      width: 56,
      height: 56,
      backgroundColor: theme.superficie,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },

    pie: { fontFamily: fonts.ui.regular, fontSize: fontSizes.xs, color: theme.silencio, textAlign: 'center' },
  });
}
