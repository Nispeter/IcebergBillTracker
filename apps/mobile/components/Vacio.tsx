/** Lo que se ve cuando no hay nada: el pingüino durmiendo, qué falta y, si sirve, qué hacer. */

import { spacing } from '@iceberg/ui';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pinguino } from './Pinguino';
import { useEstilos, type Estilo } from '../datos/estilos';

export function Vacio({ texto, children }: { texto: string; children?: ReactNode }) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={styles.vacio}>
      <Pinguino tamano={40} estado="dormido" />
      <Text style={styles.texto}>{texto}</Text>
      {children}
    </View>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    vacio: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    texto: { ...t.cuerpo, color: theme.silencio, textAlign: 'center' },
  });
}
