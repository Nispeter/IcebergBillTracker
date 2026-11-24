/**
 * El aviso de que una pasada está trayendo o dejando datos en la carpeta.
 *
 * Solo se ve si lo que se está mirando se comparte: una cuenta local no cambia
 * por sincronizar, y avisarle a quien la mira sería ruido.
 */

import { spacing } from '@iceberg/ui';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useCuentas } from '../datos/consultas';
import { useCuentaActiva } from '../datos/cuenta';
import { useEstilo, useEstilos, type Estilo } from '../datos/estilos';
import { useSincronizando } from '../datos/sincronizar';

export function Sincronizando() {
  const styles = useEstilos(crearEstilos);
  const { theme } = useEstilo();
  const enCurso = useSincronizando();
  const { cuentaId } = useCuentaActiva();
  const cuentas = useCuentas();

  const loMiradoSeComparte = cuentaId === null
    ? cuentas.some((cuenta) => cuenta.sincroniza === 1)
    : cuentas.find((cuenta) => cuenta.id === cuentaId)?.sincroniza === 1;
  if (!enCurso || !loMiradoSeComparte) return null;

  return (
    <View style={styles.fila} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={theme.silencio} />
      <Text style={styles.texto}>Sincronizando</Text>
    </View>
  );
}

function crearEstilos({ t }: Estilo) {
  return StyleSheet.create({
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: 'auto' },
    texto: t.nota,
  });
}
