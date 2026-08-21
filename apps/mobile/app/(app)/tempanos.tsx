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

import { categories, money, recurrence } from '@iceberg/core';
import {
  crearRegla, desmarcar, listarCuentas, marcarOmitida, marcarPagada, type Tempano,
} from '@iceberg/db';
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
import { Titulo } from '../../components/Titulo';
import { useAireInferior, useDesplazamiento } from '../../datos/desplazamiento';
import { Pinguino } from '../../components/Pinguino';
import { iconoDeCategoria } from '../../components/iconos';
import { useDatos } from '../../datos/BaseDeDatos';
import { useCandidatasARegla, useTempanos } from '../../datos/consultas';
import { usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export default function Tempanos() {
  const { theme } = useTema();
  const desplazamiento = useDesplazamiento();
  const aireInferior = useAireInferior();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const { rango, corte } = usePeriodo();
  const { db, contexto } = useDatos();

  const tempanos = useTempanos(rango, corte);
  // Encontradas en el historial: es lo que evita tener que cargar a mano el
  // arriendo, la luz y el agua antes de que la pantalla sirva para algo.
  const candidatas = useCandidatasARegla(corte);

  const pendientes = tempanos.filter((t) => t.estado === 'pendiente');
  const vencidos = pendientes.filter((t) => t.diasRestantes < 0);
  const porPagar = money.money(
    pendientes.filter((t) => t.regla.tipo === 'gasto').reduce((s, t) => s + t.montoMinor, 0),
    'CLP',
  );

  return (
    <Pantalla permitirFuturo>
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}
        {...desplazamiento}
      >
        <View style={styles.cabecera}>
          <View style={styles.total}>
            <Text style={styles.totalEtiqueta}>por pagar</Text>
            <Text style={styles.totalCifra}>{money.format(porPagar)}</Text>
          </View>
          <Ayuda
            titulo="Por pagar"
            theme={theme}
            texto={'Cada fila es una fecha concreta, no la cuenta entera. Marcar pagada crea '
              + 'el movimiento; omitir no crea nada. Las dos se pueden deshacer.'}
          />
        </View>

        {vencidos.length > 0 ? (
          <View style={styles.filaAviso}>
            <Pinguino theme={theme} tamano={22} estado="alerta" />
            <Text style={styles.aviso}>
            {vencidos.length === 1 ? '1 cuenta vencida' : `${vencidos.length} cuentas vencidas`}
              {' sin resolver.'}
            </Text>
          </View>
        ) : null}

        {tempanos.length === 0 ? (
          <View style={styles.vacio}>
            <Pinguino theme={theme} tamano={40} estado="dormido" />
            <Text style={styles.vacioTexto}>
              No hay cuentas periódicas en este período.
            </Text>
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

        {candidatas.length > 0 ? (
          <>
            <Titulo
              texto="Encontradas en tu historial"
              theme={theme}
              ayuda={'Movimientos que se repiten con la misma frecuencia y un monto '
                + 'parecido. Son una propuesta: nada se crea hasta que la confirmes.'}
            />

            {candidatas.map((candidata) => (
              <Sugerencia
                key={candidata.nombre}
                candidata={candidata}
                styles={styles}
                theme={theme}
                onCrear={() => {
                  const cuenta = listarCuentas(db, contexto)[0];
                  if (!cuenta) return;
                  crearRegla(db, contexto, {
                    cuentaId: cuenta.id,
                    tipo: 'gasto',
                    montoMinor: candidata.montoMinor,
                    nombre: candidata.nombre,
                    categoriaId: candidata.categoriaId,
                    frecuencia: candidata.frecuencia,
                    cada: candidata.cada,
                    desde: candidata.desde,
                  });
                }}
              />
            ))}
          </>
        ) : null}

        <Link href="/regla/nueva" asChild>
          <Pressable style={styles.agregar} accessibilityRole="button">
            <Text style={styles.agregarTexto}>Nueva cuenta periódica</Text>
          </Pressable>
        </Link>
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

function Sugerencia(
  { candidata, styles, theme, onCrear }: {
    candidata: recurrence.Candidata;
    styles: Estilos;
    theme: Theme;
    onCrear: () => void;
  },
) {
  const Icono = candidata.categoriaId ? iconoDeCategoria(candidata.categoriaId) : null;

  return (
    <View style={styles.fila}>
      <View style={styles.texto}>
        <Text style={styles.nombre} numberOfLines={1}>{candidata.nombre}</Text>
        <View style={styles.meta}>
          {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
          <Text style={styles.subtitulo}>
            {recurrence.describirRegla({
              frecuencia: candidata.frecuencia,
              cada: candidata.cada,
              desde: candidata.desde,
              hasta: null,
            })}
            {` · ${candidata.veces} veces`}
          </Text>
        </View>
      </View>

      <Text style={styles.monto}>{money.format(money.money(candidata.montoMinor))}</Text>

      <Pressable
        onPress={onCrear}
        style={styles.crearChico}
        accessibilityRole="button"
        accessibilityLabel={`Crear cuenta periódica ${candidata.nombre}`}
      >
        <Text style={styles.crearChicoTexto}>Crear</Text>
      </Pressable>
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
    totalEtiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    totalCifra: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: 28, color: theme.tinta, letterSpacing: -0.5 },
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.vencidoTexto, paddingBottom: spacing.sm },

    // Sin subrayado, igual que en la lista de movimientos: la fecha a la
    // izquierda y los dos renglones de cada fila ya la separan de la siguiente.
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    // Lo resuelto sigue a la vista pero deja de pedir atencion.
    filaResuelta: { opacity: 0.45 },
    marcaFecha: { width: 30, alignItems: 'center' },
    dia: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.tinta },
    diaVencido: { fontFamily: fonts.mono, fontWeight: pesos.bold, fontSize: fontSizes.md, color: theme.vencidoTexto },
    mes: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    texto: { flex: 1, gap: 2 },
    nombre: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.tinta },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    subtitulo: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    subtituloVencido: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    monto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.tinta },
    montoResuelto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.silencio, textDecorationLine: 'line-through' },

    accion: { ...boton, borderWidth: elevation.hairlineWidth, borderColor: theme.hairline },
    accionPagar: { ...boton, backgroundColor: theme.acento },

    vacio: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    filaAviso: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
    vacioTexto: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.silencio, paddingVertical: spacing.lg },

    regla: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xs, zIndex: 20 },
    reglaTitulo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    reglaLinea: { flex: 1, height: elevation.hairlineWidth, backgroundColor: theme.hairline },
    crearChico: {
      paddingVertical: 5,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      backgroundColor: theme.acento,
    },
    crearChicoTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.sobreAcento },
    agregar: { marginTop: spacing.lg, alignItems: 'flex-end' },
    agregarTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: 10, color: theme.acentoTexto },
  });
}
