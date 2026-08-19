/**
 * Home.
 *
 * Deliberadamente **sin tarjetas**. Un stack de cards redondeadas con el mismo
 * padding es la firma del look generico, y esta app tiene una regla dura contra
 * eso. La jerarquia la dan aca otras cosas: una cifra grande sin caja, reglas
 * con etiqueta que separan secciones, filas a sangre completa con hairlines, y
 * las cifras en monoespaciada formando una columna comparable de un vistazo.
 *
 * Todo cuelga del **selector de rango**: dia, semana, mes o ano. Cambiarlo no
 * solo mueve las fechas, cambia contra que se compara, porque el rango sabe de
 * que tipo es.
 *
 * Ni un solo color literal en este archivo: todo sale de `@iceberg/ui`.
 */

import { categories, dates, money } from '@iceberg/core';
import type { Movimiento } from '@iceberg/db';
import {
  charts, elevation, fontSizes, fonts, niceUnit, notchesFor, pesos, radii, spacing,
  type Theme,
} from '@iceberg/ui';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarraSegmentada } from '../components/BarraSegmentada';
import { FilaMovimiento } from '../components/FilaMovimiento';
import { Iceberg } from '../components/Iceberg';
import { SelectorDeRango, nombreDeRango, rangoDe, type TipoDeRango } from '../components/SelectorDeRango';
import { iconoDeCategoria } from '../components/iconos';
import {
  useAnalisisDeRango, useFechaDeCorte, useMovimientos, useSaldo, useSaldoInicial,
} from '../datos/consultas';
import { useTema } from '../datos/tema';

/** Cuantas categorias se listan antes de resumir el resto en una linea. */
const CATEGORIAS_VISIBLES = 6;

export default function Home() {
  const { nombre: tema, theme, alternar } = useTema();
  const styles = useMemo(() => crearEstilos(theme), [theme]);

  const [tipoDeRango, setTipoDeRango] = useState<TipoDeRango>('month');

  const corte = useFechaDeCorte();
  const rango = useMemo(() => rangoDe(tipoDeRango, corte), [tipoDeRango, corte]);

  const saldo = useSaldo(useSaldoInicial());
  const a = useAnalisisDeRango(rango, corte);
  const recientes = useMovimientos(6);

  const variable = money.subtract(a.resumen.gasto, a.fijo);
  const share = money.ratio(a.fijo, a.resumen.gasto) ?? 0;
  const unidad = niceUnit(a.mayorCategoria);
  const muescas = notchesFor(a.mayorCategoria, unidad);

  const visibles = a.porCategoria.slice(0, CATEGORIAS_VISIBLES);
  const resto = a.porCategoria.slice(CATEGORIAS_VISIBLES);
  const totalResto = money.sum(resto.map((fila) => fila.total));

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.contenido}>

        <View style={styles.encabezado}>
          <Text style={styles.marca}>ICEBERG</Text>
          <View style={styles.acciones}>
            <Pressable
              onPress={alternar}
              accessibilityRole="button"
              accessibilityLabel={`Cambiar a tema ${tema === 'dark' ? 'claro' : 'oscuro'}`}
            >
              <Text style={styles.cambioTema}>{tema === 'dark' ? 'Deshielo' : 'Noche polar'}</Text>
            </Pressable>
            <Link href="/nuevo" asChild>
              <Pressable
                style={styles.botonAgregar}
                accessibilityRole="button"
                accessibilityLabel="Agregar movimiento"
              >
                <Plus size={16} weight="bold" color={theme.fondo} />
              </Pressable>
            </Link>
          </View>
        </View>

        {/* La cifra que la gente abre la app para ver. Sin caja, sin borde. */}
        <View style={styles.hero}>
          <View style={styles.heroFila}>
            <Text style={styles.heroSimbolo}>$</Text>
            <Text style={styles.heroCifra}>{money.formatNumber(saldo)}</Text>
          </View>
          <Text style={styles.heroPie}>Saldo disponible · {dates.formatDate(corte)}</Text>
        </View>

        <SelectorDeRango theme={theme} valor={tipoDeRango} onElegir={setTipoDeRango} />

        <View style={styles.periodo}>
          <Text style={styles.periodoNombre}>{nombreDeRango(tipoDeRango, rango)}</Text>
          {a.ritmo.diasRestantes > 0 && tipoDeRango !== 'day' ? (
            <Text style={styles.periodoNota}>
              proyecta {money.format(a.ritmo.proyeccionPorPerfil ?? a.ritmo.proyeccionLineal)}
            </Text>
          ) : null}
        </View>

        {/* Tres cifras en una fila: ocupan un tercio de lo que ocupaban
            apiladas y se comparan igual de bien. */}
        <View style={styles.trio}>
          <Celda
            styles={styles}
            theme={theme}
            etiqueta="Ingreso"
            valor={money.format(a.resumen.ingreso)}
            variacion={a.comparacion.ingreso.variacion}
            mejorSiSube
          />
          <Celda
            styles={styles}
            theme={theme}
            etiqueta="Gasto"
            valor={money.format(a.resumen.gasto)}
            variacion={a.comparacion.gasto.variacion}
          />
          <Celda
            styles={styles}
            theme={theme}
            etiqueta="Neto"
            valor={money.formatSigned(a.resumen.neto)}
          />
        </View>

        <View style={styles.bloqueIceberg}>
          <Iceberg
            shareComprometido={share}
            theme={theme}
            agua={charts[0]}
            profundidad={charts[1]}
            alto={150}
          />
          <View style={styles.leyendas}>
            <Leyenda styles={styles} color={theme.gasto} titulo="Comprometido" monto={money.format(a.fijo)} />
            <Leyenda styles={styles} color={charts[0]} titulo="Variable" monto={money.format(variable)} />
            <Text style={styles.leyendaNota}>
              {a.resumen.cantidadDeGastos} gastos · mediana {money.format(a.resumen.ticketMediano)}
            </Text>
          </View>
        </View>

        <Regla styles={styles} titulo="Gasto por categoría" />
        <View>
          {visibles.map(({ categoriaId, total }) => {
            const Icono = iconoDeCategoria(categoriaId);
            return (
              <View key={categoriaId} style={styles.filaCategoria}>
                {Icono ? <Icono size={15} weight="regular" color={theme.silencio} /> : null}
                <Text style={styles.nombreCategoria} numberOfLines={1}>
                  {categories.categoryShortName(categoriaId)}
                </Text>
                <BarraSegmentada valor={total.amountMinor} unidad={unidad} total={muescas} theme={theme} />
                <Text style={styles.montoCategoria}>{money.formatNumber(total)}</Text>
              </View>
            );
          })}
          {resto.length > 0 ? (
            <Text style={styles.restoCategorias}>
              y {resto.length} categorías más · {money.format(totalResto)}
            </Text>
          ) : null}
          {a.porCategoria.length === 0 ? (
            <Text style={styles.vacio}>Sin gastos en este período.</Text>
          ) : null}
        </View>

        <Regla
          styles={styles}
          titulo="Últimos movimientos"
          accion={(
            <Link href="/movimientos" asChild>
              <Pressable accessibilityRole="button">
                <Text style={styles.verTodos}>Ver todos</Text>
              </Pressable>
            </Link>
          )}
        />
        <View>
          {recientes.map((tx: Movimiento) => (
            <FilaMovimiento key={tx.id} tx={tx} theme={theme} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

/** Separador de seccion: etiqueta chica y una linea que se va hasta el borde. */
function Regla(
  { styles, titulo, accion }:
  { styles: Estilos; titulo: string; accion?: ReactNode },
) {
  return (
    <View style={styles.regla}>
      <Text style={styles.reglaTitulo}>{titulo}</Text>
      <View style={styles.reglaLinea} />
      {accion}
    </View>
  );
}

/** Una de las tres cifras del periodo, con su variacion debajo. */
function Celda(
  { styles, theme, etiqueta, valor, variacion, mejorSiSube }:
  {
    styles: Estilos; theme: Theme; etiqueta: string; valor: string;
    variacion?: number | null; mejorSiSube?: boolean;
  },
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
 * La variacion contra el periodo anterior.
 *
 * `null` cuando el anterior fue cero: no existe el porcentaje de cambio
 * respecto de nada, y mostrar "+100%" seria inventar.
 *
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
  const color = Math.abs(variacion) < 0.005
    ? theme.silencio
    : conviene ? theme.ingresoTexto : theme.vencidoTexto;
  return (
    <Text style={[styles.delta, { color }]}>
      {subio ? '+' : '−'}{Math.abs(variacion * 100).toFixed(0)}%
    </Text>
  );
}

function Leyenda(
  { styles, color, titulo, monto }:
  { styles: Estilos; color: string; titulo: string; monto: string },
) {
  return (
    <View style={styles.leyenda}>
      <View style={[styles.leyendaBarra, { backgroundColor: color }]} />
      <View style={styles.leyendaTextos}>
        <Text style={styles.leyendaTitulo}>{titulo}</Text>
        <Text style={styles.leyendaMonto}>{monto}</Text>
      </View>
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: theme.fondo },
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },

    encabezado: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    marca: { fontFamily: fonts.ui, fontWeight: pesos.bold, fontSize: fontSizes.xs, color: theme.tinta, letterSpacing: 3 },
    acciones: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    cambioTema: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },
    botonAgregar: {
      width: 28,
      height: 28,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.acento,
    },

    hero: { paddingBottom: spacing.lg },
    heroFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
    // El simbolo va mas chico y apagado: lo que se lee es la cifra.
    heroSimbolo: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.md, color: theme.silencio, marginTop: 6 },
    heroCifra: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: 40, lineHeight: 44, color: theme.tinta, letterSpacing: -1 },
    heroPie: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },

    periodo: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    periodoNombre: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.tinta },
    periodoNota: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },

    trio: {
      flexDirection: 'row',
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
      paddingTop: spacing.md,
    },
    celda: { flex: 1, gap: 1 },
    celdaEtiqueta: {
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: 10,
      color: theme.silencio,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    celdaValor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.tinta },
    delta: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10 },
    deltaVacio: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },

    bloqueIceberg: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.md,
    },
    leyendas: { flex: 1, gap: spacing.md },
    leyenda: { flexDirection: 'row', gap: spacing.sm },
    leyendaBarra: { width: 3, borderRadius: radii.full },
    leyendaTextos: { flex: 1 },
    leyendaTitulo: {
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: 10,
      color: theme.silencio,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    leyendaMonto: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.tinta },
    leyendaNota: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },

    regla: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    reglaTitulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    reglaLinea: { flex: 1, height: elevation.hairlineWidth, backgroundColor: theme.hairline },
    verTodos: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: 10, color: theme.acentoTexto },

    filaCategoria: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
    nombreCategoria: { width: 78, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    montoCategoria: {
      width: 66,
      textAlign: 'right',
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: fontSizes.xs,
      color: theme.tinta,
    },
    restoCategorias: {
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: 10,
      color: theme.silencio,
      marginTop: spacing.sm,
    },
    vacio: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
  });
}
