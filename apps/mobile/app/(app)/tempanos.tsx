/**
 * Témpanos: lo que viene, flotando hacia uno.
 *
 * Cada fila es **una ocurrencia**, no una regla: "el arriendo del 5 de
 * septiembre", no "el arriendo". Eso permite marcar una y dejar las otras
 * quietas, que es lo que pasa en la vida real cuando un mes se paga distinto o
 * no se paga.
 *
 * Lo vencido y sin resolver va arriba y en rojo. No es alarmismo: es la unica
 * informacion de la pantalla sobre la que hay que hacer algo hoy.
 */

import { categories, money } from '@iceberg/core';
import { desmarcar, marcarOmitida, marcarPagada, type Tempano } from '@iceberg/db';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { Link } from 'expo-router';
import { ArrowCounterClockwise } from 'phosphor-react-native/src/icons/ArrowCounterClockwise';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { X } from 'phosphor-react-native/src/icons/X';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ayuda } from '../../components/Ayuda';
import { Pantalla } from '../../components/Pantalla';
import { iconoDeCategoria } from '../../components/iconos';
import { useDatos } from '../../datos/BaseDeDatos';
import { useTempanos } from '../../datos/consultas';
import { usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export default function Tempanos() {
  const { theme } = useTema();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const { rango, corte } = usePeriodo();
  const { db, contexto } = useDatos();

  const tempanos = useTempanos(rango, corte);

  const pendientes = tempanos.filter((t) => t.estado === 'pendiente');
  const vencidos = pendientes.filter((t) => t.diasRestantes < 0);
  const porPagar = money.money(
    pendientes.filter((t) => t.regla.tipo === 'gasto').reduce((s, t) => s + t.montoMinor, 0),
    'CLP',
  );

  return (
    <Pantalla>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.cabecera}>
          <View style={styles.total}>
            <Text style={styles.totalEtiqueta}>POR PAGAR</Text>
            <Text style={styles.totalCifra}>{money.format(porPagar)}</Text>
          </View>
          <Ayuda
            theme={theme}
            texto={'Cada fila es una fecha concreta, no la cuenta entera. Marcar pagada crea '
              + 'el movimiento; omitir no crea nada. Las dos se pueden deshacer.'}
          />
        </View>

        {vencidos.length > 0 ? (
          <Text style={styles.aviso}>
            {vencidos.length === 1 ? '1 cuenta vencida' : `${vencidos.length} cuentas vencidas`}
            {' sin resolver.'}
          </Text>
        ) : null}

        {tempanos.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTexto}>
              No hay cuentas periódicas en este período.
            </Text>
            <Link href="/regla/nueva" asChild>
              <Pressable style={styles.crear} accessibilityRole="button">
                <Text style={styles.crearTexto}>Crear una cuenta periódica</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          tempanos.map((tempano) => (
            <Fila
              key={`${tempano.regla.id}|${tempano.ocurreEn}`}
              tempano={tempano}
              styles={styles}
              theme={theme}
              onPagar={() => marcarPagada(db, contexto, tempano.regla.id, tempano.ocurreEn)}
              onOmitir={() => marcarOmitida(db, contexto, tempano.regla.id, tempano.ocurreEn)}
              onDeshacer={() => desmarcar(db, contexto, tempano.regla.id, tempano.ocurreEn)}
            />
          ))
        )}

        {tempanos.length > 0 ? (
          <Link href="/regla/nueva" asChild>
            <Pressable style={styles.agregar} accessibilityRole="button">
              <Text style={styles.agregarTexto}>Nueva cuenta periódica</Text>
            </Pressable>
          </Link>
        ) : null}
      </ScrollView>
    </Pantalla>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

/** Cuando falta poco o ya se paso, el numero de dias no dice nada por si solo. */
function cuando(diasRestantes: number): string {
  if (diasRestantes === 0) return 'hoy';
  if (diasRestantes === 1) return 'mañana';
  if (diasRestantes === -1) return 'ayer';
  if (diasRestantes < 0) return `hace ${Math.abs(diasRestantes)} días`;
  return `en ${diasRestantes} días`;
}

function Fila(
  { tempano, styles, theme, onPagar, onOmitir, onDeshacer }: {
    tempano: Tempano;
    styles: Estilos;
    theme: Theme;
    onPagar: () => void;
    onOmitir: () => void;
    onDeshacer: () => void;
  },
) {
  const { regla, estado, diasRestantes } = tempano;
  const Icono = regla.categoriaId ? iconoDeCategoria(regla.categoriaId) : null;
  const vencido = estado === 'pendiente' && diasRestantes < 0;
  const resuelto = estado !== 'pendiente';
  const dia = Number(tempano.ocurreEn.slice(8, 10));
  const mes = MESES[Number(tempano.ocurreEn.slice(5, 7)) - 1];

  return (
    <View style={[styles.fila, resuelto && styles.filaResuelta]}>
      <View style={styles.marcaFecha}>
        <Text style={vencido ? styles.diaVencido : styles.dia}>{dia}</Text>
        <Text style={styles.mes}>{mes}</Text>
      </View>

      <View style={styles.texto}>
        <Link href={{ pathname: '/regla/[id]', params: { id: regla.id } }} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${regla.nombre}`}>
            <Text style={styles.nombre} numberOfLines={1}>{regla.nombre}</Text>
          </Pressable>
        </Link>
        <View style={styles.meta}>
          {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
          <Text style={vencido ? styles.subtituloVencido : styles.subtitulo}>
            {estado === 'pagada' ? 'Pagada'
              : estado === 'omitida' ? 'Omitida'
                : cuando(diasRestantes)}
            {regla.categoriaId ? ` · ${categories.categoryShortName(regla.categoriaId)}` : ''}
          </Text>
        </View>
      </View>

      <Text style={resuelto ? styles.montoResuelto : styles.monto}>
        {money.format(money.money(tempano.montoMinor))}
      </Text>

      {resuelto ? (
        <Pressable
          onPress={onDeshacer}
          style={styles.accion}
          accessibilityRole="button"
          accessibilityLabel={`Deshacer ${regla.nombre}`}
          hitSlop={8}
        >
          <ArrowCounterClockwise size={14} weight="bold" color={theme.silencio} />
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={onOmitir}
            style={styles.accion}
            accessibilityRole="button"
            accessibilityLabel={`Omitir ${regla.nombre}`}
            hitSlop={8}
          >
            <X size={13} weight="bold" color={theme.silencio} />
          </Pressable>
          <Pressable
            onPress={onPagar}
            style={styles.accionPagar}
            accessibilityRole="button"
            accessibilityLabel={`Marcar pagada ${regla.nombre}`}
            hitSlop={8}
          >
            <Check size={13} weight="bold" color={theme.sobreAcento} />
          </Pressable>
        </>
      )}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  const boton = {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    cabecera: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      zIndex: 20,
    },
    total: { gap: 1 },
    totalEtiqueta: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, textTransform: 'uppercase', letterSpacing: 0.8 },
    totalCifra: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: 28, color: theme.tinta, letterSpacing: -0.5 },
    aviso: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.vencidoTexto, paddingBottom: spacing.sm },

    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    // Lo resuelto sigue a la vista pero deja de pedir atencion.
    filaResuelta: { opacity: 0.45 },
    marcaFecha: { width: 30, alignItems: 'center' },
    dia: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.tinta },
    diaVencido: { fontFamily: fonts.mono, fontWeight: pesos.bold, fontSize: fontSizes.md, color: theme.vencidoTexto },
    mes: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, textTransform: 'uppercase' },
    texto: { flex: 1, gap: 2 },
    nombre: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.tinta },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    subtitulo: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    subtituloVencido: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    monto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.tinta },
    montoResuelto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.silencio, textDecorationLine: 'line-through' },

    accion: { ...boton, borderWidth: elevation.hairlineWidth, borderColor: theme.hairline },
    accionPagar: { ...boton, backgroundColor: theme.acento },

    vacio: { paddingVertical: spacing.xxl, gap: spacing.lg, alignItems: 'flex-start' },
    vacioTexto: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.silencio },
    crear: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radii.sm, backgroundColor: theme.acento },
    crearTexto: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.sobreAcento },
    agregar: { marginTop: spacing.lg, alignItems: 'flex-end' },
    agregarTexto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: 10, color: theme.acentoTexto },
  });
}
