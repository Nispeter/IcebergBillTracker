/**
 * Resumen: como voy en este periodo.
 *
 * El saldo, el iceberg y las tres cifras del periodo. Nada mas: lo demas tiene
 * su propia pestaña.
 *
 * ## Prototipo "Hielo"
 *
 * Esta pantalla va adelante de las otras cinco a proposito. El diagnostico fue
 * que la app se veia como un panel generado: toda monoespaciada, plana, con
 * cada seccion anunciada por un `Titulo ───── ?` y etiquetas en versalitas
 * espaciadas. Quitar lineas no arreglaba eso, porque lo que delata es la
 * tipografia y el color, no la densidad de reglas.
 *
 * Lo que cambia:
 *
 * - **El agua es la pantalla.** El fondo es un degradado que se hace mas hondo
 *   hacia abajo, y la **linea de agua cruza de borde a borde**. El iceberg deja
 *   de ser un dibujo dentro de una caja y pasa a flotar en la pantalla. Es el
 *   unico gesto de la vista que no se puede copiar de un panel generico, porque
 *   sale de la metafora del proyecto y no de una libreria.
 * - **Dos familias.** El texto en sans y solo las cifras en monoespaciada. Una
 *   interfaz entera en mono oscuro se lee como terminal.
 * - **Sin versalitas espaciadas y sin reglas de seccion.** Las etiquetas van en
 *   minuscula y la jerarquia sale del tamaño y del aire.
 */

import { money } from '@iceberg/core';
import type { Movimiento } from '@iceberg/db';
import {
  AIRE_PARA_EL_FLOTANTE, charts, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { Link } from 'expo-router';
import { Info } from 'phosphor-react-native/src/icons/Info';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { EXPLICACION_ANOMALIA, FilaMovimiento } from '../../components/FilaMovimiento';
import { Ayuda } from '../../components/Ayuda';
import { Pinguino } from '../../components/Pinguino';
import { DetalleDeCifra, type Detalle } from '../../components/DetalleDeCifra';
import { Hoja } from '../../components/Hoja';
import { Iceberg, alturaDeLineaDeAgua } from '../../components/Iceberg';
import { Pantalla } from '../../components/Pantalla';
import { useDesplazamiento } from '../../datos/desplazamiento';
import {
  esGastoComprometido, useAnalisisDeRango, useAnomalias, useDesgloseDelSaldo,
  useMovimientosDeRegla, useMovimientosFiltrados, useSaldoInicial, type DesgloseDelSaldo,
} from '../../datos/consultas';
import { nombreDePeriodo, usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

/** El alto del hielo. Es la pieza mas grande de la pantalla, y tiene que serlo. */
const ALTO_HIELO = 240;

export default function Resumen() {
  const { theme } = useTema();
  const desplazamiento = useDesplazamiento();
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
  const deRegla = useMovimientosDeRegla(rango);
  const [cifra, setCifra] = useState<Cifra | null>(null);

  const variable = money.subtract(a.resumen.gasto, a.fijo);
  const share = money.ratio(a.fijo, a.resumen.gasto) ?? 0;

  const detalle = cifra === null ? null
    : detalleDe(cifra, { delPeriodo, resumen: a.resumen, fijo: a.fijo, variable, desglose, deRegla });

  return (
    <Pantalla>
      {/*
        La columna de agua.
        Va detras de todo y **no se desplaza**: la profundidad es de la pantalla,
        no del contenido. Arriba la superficie, abajo el abismo.
      */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="columnaDeAgua" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.aguaSuperficie} />
            <Stop offset="1" stopColor={theme.aguaProfunda} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#columnaDeAgua)" />
      </Svg>

      <ScrollView contentContainerStyle={styles.contenido} {...desplazamiento}>
        <Pressable
          onPress={() => setCifra('saldo')}
          style={styles.hero}
          accessibilityRole="button"
          accessibilityLabel={`Saldo disponible ${money.format(desglose.saldo)}. De dónde sale este número`}
        >
          <View style={styles.heroFila}>
            <Text style={styles.heroSimbolo}>$</Text>
            <Text style={styles.heroCifra}>{money.formatNumber(desglose.saldo)}</Text>
          </View>
          <View style={styles.heroPieFila}>
            <Text style={styles.heroPie}>disponible</Text>
            <Info size={12} weight="regular" color={theme.silencio} />
          </View>
        </Pressable>

        {/*
          El hielo y el mar.
          La linea de agua se sale del ancho del contenido a proposito: es el
          nivel del mar, no el borde de una figura. Que cruce la pantalla entera
          es lo que convierte al iceberg en algo que flota y no en una ilustracion
          metida en una caja.
        */}
        <View style={styles.escena}>
          <View style={styles.hielo}>
            <Iceberg
              shareComprometido={share}
              theme={theme}
              agua={charts[0]}
              profundidad={charts[1]}
              alto={ALTO_HIELO}
              dibujarLinea={false}
            />
          </View>
          <View style={[styles.lineaDeAgua, { top: alturaDeLineaDeAgua(share, ALTO_HIELO) }]} />
        </View>

        {/*
          El reparto del gasto, con la misma division que el dibujo.
          La barra repite la linea de agua en recto: el iceberg codifica la
          proporcion como **area**, que se juzga mal a ojo, y la barra la pone
          sobre un eje donde se lee de una. Es el mismo dato dos veces a
          proposito, y es lo que le da forma a una banda que si no son cinco
          cifras del mismo tamaño una al lado de la otra.
        */}
        <View style={styles.reparto}>
          <Leyenda styles={styles} titulo="comprometido" monto={money.format(a.fijo)}
            parte={share} onPress={() => setCifra('comprometido')} />
          <Leyenda styles={styles} titulo="variable" monto={money.format(variable)}
            parte={1 - share} alDerecho onPress={() => setCifra('variable')} />
          <Ayuda
            theme={theme}
            texto={'Comprometido llega igual: arriendo, cuentas, cuotas, impuestos. '
              + 'Variable es lo que decides tú, y es sobre lo único que puedes actuar.'}
          />
        </View>


        {/* La tarjeta se hunde en vez de levantarse: ver `superficieHonda`. */}
        <View style={styles.trio}>
          <Celda styles={styles} theme={theme} etiqueta="ingreso" valor={money.format(a.resumen.ingreso)}
            variacion={a.comparacion.ingreso.variacion} mejorSiSube onPress={() => setCifra('ingreso')} />
          <Celda styles={styles} theme={theme} etiqueta="gasto" valor={money.format(a.resumen.gasto)}
            variacion={a.comparacion.gasto.variacion} onPress={() => setCifra('gasto')} />
          <Celda styles={styles} theme={theme} etiqueta="neto" valor={money.formatSigned(a.resumen.neto)}
            color={money.isNegative(a.resumen.neto) ? theme.vencidoTexto : theme.ingresoTexto}
            onPress={() => setCifra('neto')} />
        </View>

        {/* Sin regla: el titulo y el aire de arriba alcanzan para separar. */}
        <View style={styles.tituloFila}>
          <Text style={styles.titulo}>Últimos movimientos</Text>
          <Ayuda theme={theme} texto={EXPLICACION_ANOMALIA} />
        </View>
        {recientes.length === 0
          ? (
            <View style={styles.vacio}>
              <Pinguino theme={theme} tamano={40} estado="dormido" />
              <Text style={styles.sinMovimientos}>Sin movimientos en este período.</Text>
            </View>
          )
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
    deRegla: ReadonlySet<string>;
  },
): Detalle {
  const { delPeriodo, resumen, fijo, variable, desglose, deRegla } = datos;
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
      const lista = gastos.filter((m) => esGastoComprometido(m, deRegla));
      return {
        total: fijo,
        formula: 'Lo que llega igual: todo gasto que nació de una cuenta periódica, más '
          + 'los de vivienda, servicios, deudas, ahorros e impuestos que todavía no tienen regla.',
        movimientos: mayorPrimero(lista),
      };
    }
    case 'variable': {
      const lista = gastos.filter((m) => !esGastoComprometido(m, deRegla));
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
  { styles, theme, etiqueta, valor, variacion, mejorSiSube, color, onPress }:
  {
    styles: Estilos; theme: Theme; etiqueta: string; valor: string;
    variacion?: number | null; mejorSiSube?: boolean;
    /** Si viene, pinta la cifra. Solo el neto lo usa. */
    color?: string; onPress: () => void;
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
      <Text style={[styles.celdaValor, color !== undefined && { color }]} numberOfLines={1}>{valor}</Text>
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

/**
 * Una de las dos mitades del gasto.
 *
 * Sin punto de color: el color lo pone la barra de abajo, que ademas dice
 * cuanto. Un punto solo dice "este es de este color", que es la mitad del
 * trabajo por el mismo espacio.
 *
 * La de la derecha se alinea a la derecha para que las dos cifras queden en los
 * bordes y la barra corra entera entre medio.
 */
function Leyenda(
  { styles, titulo, monto, parte, alDerecho, onPress }:
  {
    styles: Estilos; titulo: string; monto: string; parte: number;
    alDerecho?: boolean; onPress: () => void;
  },
) {
  const porcentaje = `${Math.round(parte * 100)}%`;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.leyenda, alDerecho && styles.leyendaDerecha]}
      accessibilityRole="button"
      accessibilityLabel={`${titulo} ${monto}, ${porcentaje} del gasto. De dónde sale este número`}
    >
      <Text style={styles.leyendaTitulo}>{titulo}</Text>
      <Text style={styles.leyendaMonto}>{monto}</Text>
      <Text style={styles.leyendaParte}>{porcentaje}</Text>
    </Pressable>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingBottom: AIRE_PARA_EL_FLOTANTE,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },

    /**
     * El saldo, grande y liviano.
     *
     * 52px en peso 300 y en sans, no en monoespaciada: una cifra sola no
     * necesita alinearse con nada, y la mono a ese tamaño se ve como una salida
     * de consola. La etiqueta va en minuscula --"disponible", no
     * "SALDO DISPONIBLE"-- porque la versalita espaciada de 10px es el tic
     * tipografico que hacia parecer generada a la pantalla.
     */
    hero: { paddingTop: spacing.xl, paddingBottom: spacing.lg, alignItems: 'center' },
    heroFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
    heroSimbolo: {
      fontFamily: fonts.texto, fontWeight: pesos.ligero, fontSize: fontSizes.md,
      color: theme.silencio, marginTop: 10,
    },
    heroCifra: {
      fontFamily: fonts.texto, fontWeight: pesos.ligero, fontSize: 52, lineHeight: 58,
      color: theme.tinta, letterSpacing: -1.5,
    },
    heroPieFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: 2 },
    heroPie: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },

    /**
     * El hielo y el mar.
     *
     * El margen negativo saca la escena del padding del contenido para que la
     * linea de agua llegue a los dos bordes de la pantalla. Es la diferencia
     * entre un iceberg flotando y un iceberg dentro de una caja, y es el unico
     * gesto de la vista que sale de la metafora del proyecto en vez de una
     * libreria.
     */
    escena: { height: ALTO_HIELO, marginHorizontal: -spacing.lg, marginBottom: spacing.lg },
    hielo: { alignItems: 'center' },
    lineaDeAgua: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: charts[0] },

    /**
     * Las dos mitades del gasto, en los dos bordes.
     *
     * A 20px, mas grandes que el trio de abajo y mucho mas chicas que el saldo.
     * Esa escala --52 / 20 / 16-- es la que le faltaba a la banda: antes las
     * cinco cifras median casi lo mismo y se leian como una planilla pegada
     * debajo del dibujo.
     */
    reparto: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    leyenda: { flex: 1, gap: 2 },
    leyendaDerecha: { alignItems: 'flex-end' },
    leyendaTitulo: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    leyendaMonto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.lg, color: theme.tinta },
    leyendaParte: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 11, color: theme.silencio },

    /**
     * Las tres cifras del periodo, mas hondas que el reparto.
     *
     * El neto se pinta segun convenga y no segun el signo, igual que los delta:
     * es la unica de las tres que contesta "como me fue", y en una banda de
     * numeros todos del mismo color era imposible saber donde mirar.
     */
    trio: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xl,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      backgroundColor: theme.superficieHonda,
    },
    celda: { flex: 1, gap: 2, alignItems: 'center' },
    celdaEtiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencioHondo },
    celdaValor: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.md, color: theme.tinta },
    delta: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10 },
    deltaVacio: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },

    /**
     * Titulo de seccion sin regla.
     *
     * El patron `Titulo ───── ?` estaba en once secciones y es la firma mas
     * reconocible del panel generado. El aire de arriba separa igual, y de paso
     * se va una linea horizontal por seccion.
     */
    tituloFila: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      marginTop: spacing.xxl, marginBottom: spacing.sm, zIndex: 20,
    },
    titulo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.tinta },

    // Discreto a proposito: no compite con los movimientos que tiene encima.
    verTodos: { marginTop: spacing.md, alignItems: 'flex-end' },
    verTodosTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },
    vacio: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    sinMovimientos: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio, paddingVertical: spacing.md },
  });
}
