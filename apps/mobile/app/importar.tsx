/**
 * Importar una cartola.
 *
 * El paso que importa es la **vista previa**: antes de escribir nada dice
 * cuántos movimientos entran, cuántos ya estaban, cuántos quedan sin categoría y
 * si el archivo cuadra contra el saldo del banco. Importar a ciegas doscientas
 * filas y descubrir después que era el archivo equivocado es exactamente lo que
 * esta pantalla evita.
 */

import { csv, dates, money } from '@iceberg/core';
import {
  importarLote, listarCuentas, previsualizarImportacion,
  type Previsualizacion,
} from '@iceberg/db';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MapeoDeColumnas } from '../components/MapeoDeColumnas';
import { useDatos } from '../datos/BaseDeDatos';
import { elegirCartola } from '../datos/archivo';
import { volver } from '../datos/navegacion';
import { useTema } from '../datos/tema';
import { PantallaModal } from '../components/PantallaModal';

interface Leido {
  readonly nombre: string;
  readonly cartola: csv.CartolaLeida;
  readonly previa: Previsualizacion;
}

/** El archivo elegido, guardado para poder releerlo con otro mapeo. */
interface Archivo {
  readonly nombre: string;
  readonly matriz: csv.Matriz;
}

export default function Importar() {
  const { theme } = useTema();
  const styles = crearEstilos(theme);
  const { db, contexto } = useDatos();
  const router = useRouter();

  const [leyendo, setLeyendo] = useState(false);
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [leido, setLeido] = useState<Leido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState(false);

  /**
   * Lee la matriz con el mapeo dado, o con el detectado si no viene ninguno.
   *
   * Se guarda la matriz entera para poder releerla: si la deteccion falla, la
   * alternativa seria pedir el archivo de nuevo.
   */
  function interpretar(elArchivo: Archivo, mapeo?: csv.MapeoDeColumnas) {
    const resultado = csv.parsearCartola(elArchivo.matriz, mapeo);
    if (!resultado.ok) {
      setError(resultado.motivo);
      setLeido(null);
      // Si no se pudo leer sola, se abre el mapeo a mano en vez de dejar al
      // usuario con un error y nada que hacer.
      setAjustando(true);
      return;
    }

    const cuenta = listarCuentas(db, contexto)[0];
    if (!cuenta) {
      setError('No hay ninguna cuenta creada todavía.');
      return;
    }

    setError(null);
    setAjustando(false);
    setLeido({
      nombre: elArchivo.nombre,
      cartola: resultado.cartola,
      previa: previsualizarImportacion(db, contexto, {
        cuentaId: cuenta.id,
        archivo: elArchivo.nombre,
        movimientos: resultado.cartola.movimientos,
      }),
    });
  }

  async function elegir() {
    setError(null);
    setLeyendo(true);
    try {
      const elegido = await elegirCartola();
      if (elegido === null) return;
      setArchivo(elegido);
      interpretar(elegido);
    } catch (e) {
      setError((e as Error).message);
      setLeido(null);
      setArchivo(null);
    } finally {
      setLeyendo(false);
    }
  }

  function importar() {
    if (leido === null) return;
    try {
      const cuenta = listarCuentas(db, contexto)[0];
      if (!cuenta) return;
      importarLote(db, contexto, {
        cuentaId: cuenta.id,
        archivo: leido.nombre,
        movimientos: leido.cartola.movimientos,
      });
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Importar cartola</Text>
          <Pressable onPress={() => volver(router)} accessibilityRole="button">
            <Text style={styles.cancelar}>Cancelar</Text>
          </Pressable>
        </View>

        <Text style={styles.ayuda}>
          El archivo .xls que descargas del banco. Nada se guarda hasta que confirmes.
        </Text>

        <Pressable
          onPress={elegir}
          disabled={leyendo}
          style={[styles.elegir, leyendo && styles.apagado]}
          accessibilityRole="button"
          accessibilityLabel="Elegir archivo"
        >
          {leyendo
            ? <ActivityIndicator color={theme.sobreAcento} />
            : <Text style={styles.elegirTexto}>{leido === null ? 'Elegir archivo' : 'Elegir otro'}</Text>}
        </Pressable>

        {error !== null ? <Text style={styles.error}>{error}</Text> : null}

        {ajustando && archivo !== null ? (
          <MapeoDeColumnas
            matriz={archivo.matriz}
            inicial={csv.detectarMapeo(archivo.matriz)}
            theme={theme}
            onAplicar={(mapeo) => interpretar(archivo, mapeo)}
            onCancelar={() => setAjustando(false)}
          />
        ) : null}

        {!ajustando && leido !== null ? (
          <Previa leido={leido} styles={styles} theme={theme} />
        ) : null}

        {!ajustando && archivo !== null ? (
          <Pressable
            onPress={() => setAjustando(true)}
            style={styles.ajustar}
            accessibilityRole="button"
            accessibilityLabel="Ajustar columnas a mano"
          >
            <Text style={styles.ajustarTexto}>
              ¿Las columnas no calzan? Ajustarlas a mano
            </Text>
          </Pressable>
        ) : null}

        {!ajustando && leido !== null && leido.previa.nuevos.length > 0 ? (
          <Pressable
            onPress={importar}
            style={styles.importar}
            accessibilityRole="button"
            accessibilityLabel="Confirmar importación"
          >
            <Text style={styles.importarTexto}>
              Importar {leido.previa.nuevos.length}{' '}
              {leido.previa.nuevos.length === 1 ? 'movimiento' : 'movimientos'}
            </Text>
          </Pressable>
        ) : null}

        {!ajustando && leido !== null && leido.previa.nuevos.length === 0 ? (
          <Text style={styles.ayuda}>
            Todos los movimientos de este archivo ya están importados. No hay nada que hacer.
          </Text>
        ) : null}
      </ScrollView>
    </PantallaModal>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

function Previa({ leido, styles, theme }: { leido: Leido; styles: Estilos; theme: Theme }) {
  const { cartola, previa } = leido;
  const sinCategoria = previa.nuevos.length - previa.categorizados;

  return (
    <View style={styles.tarjeta}>
      <Text style={styles.archivo} numberOfLines={1}>{leido.nombre}</Text>

      <Dato styles={styles} etiqueta="Movimientos nuevos" valor={String(previa.nuevos.length)} />
      {previa.duplicados > 0 ? (
        <Dato
          styles={styles}
          etiqueta="Ya importados"
          valor={String(previa.duplicados)}
          nota="Se saltan: reimportar el mismo archivo no duplica nada."
        />
      ) : null}
      {previa.desde !== null && previa.hasta !== null ? (
        <Dato
          styles={styles}
          etiqueta="Período"
          valor={`${dates.formatDate(previa.desde)} — ${dates.formatDate(previa.hasta)}`}
        />
      ) : null}
      <Dato
        styles={styles}
        etiqueta="Con categoría"
        valor={`${previa.categorizados} de ${previa.nuevos.length}`}
        nota={sinCategoria > 0
          ? `${sinCategoria} quedan sin categoría. Se pueden asignar después.`
          : undefined}
      />

      {/* La cuadratura es lo unico que avisa de un movimiento perdido al leer. */}
      {cartola.cuadra === true ? (
        <Text style={styles.cuadra}>
          Cuadra con el saldo del banco{cartola.saldoFinal === null ? '' : `: ${money.format(cartola.saldoFinal)}`}
        </Text>
      ) : cartola.cuadra === false ? (
        <Text style={styles.noCuadra}>
          La suma no cuadra con el saldo declarado en la cartola. Puede faltar algún
          movimiento; revisa antes de importar.
        </Text>
      ) : null}
    </View>
  );
}

function Dato(
  { styles, etiqueta, valor, nota }:
  { styles: Estilos; etiqueta: string; valor: string; nota?: string },
) {
  return (
    <View style={styles.dato}>
      <View style={styles.datoFila}>
        <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
        <Text style={styles.datoValor}>{valor}</Text>
      </View>
      {nota === undefined ? null : <Text style={styles.datoNota}>{nota}</Text>}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
      gap: spacing.lg,
    },
    encabezado: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.xxl,
    },
    titulo: { fontFamily: fonts.texto, fontWeight: pesos.bold, fontSize: fontSizes.xl, color: theme.tinta },
    cancelar: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.silencio },
    ayuda: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, lineHeight: 18, color: theme.silencio },

    elegir: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    apagado: { opacity: 0.5 },
    elegirTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.tinta },

    tarjeta: {
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    archivo: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.silencio, paddingBottom: spacing.xs },
    dato: { gap: 1 },
    datoFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    datoEtiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.tinta },
    datoValor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.tinta },
    datoNota: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    cuadra: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.ingresoTexto, paddingTop: spacing.xs },
    noCuadra: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, lineHeight: 18, color: theme.vencidoTexto, paddingTop: spacing.xs },

    importar: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
      borderRadius: radii.sm,
      backgroundColor: theme.acento,
    },
    importarTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.sobreAcento },
    error: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.sm, lineHeight: 20, color: theme.vencidoTexto },
    // Discreto: solo hace falta cuando la deteccion no acerto, que es raro.
    ajustar: { alignItems: 'center', paddingVertical: spacing.xs },
    ajustarTexto: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.acentoTexto },
  });
}
