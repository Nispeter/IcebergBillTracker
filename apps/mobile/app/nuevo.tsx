/** Alta manual de un movimiento. */

import { listarCuentas, crearMovimiento } from '@iceberg/db';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { FormularioMovimiento, type ValoresDelFormulario } from '../components/FormularioMovimiento';
import { useDatos } from '../datos/BaseDeDatos';
import { useTema } from '../datos/tema';
import { volver } from '../datos/navegacion';

export default function NuevoMovimiento() {
  const { nombre: tema, theme } = useTema();

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
      volver(router);
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
        onCancelar={() => volver(router)}
        error={error}
      />
    </View>
  );
}
