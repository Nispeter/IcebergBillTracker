/**
 * Home.
 *
 * Deliberadamente **sin tarjetas**. Un stack de cards redondeadas con el mismo
 * padding es la firma del look generico, y esta app tiene una regla dura contra
 * eso. La jerarquia la dan aca otras cosas: una cifra enorme sin caja, reglas
 * con etiqueta que separan secciones, filas a sangre completa con hairlines, y
 * las cifras en monoespaciada formando una columna que se puede comparar de un
 * vistazo.
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
import { Iceberg } from '../components/Iceberg';
import { iconoDeCategoria } from '../components/iconos';

export default function Home() {
  const sistema = useColorScheme();
  const [tema, setTema] = useState<ThemeName>(sistema === 'dark' ? 'dark' : 'light');
  const theme = themes[tema];
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const r = useMemo(() => calcularResumen(), []);

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.contenido}>

        <View style={styles.encabezado}>
          <Text style={styles.marca}>ICEBERG</Text>
          <Pressable
            onPress={() => setTema(tema === 'dark' ? 'light' : 'dark')}
            accessibilityRole="button"
            accessibilityLabel={`Cambiar a tema ${tema === 'dark' ? 'claro' : 'oscuro'}`}
          >
            <Text style={styles.cambioTema}>{tema === 'dark' ? 'Deshielo' : 'Noche polar'}</Text>
          </Pressable>
        </View>

        {/* La cifra que la gente abre la app para ver. Sin caja, sin borde: el
            tamano solo ya establece que es lo mas importante de la pantalla. */}
        <View style={styles.hero}>
          <View style={styles.heroFila}>
            <Text style={styles.heroSimbolo}>$</Text>
            <Text style={styles.heroCifra}>{money.formatNumber(r.saldo)}</Text>
          </View>
          <Text style={styles.heroPie}>
            Saldo disponible · {dates.formatDateLong(r.corte)}
          </Text>
        </View>

        <View style={styles.bloqueIceberg}>
          <Iceberg
            shareComprometido={r.shareComprometido}
            theme={theme}
            agua={charts[0]}
            profundidad={charts[1]}
            alto={210}
          />
          <View style={styles.leyendas}>
            <Leyenda
              styles={styles}
              color={theme.gasto}
              titulo="Gasto comprometido"
              monto={money.format(r.fijo)}
              nota="Arriendo, cuentas y cuotas"
            />
            <Leyenda
              styles={styles}
              color={charts[0]}
              titulo="Gasto variable"
              monto={money.format(r.variable)}
              nota="Discrecional del mes"
            />
          </View>
        </View>

        <Regla styles={styles} titulo={r.periodo} />
        <View>
          <FilaCifra styles={styles} etiqueta="Ingreso" valor={money.format(r.ingreso)} />
          <FilaCifra styles={styles} etiqueta="Gasto" valor={money.format(r.gasto)} />
          <FilaCifra styles={styles} etiqueta="Neto" valor={money.formatSigned(r.neto)} destacado />
        </View>

        <Regla styles={styles} titulo="Gasto por categoría" />
        <View>
          {r.porCategoria.map(({ categoria, total, parte }) => {
            const Icono = iconoDeCategoria(categoria);
            return (
              <View key={categoria} style={styles.filaCategoria}>
                <Icono size={18} weight="regular" color={theme.silencio} />
                <Text style={styles.nombreCategoria} numberOfLines={1}>
                  {categories.categoryShortName(categoria)}
                </Text>
                {/* Las barras quedan alineadas en columna a proposito: puestas
                    una bajo otra se comparan sin leer un solo numero. El riel
                    de atras muestra hasta donde llegarian, que es lo que da la
                    escala; sin el, las barras chicas flotan sin referencia. */}
                <View style={styles.pista}>
                  <View style={[styles.relleno, { flex: Math.max(parte, 0.001) }]} />
                  <View style={{ flex: Math.max(1 - parte, 0.001) }} />
                </View>
                <Text style={styles.montoCategoria}>{money.formatNumber(total)}</Text>
              </View>
            );
          })}
        </View>

        <Regla styles={styles} titulo="Movimientos recientes" />
        <View>
          {r.recientes.map((tx) => {
            const Icono = tx.category ? iconoDeCategoria(tx.category) : null;
            return (
              <View key={tx.id} style={styles.filaMovimiento}>
                <View style={styles.marcaFecha}>
                  <Text style={styles.dia}>{dates.day(tx.occurredAt)}</Text>
                  <Text style={styles.mes}>{MESES[dates.month(tx.occurredAt) - 1]}</Text>
                </View>
                <View style={styles.textoMovimiento}>
                  <Text style={styles.nombreMovimiento} numberOfLines={1}>{tx.name}</Text>
                  <View style={styles.metaMovimiento}>
                    {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
                    <Text style={styles.categoriaMovimiento}>
                      {tx.category ? categories.categoryName(tx.category) : 'Ingreso'}
                      {tx.recurring ? ' · Recurrente' : ''}
                    </Text>
                  </View>
                </View>
                <Text style={tx.type === 'ingreso' ? styles.montoIngreso : styles.montoGasto}>
                  {tx.type === 'ingreso' ? '+' : '−'}
                  {money.formatNumber(money.money(tx.amountMinor))}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.pie}>Datos de prueba · {r.total} movimientos</Text>
      </ScrollView>
    </View>
  );
}

/** Primera letra en mayuscula. `formatDateLong` devuelve el mes en minuscula. */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

type Estilos = ReturnType<typeof crearEstilos>;

/** Separador de seccion: etiqueta chica y una linea que se va hasta el borde. */
function Regla({ styles, titulo }: { styles: Estilos; titulo: string }) {
  return (
    <View style={styles.regla}>
      <Text style={styles.reglaTitulo}>{titulo}</Text>
      <View style={styles.reglaLinea} />
    </View>
  );
}

function FilaCifra(
  { styles, etiqueta, valor, destacado }:
  { styles: Estilos; etiqueta: string; valor: string; destacado?: boolean },
) {
  return (
    <View style={styles.filaCifra}>
      <Text style={styles.etiquetaCifra}>{etiqueta}</Text>
      <Text style={destacado ? styles.valorDestacado : styles.valorCifra}>{valor}</Text>
    </View>
  );
}

function Leyenda(
  { styles, color, titulo, monto, nota }:
  { styles: Estilos; color: string; titulo: string; monto: string; nota: string },
) {
  return (
    <View style={styles.leyenda}>
      <View style={[styles.leyendaBarra, { backgroundColor: color }]} />
      <View style={styles.leyendaTextos}>
        <Text style={styles.leyendaTitulo}>{titulo}</Text>
        <Text style={styles.leyendaMonto}>{monto}</Text>
        <Text style={styles.leyendaNota}>{nota}</Text>
      </View>
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
  const fijo = total((tx) => tx.type === 'gasto' && tx.recurring);
  const mayor = gastoPorCategoria(delMes)[0]?.total.amountMinor ?? 1;

  return {
    periodo: capitalizar(dates.formatDateLong(mes.start).replace(/^\d+ de /, '')),
    corte: dataset.range.end,
    // La plata que queda de verdad: saldo inicial mas todo lo que entro menos
    // todo lo que salio en los 18 meses, no solo el neto del mes.
    saldo: saldoActual(dataset),
    gasto,
    ingreso,
    neto: money.subtract(ingreso, gasto),
    fijo,
    variable: total((tx) => tx.type === 'gasto' && !tx.recurring),
    shareComprometido: money.ratio(fijo, gasto) ?? 0,
    // La barra se mide contra la categoria mas grande, no contra el total: si
    // se midiera contra el total, diez de las doce quedarian invisibles.
    porCategoria: gastoPorCategoria(delMes).map((fila) => ({
      ...fila,
      parte: fila.total.amountMinor / mayor,
    })),
    recientes: [...delMes].reverse().slice(0, 8),
    total: dataset.transactions.length,
  };
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
      paddingBottom: spacing.xxl,
    },
    marca: {
      fontFamily: fonts.ui.bold,
      fontSize: fontSizes.sm,
      color: theme.tinta,
      letterSpacing: 3,
    },
    cambioTema: { fontFamily: fonts.ui.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },

    hero: { paddingBottom: spacing.xl },
    heroFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
    // El simbolo de moneda va mas chico y apagado: lo que se lee es la cifra.
    heroSimbolo: {
      fontFamily: fonts.mono.regular,
      fontSize: fontSizes.lg,
      color: theme.silencio,
      marginTop: spacing.sm,
    },
    heroCifra: {
      fontFamily: fonts.mono.medium,
      fontSize: 56,
      lineHeight: 60,
      color: theme.tinta,
      letterSpacing: -2,
    },
    heroPie: { fontFamily: fonts.ui.regular, fontSize: fontSizes.sm, color: theme.silencio },

    bloqueIceberg: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xl,
      paddingVertical: spacing.lg,
    },
    leyendas: { flex: 1, gap: spacing.xl },
    leyenda: { flexDirection: 'row', gap: spacing.md },
    leyendaBarra: { width: 3, borderRadius: radii.full },
    leyendaTextos: { flex: 1, gap: 1 },
    leyendaTitulo: { fontFamily: fonts.ui.medium, fontSize: fontSizes.xs, color: theme.silencio },
    leyendaMonto: { fontFamily: fonts.mono.medium, fontSize: fontSizes.md, color: theme.tinta },
    leyendaNota: { fontFamily: fonts.ui.regular, fontSize: fontSizes.xs, color: theme.silencio },

    regla: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    reglaTitulo: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.sm, color: theme.tinta },
    reglaLinea: { flex: 1, height: elevation.hairlineWidth, backgroundColor: theme.hairline },

    filaCifra: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    etiquetaCifra: { fontFamily: fonts.ui.regular, fontSize: fontSizes.md, color: theme.silencio },
    valorCifra: { fontFamily: fonts.mono.regular, fontSize: fontSizes.md, color: theme.tinta },
    valorDestacado: { fontFamily: fonts.mono.medium, fontSize: fontSizes.lg, color: theme.tinta },

    filaCategoria: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    nombreCategoria: { width: 88, fontFamily: fonts.ui.regular, fontSize: fontSizes.sm, color: theme.tinta },
    pista: {
      flex: 1,
      flexDirection: 'row',
      height: 8,
      backgroundColor: theme.hairline,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    relleno: { backgroundColor: charts[0] },
    montoCategoria: {
      width: 76,
      textAlign: 'right',
      fontFamily: fonts.mono.regular,
      fontSize: fontSizes.sm,
      color: theme.tinta,
    },

    filaMovimiento: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    marcaFecha: { width: 30, alignItems: 'center' },
    dia: { fontFamily: fonts.mono.medium, fontSize: fontSizes.md, color: theme.tinta },
    mes: { fontFamily: fonts.ui.regular, fontSize: 10, color: theme.silencio, textTransform: 'uppercase' },
    textoMovimiento: { flex: 1, gap: 2 },
    nombreMovimiento: { fontFamily: fonts.ui.medium, fontSize: fontSizes.md, color: theme.tinta },
    metaMovimiento: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    categoriaMovimiento: { fontFamily: fonts.ui.regular, fontSize: fontSizes.xs, color: theme.silencio },
    montoGasto: { fontFamily: fonts.mono.regular, fontSize: fontSizes.md, color: theme.gasto },
    // `ingresoTexto` es la aurora en su version legible: en claro se oscurece
    // hasta cumplir AA, en oscuro es la misma aurora viva.
    montoIngreso: { fontFamily: fonts.mono.medium, fontSize: fontSizes.md, color: theme.ingresoTexto },

    pie: {
      fontFamily: fonts.ui.regular,
      fontSize: fontSizes.xs,
      color: theme.silencio,
      textAlign: 'center',
      marginTop: spacing.xxl,
    },
  });
}
