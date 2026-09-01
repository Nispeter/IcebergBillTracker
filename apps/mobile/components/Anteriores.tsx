/**
 * Cuando el periodo esta vacio, a donde si hay algo.
 *
 * Una pantalla en blanco no distingue dos situaciones opuestas: **no gastaste**
 * y **no estas mirando donde gastaste**. Desde que la app abre en el periodo
 * actual --y no en el ultimo con datos-- la segunda pasa todos los primeros de
 * mes: el dia 1 el resumen esta en cero, las categorias vacias y el calendario
 * apagado, y lo que uno queria ver estaba a una flecha de distancia.
 *
 * En vez de explicarlo con una frase, la pantalla ofrece el camino: los ultimos
 * periodos que si tienen movimientos, con cuanto hay en cada uno, y tocarlos
 * lleva ahi. Es la misma flecha de la barra de arriba, pero sabiendo de antemano
 * cual vale la pena.
 *
 * **Solo aparece si el periodo esta vacio.** Con un solo movimiento anotado ya
 * no hace falta: la pantalla se explica sola y esto seria una lista de destinos
 * compitiendo con el contenido.
 *
 * Tempanos no lo usa a proposito. Esa vista mira hacia adelante, y ahi lo util
 * cuando el periodo esta vacio es lo que **viene**, no lo que paso: tiene su
 * propia seccion de Proximos.
 */

import { dates, money } from '@iceberg/core';
import {
  elevation, fonts, pesos, radii, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMovimientos } from '../datos/consultas';
import { useLetra } from '../datos/letra';
import { nombreDePeriodo, usePeriodo } from '../datos/periodo';
import { Titulo } from './Titulo';

/** Cuantos periodos hacia atras se ofrecen. Tres entran sin hacer scroll. */
const CUANTOS = 3;

export function Anteriores({ theme }: { theme: Theme }) {
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);
  const periodo = usePeriodo();
  const movimientos = useMovimientos();
  const { start, end, kind } = periodo.rango;

  const hayEnElPeriodo = movimientos.some(
    (m) => dates.containsDate(periodo.rango, m.ocurridoEn as dates.PlainDate),
  );

  /**
   * Los periodos con datos, saltando los vacios.
   *
   * Se busca el movimiento **mas nuevo anterior al limite** y se pide el periodo
   * que lo contiene; ese periodo pasa a ser el limite siguiente. Asi tres meses
   * sin anotar nada no gastan las tres filas en tres pantallas vacias, que es
   * exactamente lo que uno no quiere que le ofrezcan.
   *
   * `useMovimientos` ya los devuelve del mas nuevo al mas viejo y ya respeta la
   * cuenta activa, asi que el primero que cae antes del limite es el que sirve.
   */
  const anteriores = useMemo(() => {
    const salida: { rango: dates.DateRange; cuantos: number; gasto: money.Money }[] = [];
    let limite = start;

    for (let i = 0; i < CUANTOS; i += 1) {
      const previo = movimientos.find((m) => (m.ocurridoEn as dates.PlainDate) < limite);
      if (previo === undefined) break;

      const rango = dates.periodContaining(periodo.rango, previo.ocurridoEn as dates.PlainDate);
      const dentro = movimientos.filter(
        (m) => dates.containsDate(rango, m.ocurridoEn as dates.PlainDate),
      );
      salida.push({
        rango,
        cuantos: dentro.length,
        gasto: money.sum(
          dentro.filter((m) => m.tipo === 'gasto').map((m) => money.money(m.montoMinor)),
        ),
      });
      limite = rango.start;
    }
    return salida;
    // `periodo.rango` es un objeto nuevo en cada render, asi que ponerlo de
    // dependencia recalcularia siempre. Lo que de verdad lo identifica son sus
    // tres campos, y estan los tres: `end` importa para el rango libre, donde
    // dos ventanas distintas pueden empezar el mismo dia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos, start, end, kind]);

  if (hayEnElPeriodo || anteriores.length === 0) return null;

  return (
    <View>
      <Titulo
        texto="Anteriores"
        theme={theme}
        ayuda={'Este período no tiene movimientos. Estos son los últimos que sí, y '
          + 'tocarlos te lleva ahí.\n\n'
          + 'Los períodos vacíos se saltan: si no anotaste nada en dos meses, no te '
          + 'ofrece esos dos meses.'}
      />
      {anteriores.map((anterior) => (
        <Pressable
          key={anterior.rango.start}
          onPress={() => periodo.irAlDia(anterior.rango.start)}
          style={styles.fila}
          accessibilityRole="button"
          accessibilityLabel={`Ir a ${nombreDePeriodo(periodo.tipo, anterior.rango)}`}
        >
          <View style={styles.texto}>
            <Text style={styles.nombre} numberOfLines={1}>
              {nombreDePeriodo(periodo.tipo, anterior.rango)}
            </Text>
            <Text style={styles.detalle}>
              {anterior.cuantos} {anterior.cuantos === 1 ? 'movimiento' : 'movimientos'}
              {anterior.gasto.amountMinor === 0 ? '' : ` · ${money.format(anterior.gasto)} de gasto`}
            </Text>
          </View>
          <CaretRight size={13} weight="bold" color={theme.acentoTexto} />
        </Pressable>
      ))}
    </View>
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    // Con linea abajo, al reves que el resto de las listas de la app: aca cada
    // fila es un destino y no un dato, y la linea dice donde termina el area
    // que se toca.
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      borderRadius: radii.sm,
    },
    texto: { flex: 1, gap: 2 },
    nombre: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.sm, color: theme.tinta },
    detalle: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.silencio },
  });
}
