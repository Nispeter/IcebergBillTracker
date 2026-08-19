/** Alta manual de un movimiento. */

import { listarCuentas, crearMovimiento } from '@iceberg/db';
import { themes, type ThemeName } from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { FormularioMovimiento, type ValoresDelFormulario } from '../components/FormularioMovimiento';
import { useDatos } from '../datos/BaseDeDatos';

export default function NuevoMovimiento() {
  const sistema = useColorScheme();
  const [tema] = useState<ThemeName>(sistema === 'dark' ? 'dark' : 'light');
  const theme = themes[tema];

  const { db, contexto } = useDatos();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function guardar(valores: ValoresDelFormulario) {
    try {
      const cuenta = listarCuentas(db, contexto)[0];
      if (!cuenta) {
        setError('No hay ninguna cuenta creada todavia');
        return;
      }
      crearMovimiento(db, contexto, { cuentaId: cuenta.id, ...valores });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.fondo }}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <FormularioMovimiento
        theme={theme}
        titulo="Nuevo movimiento"
        onGuardar={guardar}
        onCancelar={() => router.back()}
        error={error}
      />
    </View>
  );
}
