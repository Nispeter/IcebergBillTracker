/**
 * Cuando el período está vacío, adónde sí hay algo.
 *
 * Una pantalla en blanco no distingue "no gastaste" de "no estás mirando donde
 * gastaste", y la segunda pasa todos los primeros de mes. En vez de explicarlo,
 * se ofrece el camino: los últimos períodos con movimientos, y tocarlos lleva
 * ahí. Con un solo movimiento en el período ya no aparece.
 *
 * Témpanos no lo usa: mira hacia adelante y tiene su sección de Próximos.
 */

import { dates, money } from '@iceberg/core';
import { spacing } from '@iceberg/ui';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Titulo } from './Titulo';
import { useMovimientos } from '../datos/consultas';
import { useEstilos, type Estilo } from '../datos/estilos';
import { nombreDePeriodo, usePeriodo } from '../datos/periodo';
import { useTema } from '../datos/tema';

/** Tres entran sin desplazar. */
const CUANTOS = 3;

export function Anteriores() {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  const periodo = usePeriodo();
  const movimientos = useMovimientos();
  const { start, end, kind } = periodo.rango;

  const hayEnElPeriodo = movimientos.some(
    (m) => dates.containsDate(periodo.rango, m.ocurridoEn as dates.PlainDate),
  );

  // Los períodos con datos, saltando los vacíos: se busca el movimiento más
  // nuevo antes del límite y se toma el período que lo contiene. `useMovimientos`
  // ya viene del más nuevo al más viejo y respeta la cuenta activa.
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
    // `periodo.rango` es un objeto nuevo en cada render: lo identifican sus tres campos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos, start, end, kind]);

  if (hayEnElPeriodo || anteriores.length === 0) return null;

  return (
    <View>
      <Titulo
        texto="Anteriores"
        ayuda={'Este período no tiene movimientos. Estos son los últimos que sí, y '
          + 'tocarlos te lleva ahí.\n\n'
          + 'Los períodos vacíos se saltan: si no anotaste nada en dos meses, no te '
          + 'ofrece esos dos meses.'}
      />
      {anteriores.map((anterior) => (
        <Pressable
          key={anterior.rango.start}
          onPress={() => periodo.irAlDia(anterior.rango.start)}
          style={({ pressed }) => [styles.fila, pressed && styles.apretada]}
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

function crearEstilos({ t }: Estilo) {
  return StyleSheet.create({
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    apretada: { opacity: 0.6 },
    texto: { flex: 1, gap: 2 },
    nombre: { ...t.cuerpo, fontWeight: t.accion.fontWeight },
    detalle: t.etiqueta,
  });
}
