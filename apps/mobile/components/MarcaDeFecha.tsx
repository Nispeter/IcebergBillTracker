/** El bloque de fecha a la izquierda de una fila: el día grande y el mes debajo. */

import { dates } from '@iceberg/core';
import { StyleSheet, Text, View } from 'react-native';
import { useEstilos, type Estilo } from '../datos/estilos';

export function MarcaDeFecha({ fecha, vencida }: { fecha: dates.PlainDate; vencida?: boolean }) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={styles.marca}>
      <Text style={vencida ? styles.diaVencido : styles.dia}>{dates.day(fecha)}</Text>
      <Text style={styles.mes}>{dates.monthShortName(dates.month(fecha))}</Text>
    </View>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  const dia = { ...t.cifraGrande, fontWeight: t.accion.fontWeight };
  return StyleSheet.create({
    marca: { width: 30, alignItems: 'center' },
    dia,
    diaVencido: { ...dia, fontWeight: t.titulo.fontWeight, color: theme.vencidoTexto },
    mes: t.nota,
  });
}
