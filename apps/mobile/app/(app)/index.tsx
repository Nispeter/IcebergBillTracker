/**
 * Resumen: como voy en este periodo.
 *
 * El saldo, el iceberg y las tres cifras del periodo. Nada mas: lo demas tiene
 * su propia pestaña.
 */

import { money } from '@iceberg/core';
import type { Movimiento } from '@iceberg/db';
import { charts, elevation, fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { Link } from 'expo-router';
import { Info } from 'phosphor-react-native/src/icons/Info';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EXPLICACION_ANOMALIA, FilaMovimiento } from '../../components/FilaMovimiento';
import { Ayuda } from '../../components/Ayuda';
import { DetalleDeCifra, type Detalle } from '../../components/DetalleDeCifra';
import { Hoja } from '../../components/Hoja';
import { Iceberg } from '../../components/Iceberg';
import { Pantalla } from '../../components/Pantalla';
import {
  esComprometido, useAnalisisDeRango, useAnomalias, useDesgloseDelSaldo,
  useMovimientosFiltrados, useSaldoInicial, type DesgloseDelSaldo,
} from '../../datos/consultas';
import { nombreDePeriodo, usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

export default function Resumen() {
  const { theme } = useTema();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const { tipo, rango, corte } = usePeriodo();

  const desglose = useDesgloseDelSaldo(useSaldoInicial());
  const a = useAnalisisDeRango(rango, corte);
  // Del periodo, no de siempre: el resto de la pantalla habla del rango
  // elegido, y una lista de agosto debajo de cifras de marzo no se entiende.
  // Sin limite porque la hoja de detalle necesita todos, no los cuatro de arriba.
  const delPeriodo = useMovimientosFiltrados(
    useMemo(() => ({ desde: rango.start, hasta: rango.end }), [rango.start, rango.end]),
  );
  const recientes = delPeriodo.slice(0, 4);

  const anomalias = useAnomalias();
  const [cifra, setCifra] = useState<Cifra | null>(null);

  const variable = money.subtract(a.resumen.gasto, a.fijo);
  const share = money.ratio(a.fijo, a.resumen.gasto) ?? 0;

  const detalle = cifra === null ? null
    : detalleDe(cifra, { delPeriodo, resumen: a.resumen, fijo: a.fijo, variable, desglose });

  return (
    <Pantalla>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.hero}>
          <View style={styles.heroFila}>
            <Text style={styles.heroSimbolo}>$</Text>
            <Text style={styles.heroCifra}>{money.formatNumber(desglose.saldo)}</Text>
          </View>
          <Pressable
            onPress={() => setCifra('saldo')}
            style={styles.heroPieTocable}
            accessibilityRole="button"
            accessibilityLabel="Saldo disponible. De dónde sale este número"
          >
            <Text style={styles.heroPie}>Saldo disponible</Text>
            <Info size={11} weight="bold" color={theme.silencio} />
          </Pressable>
        </View>

        <View style={styles.trio}>
          <Celda styles={styles} theme={theme} etiqueta="Ingreso" valor={money.format(a.resumen.ingreso)}
            variacion={a.comparacion.ingreso.variacion} mejorSiSube onPress={() => setCifra('ingreso')} />
          <Celda styles={styles} theme={theme} etiqueta="Gasto" valor={money.format(a.resumen.gasto)}
            variacion={a.comparacion.gasto.variacion} onPress={() => setCifra('gasto')} />
          <Celda styles={styles} theme={theme} etiqueta="Neto" valor={money.formatSigned(a.resumen.neto)}
            onPress={() => setCifra('neto')} />
        </View>

        <View style={styles.bloqueIceberg}>
          <Iceberg shareComprometido={share} theme={theme} agua={charts[0]} profundidad={charts[1]} alto={190} />
          <View style={styles.leyendas}>
            {/* El `?` va con las leyendas porque es a ellas a las que explica. */}
            <View style={styles.leyendasCabecera}>
              <Text style={styles.leyendasTitulo}>Gasto del período</Text>
              <Ayuda
                theme={theme}
                texto={'Comprometido llega igual: arriendo, cuentas, cuotas, impuestos. '
                  + 'Variable es lo que decides tú, y es sobre lo único que puedes actuar.'}
              />
            </View>
            <Leyenda styles={styles} color={theme.gasto} titulo="Comprometido" monto={money.format(a.fijo)}
              onPress={() => setCifra('comprometido')} />
            <Leyenda styles={styles} color={charts[0]} titulo="Variable" monto={money.format(variable)}
              onPress={() => setCifra('variable')} />
          </View>
        </View>

        <View style={styles.regla}>
          <Text style={styles.reglaTitulo}>Últimos movimientos</Text>
          <View style={styles.reglaLinea} />
          <Ayuda theme={theme} texto={EXPLICACION_ANOMALIA} />
        </View>
        {recientes.length === 0
          ? <Text style={styles.sinMovimientos}>Sin movimientos en este período.</Text>
          : recientes.map((tx) => (
            <FilaMovimiento key={tx.id} tx={tx} theme={theme} anomala={anomalias.has(tx.id)} />
          ))}

        <Link href="/movimientos" asChild>
          <Pressable style={styles.verTodos} accessibilityRole="button">
            <Text style={styles.verTodosTexto}>Ver todos</Text>
          </Pressable>
        </Link>
      </ScrollView>

      <Hoja
        abierta={detalle !== null}
        titulo={cifra === null ? '' : tituloDe(cifra, nombreDePeriodo(tipo, rango))}
        theme={theme}
        onCerrar={() => setCifra(null)}
      >
        {detalle === null ? null : <DetalleDeCifra detalle={detalle} theme={theme} />}
      </Hoja>
    </Pantalla>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

/** Las cifras del Resumen que se pueden abrir. */
type Cifra = 'saldo' | 'ingreso' | 'gasto' | 'neto' | 'comprometido' | 'variable';

const TITULOS: Record<Cifra, string> = {
  saldo: 'Saldo disponible',
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  neto: 'Neto',
  comprometido: 'Comprometido',
  variable: 'Variable',
};

/**
 * El saldo no lleva periodo en el titulo.
 *
 * Es la unica cifra de la pantalla que **no** se acota al rango: sale de todo el
 * historial. Decir "Saldo disponible · Agosto 2026" contradecia a la formula de
 * abajo, que aclara justamente lo contrario.
 */
function tituloDe(cifra: Cifra, periodo: string): string {
  return cifra === 'saldo' ? TITULOS[cifra] : `${TITULOS[cifra]} · ${periodo}`;
}

/**
 * De donde sale cada cifra.
 *
 * Los montos **no se recalculan aca**: llegan los mismos que pinta la pantalla.
 * Rehacer la cuenta dentro de la hoja seria la forma mas facil de que el detalle
 * termine diciendo una cosa y la cifra otra. Lo unico que se arma aca es la
 * lista de lo que la compone, de mayor a menor, porque lo primero que uno busca
 * al abrir es el movimiento grande.
 */
function detalleDe(
  cifra: Cifra,
  datos: {
    delPeriodo: readonly Movimiento[];
    resumen: { ingreso: money.Money; gasto: money.Money; neto: money.Money };
    fijo: money.Money;
    variable: money.Money;
    desglose: DesgloseDelSaldo;
  },
): Detalle {
  const { delPeriodo, resumen, fijo, variable, desglose } = datos;
  const mayorPrimero = (lista: readonly Movimiento[]) =>
    [...lista].sort((x, y) => y.montoMinor - x.montoMinor);
  const gastos = delPeriodo.filter((m) => m.tipo === 'gasto');
  const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

  switch (cifra) {
    case 'ingreso': {
      const lista = delPeriodo.filter((m) => m.tipo === 'ingreso');
      return {
        total: resumen.ingreso,
        formula: `Suma de ${cuantos(lista.length, 'ingreso', 'ingresos')} del período. `
          + 'Las transferencias entre cuentas propias no cuentan: no entran ni salen.',
        movimientos: mayorPrimero(lista),
      };
    }
    case 'gasto':
      return {
        total: resumen.gasto,
        formula: `Suma de ${cuantos(gastos.length, 'gasto', 'gastos')} del período.`,
        movimientos: mayorPrimero(gastos),
      };
    case 'neto':
      return {
        total: resumen.neto,
        formula: 'Lo que entró menos lo que salió, dentro del período.',
        renglones: [
          { etiqueta: 'Ingreso', monto: resumen.ingreso },
          { etiqueta: 'Gasto', monto: resumen.gasto, resta: true },
        ],
      };
    case 'comprometido': {
      const lista = gastos.filter((m) => esComprometido(m.categoriaId));
      return {
        total: fijo,
        formula: 'Gastos en vivienda, servicios, deudas, ahorros e impuestos. Hasta que '
          + 'existan las reglas de recurrencia se deduce de la categoría, no del movimiento.',
        movimientos: mayorPrimero(lista),
      };
    }
    case 'variable': {
      const lista = gastos.filter((m) => !esComprometido(m.categoriaId));
      return {
        total: variable,
        formula: 'Todo el gasto que no es un compromiso fijo: lo que decides tú, uno por uno.',
        movimientos: mayorPrimero(lista),
      };
    }
    case 'saldo':
      return {
        total: desglose.saldo,
        formula: 'Sale de todo tu historial, no de este período: el saldo inicial de la '
          + 'cuenta, más cada ingreso, menos cada gasto.',
        renglones: [
          { etiqueta: 'Saldo inicial', monto: desglose.inicial },
          { etiqueta: 'Todo lo que entró', monto: desglose.ingresos },
          { etiqueta: 'Todo lo que salió', monto: desglose.gastos, resta: true },
        ],
      };
  }
}

function Celda(
  { styles, theme, etiqueta, valor, variacion, mejorSiSube, onPress }:
  {
    styles: Estilos; theme: Theme; etiqueta: string; valor: string;
    variacion?: number | null; mejorSiSube?: boolean; onPress: () => void;
  },
) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.celda}
      accessibilityRole="button"
      accessibilityLabel={`${etiqueta} ${valor}. De dónde sale este número`}
    >
      <Text style={styles.celdaEtiqueta}>{etiqueta}</Text>
      <Text style={styles.celdaValor} numberOfLines={1}>{valor}</Text>
      <Delta styles={styles} theme={theme} variacion={variacion ?? null} mejorSiSube={mejorSiSube} />
    </Pressable>
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
  { styles, color, titulo, monto, onPress }:
  { styles: Estilos; color: string; titulo: string; monto: string; onPress: () => void },
) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.leyenda}
      accessibilityRole="button"
      accessibilityLabel={`${titulo} ${monto}. De dónde sale este número`}
    >
      <View style={[styles.leyendaBarra, { backgroundColor: color }]} />
      <Text style={styles.leyendaTitulo}>{titulo}</Text>
      <Text style={styles.leyendaMonto}>{monto}</Text>
    </Pressable>
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
    heroPieTocable: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
    heroFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
    heroSimbolo: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.md, color: theme.silencio, marginTop: 6 },
    heroCifra: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: 40, lineHeight: 44, color: theme.tinta, letterSpacing: -1 },
    heroPie: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },

    trio: { flexDirection: 'row', borderTopWidth: elevation.hairlineWidth, borderTopColor: theme.hairline, paddingTop: spacing.md },
    // Subrayadas: las tres abren su detalle.
    celda: { flex: 1, gap: 1, paddingBottom: 4, marginRight: spacing.sm, borderBottomWidth: elevation.hairlineWidth, borderBottomColor: theme.hairline },
    celdaEtiqueta: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, textTransform: 'uppercase', letterSpacing: 0.8 },
    celdaValor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.tinta },
    delta: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10 },
    deltaVacio: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },

    bloqueIceberg: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
    // Corridas del dibujo: pegadas al hielo se leian como parte de el.
    leyendas: { flex: 1, gap: spacing.sm, paddingLeft: spacing.md },
    // Elevada para que la burbuja de la ayuda tape las leyendas de abajo.
    leyendasCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.xs, zIndex: 20 },
    leyendasTitulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    // En una linea y con el monto a la derecha: el bloque ocupa el ancho que
    // tiene en vez de dejar un hueco muerto al costado del iceberg.
    leyenda: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: 4, borderBottomWidth: elevation.hairlineWidth, borderBottomColor: theme.hairline },
    leyendaBarra: { width: 3, height: 15, borderRadius: radii.full },
    leyendaTitulo: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, textTransform: 'uppercase', letterSpacing: 0.8 },
    leyendaMonto: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.tinta },

    regla: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.xs, zIndex: 20 },
    reglaTitulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    reglaLinea: { flex: 1, height: elevation.hairlineWidth, backgroundColor: theme.hairline },

    // Discreto a proposito: no compite con los movimientos que tiene encima.
    verTodos: { marginTop: spacing.md, alignItems: 'flex-end' },
    verTodosTexto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: 10, color: theme.acentoTexto },
    sinMovimientos: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio, paddingVertical: spacing.md },
  });
}
