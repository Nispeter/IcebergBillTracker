/**
 * Resumen: cómo voy en este período. El saldo, el iceberg y las cifras del
 * período; lo demás tiene su vista.
 *
 * El agua es la pantalla: el fondo se hace más hondo hacia abajo y la línea de
 * agua cruza de borde a borde, así el iceberg flota en vez de estar en una
 * caja. Cada cifra se toca y abre de dónde sale.
 */

import { money } from '@iceberg/core';
import type { Movimiento } from '@iceberg/db';
import { charts, columna, pesos, radii, spacing } from '@iceberg/ui';
import { Info } from 'phosphor-react-native/src/icons/Info';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Anteriores } from '../../components/Anteriores';
import { Boton } from '../../components/Boton';
import { DetalleDeCifra, type Detalle } from '../../components/DetalleDeCifra';
import { EXPLICACION_ANOMALIA, FilaMovimiento } from '../../components/FilaMovimiento';
import { Hoja } from '../../components/Hoja';
import {
  Iceberg, alturaDeLineaDeAgua, anchoDelIceberg, bordeDelHieloEn,
} from '../../components/Iceberg';
import { Pantalla } from '../../components/Pantalla';
import { Pinguino } from '../../components/Pinguino';
import { PinguinosDelIceberg } from '../../components/PinguinoDelIceberg';
import { Titulo } from '../../components/Titulo';
import { Vacio } from '../../components/Vacio';
import { useAvisar } from '../../datos/aviso';
import {
  esGastoComprometido, useAnalisisDeRango, useAnomalias, useComprometidas, useDesgloseDelSaldo,
  useMovimientosDeRegla, useMovimientosFiltrados, usePinguinos, useSaldoInicial,
  type DesgloseDelSaldo,
} from '../../datos/consultas';
import { useAireInferior } from '../../datos/desplazamiento';
import { useEstilo, useEstilos, type Estilo } from '../../datos/estilos';
import { nombreDePeriodo, usePeriodo } from '../../datos/periodo';
import { useAncla, useDesplazadorDelTutorial } from '../../datos/tutorial';

/** El alto del hielo: la pieza más grande de la pantalla. */
const ALTO_HIELO = 240;

/** Cinco toques al iceberg traen la colonia: tres se alcanzan sin querer. */
const TOQUES_PARA_LA_COLONIA = 5;

/** Dónde se para cada pingüino de la colonia, en unidades del dibujo. */
const LA_COLONIA = [72, 96, 120, 144];
const ALTO_DEL_PINGUINO = 18;
const TAMANO_DEL_PINGUINO = 16;

/** Lo que ocupa un porcentaje escrito, a lo alto y a lo ancho ("100%"). */
const ALTO_ETIQUETA = 30;
const ANCHO_ETIQUETA = 42;

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

export default function Resumen() {
  const styles = useEstilos(crearEstilos);
  const { theme } = useEstilo();
  const aireInferior = useAireInferior();
  const { tipo, rango, corte } = usePeriodo();

  const desglose = useDesgloseDelSaldo(useSaldoInicial());
  const a = useAnalisisDeRango(rango, corte);
  // Del período y sin límite: la hoja de detalle necesita todos, no los cuatro de la lista.
  const delPeriodo = useMovimientosFiltrados(
    useMemo(() => ({ desde: rango.start, hasta: rango.end }), [rango.start, rango.end]),
  );
  const recientes = delPeriodo.slice(0, 4);

  const anomalias = useAnomalias();
  const deRegla = useMovimientosDeRegla(rango);
  const comprometidas = useComprometidas();
  const cuantosPinguinos = usePinguinos();
  const avisar = useAvisar();
  const [cifra, setCifra] = useState<Cifra | null>(null);
  // Vive en la pantalla: es un guiño, no una preferencia, y se va al salir.
  const [toques, setToques] = useState(0);
  const hayColonia = toques >= TOQUES_PARA_LA_COLONIA;

  // Las anclas del tutorial son solo `ref`s: la pantalla no sabe si hay uno corriendo.
  const ancla = useAncla();
  const scroll = useRef<ScrollView>(null);
  // En un `ref` y no en estado: cambia en cada fotograma del desplazamiento.
  const desplazamiento = useRef(0);
  useDesplazadorDelTutorial(useCallback((dy: number) => {
    const destino = Math.max(0, desplazamiento.current + dy);
    // Se anota antes de pedirlo: `onScroll` llega tarde, y el paso siguiente
    // calcularía sobre la posición vieja. Sin animar, para que la medición
    // siguiente no caiga a mitad de camino.
    desplazamiento.current = destino;
    scroll.current?.scrollTo({ y: destino, animated: false });
  }, []));

  const variable = money.subtract(a.resumen.gasto, a.fijo);
  const share = money.ratio(a.fijo, a.resumen.gasto) ?? 0;
  const yLinea = alturaDeLineaDeAgua(share, ALTO_HIELO);
  // Sin gastos no hay reparto que mostrar: 0 % y 100 % de cero no significan nada.
  const hayGasto = !money.isZero(a.resumen.gasto);

  // Cada porcentaje al centro de su franja, que es la parte más ancha; si no
  // entra en el hielo a esa altura, se escribe al lado del pico.
  const arribaIdeal = hayGasto && yLinea >= ALTO_ETIQUETA ? yLinea / 2 - ALTO_ETIQUETA / 2 : null;
  const cabeArriba = arribaIdeal !== null
    && bordeDelHieloEn(arribaIdeal + ALTO_ETIQUETA / 2, ALTO_HIELO) * 2 >= ANCHO_ETIQUETA;
  const abajo = hayGasto && ALTO_HIELO - yLinea >= ALTO_ETIQUETA
    ? yLinea + (ALTO_HIELO - yLinea) / 2 - ALTO_ETIQUETA / 2
    : null;

  const detalle = cifra === null ? null : detalleDe(cifra, {
    delPeriodo, resumen: a.resumen, fijo: a.fijo, variable, desglose, deRegla, comprometidas,
  });

  return (
    <Pantalla titulo="Resumen">
      <ScrollView
        ref={scroll}
        onScroll={(evento) => { desplazamiento.current = evento.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={32}
        contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}
      >
        <Pressable
          ref={ancla('saldo')}
          collapsable={false}
          onPress={() => setCifra('saldo')}
          style={styles.saldo}
          accessibilityRole="button"
          accessibilityLabel={`Saldo disponible ${money.format(desglose.saldo)}. De dónde sale este número`}
        >
          <View style={styles.saldoFila}>
            <Text style={styles.saldoSimbolo}>$</Text>
            <Text style={styles.saldoCifra}>{money.formatNumber(desglose.saldo)}</Text>
          </View>
          {/* La `i` enseña el gesto para toda la pantalla: acá los números se tocan. */}
          <View style={styles.saldoPie}>
            <Text style={styles.etiqueta}>disponible</Text>
            <Info size={12} weight="regular" color={theme.silencio} />
          </View>
        </Pressable>

        <View ref={ancla('ayuda')} collapsable={false}>
          <Titulo
            texto="Comprometido y variable"
            ayuda={'Comprometido llega igual: arriendo, cuentas, cuotas, impuestos. '
              + 'Variable es lo que decides tú, y es sobre lo único que puedes actuar.\n\n'
              + 'El hielo sobre la línea de agua es lo comprometido; lo de abajo, lo '
              + 'variable.'}
          />
        </View>

        {/* Lo anclado lleva `collapsable={false}`: Android no mide vistas colapsadas. */}
        <View ref={ancla('iceberg')} collapsable={false} style={styles.escena}>
          <Pressable
            style={styles.hielo}
            onPress={() => {
              if (hayColonia) return;
              const van = toques + 1;
              setToques(van);
              if (van >= TOQUES_PARA_LA_COLONIA) avisar('Llegó la colonia');
            }}
            accessibilityRole="button"
            accessibilityLabel="El iceberg"
          >
            <Iceberg shareComprometido={share} alto={ALTO_HIELO} />
          </Pressable>

          {hayColonia && hayGasto ? LA_COLONIA.map((enElDibujo) => (
            <View
              key={enElDibujo}
              pointerEvents="none"
              style={[styles.enLaOrilla, {
                top: yLinea - ALTO_DEL_PINGUINO,
                // Desde el centro de la escena, donde está anclado el iceberg.
                marginLeft: ((enElDibujo - 100) / 200) * anchoDelIceberg(ALTO_HIELO)
                  - TAMANO_DEL_PINGUINO / 2,
              }]}
            >
              <Pinguino tamano={TAMANO_DEL_PINGUINO} estado="contento" />
            </View>
          )) : null}

          {hayGasto ? (
            <PinguinosDelIceberg
              variable={1 - share}
              yLinea={yLinea}
              bordeDelHielo={bordeDelHieloEn(yLinea, ALTO_HIELO)}
              cuantos={cuantosPinguinos}
            />
          ) : null}

          {/* La línea de agua es el nivel del mar, no el borde de una figura:
              cruza la pantalla entera. Sin gastos no hay nivel que marcar. */}
          {hayGasto ? <View style={[styles.lineaDeAgua, { top: yLinea }]} /> : null}

          {/* Los porcentajes sobre la parte que miden, para no cruzar la vista. */}
          {arribaIdeal === null ? null : cabeArriba ? (
            <Text style={[styles.parteEnElHielo, { top: arribaIdeal }]}>{Math.round(share * 100)}%</Text>
          ) : (
            <Text
              style={[styles.parteFueraDelHielo, {
                top: arribaIdeal,
                marginLeft: bordeDelHieloEn(arribaIdeal + ALTO_ETIQUETA / 2, ALTO_HIELO) + 6,
              }]}
            >
              {Math.round(share * 100)}%
            </Text>
          )}
          {abajo === null ? null : (
            <Text style={[styles.parteEnElHielo, { top: abajo }]}>{Math.round((1 - share) * 100)}%</Text>
          )}
        </View>

        <View style={styles.reparto}>
          <Mitad
            titulo="comprometido"
            monto={money.format(a.fijo)}
            parte={share}
            onPress={() => setCifra('comprometido')}
          />
          <Mitad
            titulo="variable"
            monto={money.format(variable)}
            parte={1 - share}
            alDerecho
            onPress={() => setCifra('variable')}
          />
        </View>

        <Titulo
          texto="Entradas y salidas"
          ayuda={'Lo que entró y lo que salió en el período, y la diferencia entre los '
            + 'dos. El porcentaje compara contra el período anterior del mismo largo.'}
        />
        {/* Hundido y no elevado: ver `superficieHonda`. */}
        <View style={styles.trio}>
          <Celda
            etiqueta="ingreso"
            valor={money.format(a.resumen.ingreso)}
            variacion={a.comparacion.ingreso.variacion}
            mejorSiSube
            onPress={() => setCifra('ingreso')}
          />
          <Celda
            etiqueta="gasto"
            valor={money.format(a.resumen.gasto)}
            variacion={a.comparacion.gasto.variacion}
            onPress={() => setCifra('gasto')}
          />
          {/* El neto se pinta según convenga: es la única que contesta "cómo me fue". */}
          <Celda
            etiqueta="neto"
            valor={money.formatSigned(a.resumen.neto)}
            color={money.isNegative(a.resumen.neto) ? theme.vencidoTexto : theme.ingresoTexto}
            onPress={() => setCifra('neto')}
          />
        </View>

        <View ref={ancla('lista')} collapsable={false}>
          <Titulo texto="Últimos movimientos" ayuda={EXPLICACION_ANOMALIA} />
          {recientes.length === 0
            ? <Vacio texto="Sin movimientos en este período." />
            : recientes.map((tx) => (
              <FilaMovimiento key={tx.id} tx={tx} anomala={anomalias.has(tx.id)} />
            ))}
        </View>

        {recientes.length === 0 ? null : (
          <Boton variante="texto" etiqueta="Ver todos" href="/movimientos" estilo={styles.verTodos} />
        )}

        <Anteriores />
      </ScrollView>

      <Hoja
        abierta={detalle !== null}
        titulo={cifra === null ? '' : tituloDe(cifra, nombreDePeriodo(tipo, rango))}
        onCerrar={() => setCifra(null)}
      >
        {detalle === null ? null : <DetalleDeCifra detalle={detalle} />}
      </Hoja>
    </Pantalla>
  );
}

/** El saldo sale de todo el historial, no del período: su título no lleva período. */
function tituloDe(cifra: Cifra, periodo: string): string {
  return cifra === 'saldo' ? TITULOS[cifra] : `${TITULOS[cifra]} · ${periodo}`;
}

/**
 * De dónde sale cada cifra. Los montos llegan hechos, los mismos que pinta la
 * pantalla: recalcularlos acá es la forma más fácil de que la hoja diga una
 * cosa y la cifra otra. Los movimientos van de mayor a menor.
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
    comprometidas: ReadonlySet<string>;
  },
): Detalle {
  const { delPeriodo, resumen, fijo, variable, desglose, deRegla, comprometidas } = datos;
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
    case 'comprometido':
      return {
        total: fijo,
        formula: 'Lo que llega igual: todo gasto que nació de una cuenta periódica, más '
          + 'los de vivienda, servicios, deudas, ahorros e impuestos que todavía no tienen regla.',
        movimientos: mayorPrimero(gastos.filter((m) => esGastoComprometido(m, deRegla, comprometidas))),
      };
    case 'variable':
      return {
        total: variable,
        formula: 'Todo el gasto que no es un compromiso fijo: lo que decides tú, uno por uno.',
        movimientos: mayorPrimero(gastos.filter((m) => !esGastoComprometido(m, deRegla, comprometidas))),
      };
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
  { etiqueta, valor, variacion, mejorSiSube, color, onPress }: {
    etiqueta: string;
    valor: string;
    variacion?: number | null;
    mejorSiSube?: boolean;
    /** Si viene, pinta la cifra. */
    color?: string;
    onPress: () => void;
  },
) {
  const styles = useEstilos(crearEstilos);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.celda, pressed && styles.apretada]}
      accessibilityRole="button"
      accessibilityLabel={`${etiqueta} ${valor}. De dónde sale este número`}
    >
      <Text style={styles.celdaEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.celdaValor, color !== undefined && { color }]} numberOfLines={1}>{valor}</Text>
      <Delta variacion={variacion ?? null} mejorSiSube={mejorSiSube} />
    </Pressable>
  );
}

/**
 * El cambio contra el período anterior. El color sale de si conviene, no del
 * signo: que el gasto suba es malo y que el ingreso suba es bueno.
 */
function Delta({ variacion, mejorSiSube }: { variacion: number | null; mejorSiSube?: boolean }) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useEstilo();
  if (variacion === null) return <Text style={styles.delta}>—</Text>;
  const subio = variacion > 0;
  const conviene = mejorSiSube ? subio : !subio;
  const color = Math.abs(variacion) < 0.005
    ? theme.silencio
    : conviene ? theme.ingresoTexto : theme.vencidoTexto;
  return <Text style={[styles.delta, { color }]}>{subio ? '+' : '−'}{Math.abs(variacion * 100).toFixed(0)}%</Text>;
}

/** Una de las dos mitades del gasto, en los dos bordes de la pantalla. */
function Mitad(
  { titulo, monto, parte, alDerecho, onPress }: {
    titulo: string;
    monto: string;
    parte: number;
    alDerecho?: boolean;
    onPress: () => void;
  },
) {
  const styles = useEstilos(crearEstilos);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.mitad, alDerecho && styles.mitadDerecha, pressed && styles.apretada]}
      accessibilityRole="button"
      accessibilityLabel={`${titulo} ${monto}, ${Math.round(parte * 100)}% del gasto. De dónde sale este número`}
    >
      <Text style={styles.etiqueta}>{titulo}</Text>
      <Text style={styles.mitadMonto}>{monto}</Text>
    </Pressable>
  );
}

function crearEstilos({ theme, t, letra }: Estilo) {
  return StyleSheet.create({
    contenido: columna,
    apretada: { opacity: 0.6 },
    etiqueta: t.etiqueta,

    // El saldo, grande y liviano, en sans: una cifra sola no necesita alinearse,
    // y la mono a ese tamaño parece una consola.
    saldo: { paddingTop: spacing.xl, paddingBottom: spacing.lg, alignItems: 'center' },
    saldoFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
    saldoSimbolo: { ...t.cuerpo, fontSize: letra.md, fontWeight: pesos.ligero, color: theme.silencio, marginTop: 10 },
    saldoCifra: {
      ...t.cuerpo,
      fontSize: letra.px(52),
      lineHeight: letra.px(58),
      fontWeight: pesos.ligero,
      letterSpacing: -1.5,
    },
    saldoPie: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: 2 },

    // El margen negativo saca la escena del relleno del contenido, para que la
    // línea de agua llegue a los dos bordes de la pantalla.
    escena: { height: ALTO_HIELO, marginHorizontal: -spacing.lg, marginBottom: spacing.lg },
    hielo: { alignItems: 'center' },
    lineaDeAgua: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: charts[0] },
    // Anclado al centro de la escena; `marginLeft` lo corre hasta su lugar.
    enLaOrilla: { position: 'absolute', left: '50%' },
    // La tinta profunda se lee sobre el hielo y sobre el agua.
    parteEnElHielo: {
      ...t.cifra,
      fontSize: t.cuerpo.fontSize,
      fontWeight: t.accion.fontWeight,
      color: theme.sobreElHielo,
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
    },
    // Fuera del hielo el fondo es el agua de la pantalla: la tinta es la de la pantalla.
    parteFueraDelHielo: {
      ...t.cifra,
      fontSize: t.cuerpo.fontSize,
      fontWeight: t.accion.fontWeight,
      color: theme.silencio,
      position: 'absolute',
      left: '50%',
    },

    // Tres tamaños con roles distintos: el saldo, las dos mitades y el trío.
    reparto: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    mitad: { flex: 1, gap: 2 },
    mitadDerecha: { alignItems: 'flex-end' },
    mitadMonto: { ...t.cifra, fontSize: letra.lg },

    trio: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      backgroundColor: theme.superficieHonda,
    },
    celda: { flex: 1, gap: 2, alignItems: 'center' },
    celdaEtiqueta: { ...t.etiqueta, color: theme.silencioHondo },
    celdaValor: t.cifraGrande,
    delta: { ...t.cifraDeGrafico, color: theme.silencioHondo },

    verTodos: { alignSelf: 'flex-end', marginTop: spacing.sm },
  });
}
