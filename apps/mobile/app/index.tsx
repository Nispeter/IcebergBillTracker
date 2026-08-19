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
import type { Movimiento } from '@iceberg/db';
import {
  charts, elevation, fontSizes, fonts, pesos, niceUnit, notchesFor, radii, spacing,
  type Theme,
} from '@iceberg/ui';
import { StatusBar } from 'expo-status-bar';
import { Link } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import {
  useAnalisisDelMes, useFechaDeCorte, useMovimientos, useResumenDelMes, useSaldo, useSaldoInicial,
} from '../datos/consultas';
import { useTema } from '../datos/tema';
import { BarraSegmentada } from '../components/BarraSegmentada';
import { Iceberg } from '../components/Iceberg';
import { FilaMovimiento } from '../components/FilaMovimiento';
import { iconoDeCategoria } from '../components/iconos';

export default function Home() {
  const { nombre: tema, theme, alternar } = useTema();
  const styles = useMemo(() => crearEstilos(theme), [theme]);

  // Todo sale de la base y es reactivo: al agregar un movimiento, el saldo, el
  // iceberg, las categorias y el listado se actualizan solos.
  const corte = useFechaDeCorte();
  const saldoInicial = useSaldoInicial();
  const saldo = useSaldo(saldoInicial);
  const mes = useResumenDelMes(corte);
  const analisis = useAnalisisDelMes(corte);
  const recientes = useMovimientos(8);
  const totalMovimientos = useMovimientos().length;

  const r = {
    periodo: capitalizar(dates.formatDateLong(mes.rango.start).replace(/^\d+ de /, '')),
    corte,
    saldo,
    ...mes,
    recientes,
    total: totalMovimientos,
    unidad: niceUnit(mes.mayorCategoria),
    muescas: notchesFor(mes.mayorCategoria, niceUnit(mes.mayorCategoria)),
  };

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.contenido}>

        <View style={styles.encabezado}>
          <Text style={styles.marca}>ICEBERG</Text>
          <View style={styles.accionesEncabezado}>
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
                <Plus size={18} weight="bold" color={theme.fondo} />
              </Pressable>
            </Link>
          </View>
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
          <FilaCifra
            styles={styles}
            etiqueta="Ingreso"
            valor={money.format(r.ingreso)}
            nota={<Delta styles={styles} theme={theme} variacion={analisis.comparacion.ingreso.variacion} mejorSiSube />}
          />
          <FilaCifra
            styles={styles}
            etiqueta="Gasto"
            valor={money.format(r.gasto)}
            nota={<Delta styles={styles} theme={theme} variacion={analisis.comparacion.gasto.variacion} />}
          />
          <FilaCifra styles={styles} etiqueta="Neto" valor={money.formatSigned(r.neto)} destacado />
        </View>

        {/* La proyeccion solo aparece con el mes en curso: cerrado ya no
            proyecta nada, muestra lo que fue. */}
        {analisis.ritmo.diasRestantes > 0 ? (
          <View style={styles.proyeccion}>
            <Text style={styles.proyeccionEtiqueta}>
              Si sigue este ritmo, el mes cierra en
            </Text>
            <Text style={styles.proyeccionCifra}>
              {money.format(analisis.ritmo.proyeccionPorPerfil ?? analisis.ritmo.proyeccionLineal)}
            </Text>
            {/* Se dice de que numero sale la proyeccion. Sin esto la cifra
                queda flotando al lado del gasto del mes y las dos parecen
                contradecirse: el gasto es del mes calendario completo y la
                proyeccion parte de lo que va hasta hoy. */}
            <Text style={styles.proyeccionNota}>
              Llevas {money.format(analisis.ritmo.gastadoHastaAhora)} en {analisis.ritmo.diasTranscurridos}
              {analisis.ritmo.diasTranscurridos === 1 ? ' día' : ' días'} ·
              {' '}{money.format(analisis.ritmo.promedioDiario)} diarios · quedan {analisis.ritmo.diasRestantes}
              {analisis.ritmo.proyeccionPorPerfil === null ? '' : ' · según cómo suele repartirse el mes'}
            </Text>
          </View>
        ) : null}

        <Regla styles={styles} titulo="Gasto por categoría" />
        <View>
          {r.porCategoria.map(({ categoria, total }) => {
            const Icono = iconoDeCategoria(categoria);
            return (
              <View key={categoria} style={styles.filaCategoria}>
                {Icono ? <Icono size={18} weight="regular" color={theme.silencio} /> : null}
                <Text style={styles.nombreCategoria} numberOfLines={1}>
                  {categories.categoryShortName(categoria)}
                </Text>
                {/* Alineadas en columna a proposito: puestas una bajo otra se
                    comparan sin leer un solo numero. */}
                <BarraSegmentada
                  valor={total.amountMinor}
                  unidad={r.unidad}
                  total={r.muescas}
                  theme={theme}
                />
                <Text style={styles.montoCategoria}>{money.formatNumber(total)}</Text>
              </View>
            );
          })}
        </View>

        <Regla
          styles={styles}
          titulo="Movimientos recientes"
          accion={(
            <Link href="/movimientos" asChild>
              <Pressable accessibilityRole="button">
                <Text style={styles.verTodos}>Ver todos</Text>
              </Pressable>
            </Link>
          )}
        />
        <View>
          {r.recientes.map((tx: Movimiento) => (
            <FilaMovimiento key={tx.id} tx={tx} theme={theme} />
          ))}
        </View>

        <Text style={styles.pie}>{r.total} movimientos guardados</Text>
      </ScrollView>
    </View>
  );
}

/** Primera letra en mayuscula. `formatDateLong` devuelve el mes en minuscula. */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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

function FilaCifra(
  { styles, etiqueta, valor, destacado, nota }:
  { styles: Estilos; etiqueta: string; valor: string; destacado?: boolean; nota?: ReactNode },
) {
  return (
    <View style={styles.filaCifra}>
      <Text style={styles.etiquetaCifra}>{etiqueta}</Text>
      {nota}
      <Text style={destacado ? styles.valorDestacado : styles.valorCifra}>{valor}</Text>
    </View>
  );
}

/**
 * La variacion contra el mes anterior.
 *
 * `null` cuando el mes anterior fue cero: no existe el porcentaje de cambio
 * respecto de nada, y mostrar "+100%" seria inventar.
 *
 * El color no sale del signo sino de si **conviene** o no: que el gasto suba es
 * malo y que el ingreso suba es bueno, aunque los dos sean "+".
 */
function Delta(
  { styles, theme, variacion, mejorSiSube }:
  { styles: Estilos; theme: Theme; variacion: number | null; mejorSiSube?: boolean },
) {
  if (variacion === null) return null;
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
      fontFamily: fonts.ui, fontWeight: pesos.bold,
      fontSize: fontSizes.sm,
      color: theme.tinta,
      letterSpacing: 3,
    },
    cambioTema: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },
    accionesEncabezado: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    botonAgregar: {
      width: 32,
      height: 32,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.acento,
    },

    hero: { paddingBottom: spacing.xl },
    heroFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
    // El simbolo de moneda va mas chico y apagado: lo que se lee es la cifra.
    heroSimbolo: {
      fontFamily: fonts.mono, fontWeight: pesos.regular,
      fontSize: fontSizes.lg,
      color: theme.silencio,
      marginTop: spacing.sm,
    },
    heroCifra: {
      fontFamily: fonts.mono, fontWeight: pesos.medium,
      fontSize: 56,
      lineHeight: 60,
      color: theme.tinta,
      letterSpacing: -2,
    },
    heroPie: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.silencio },

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
    leyendaTitulo: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.silencio },
    leyendaMonto: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.tinta },
    leyendaNota: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },

    regla: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    reglaTitulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.tinta },
    reglaLinea: { flex: 1, height: elevation.hairlineWidth, backgroundColor: theme.hairline },
    verTodos: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },

    filaCifra: {
      flexDirection: 'row',
      alignItems: 'baseline',
      paddingVertical: spacing.sm,
    },
    etiquetaCifra: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.md, color: theme.silencio },
    delta: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.xs, marginRight: spacing.md },

    proyeccion: { marginTop: spacing.lg, gap: 2 },
    proyeccionEtiqueta: {
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: fontSizes.xs,
      color: theme.silencio,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    proyeccionCifra: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.lg, color: theme.tinta },
    proyeccionNota: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    valorCifra: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.md, color: theme.tinta },
    valorDestacado: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.lg, color: theme.tinta },

    filaCategoria: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    nombreCategoria: { width: 88, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.tinta },
    montoCategoria: {
      width: 76,
      textAlign: 'right',
      fontFamily: fonts.mono, fontWeight: pesos.regular,
      fontSize: fontSizes.sm,
      color: theme.tinta,
    },


    pie: {
      fontFamily: fonts.ui, fontWeight: pesos.regular,
      fontSize: fontSizes.xs,
      color: theme.silencio,
      textAlign: 'center',
      marginTop: spacing.xxl,
    },
  });
}
