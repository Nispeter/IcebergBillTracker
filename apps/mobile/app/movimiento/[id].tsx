/** Editar o borrar un movimiento. */

import type { categories, dates } from '@iceberg/core';
import { borrarMovimiento, editarMovimiento, obtenerMovimiento } from '@iceberg/db';
import { fontSizes, fonts, pesos, spacing } from '@iceberg/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { FormularioMovimiento, type ValoresDelFormulario } from '../../components/FormularioMovimiento';
import { useDatos } from '../../datos/BaseDeDatos';
import { volver } from '../../datos/navegacion';
import { useTema } from '../../datos/tema';

export default function EditarMovimiento() {
  const { nombre: tema, theme } = useTema();

  const { db, contexto } = useDatos();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  // Se lee una sola vez: el formulario es un borrador local, no una vista de la
  // base. Si se releyera en vivo, cada tecla se pisaria con el valor guardado.
  const movimiento = useMemo(
    () => (id ? obtenerMovimiento(db, contexto, id) : null),
    [db, contexto, id],
  );

  if (!movimiento) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.fondo, padding: spacing.xxl, gap: spacing.md }}>
        <Text style={{ fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.tinta }}>
          Ese movimiento ya no existe
        </Text>
        <Text
          onPress={() => volver(router)}
          style={{ fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.acentoTexto }}
        >
          Volver
        </Text>
      </View>
    );
  }

  function guardar(valores: ValoresDelFormulario) {
    try {
      editarMovimiento(db, contexto, movimiento!.id, valores);
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function borrar() {
    try {
      borrarMovimiento(db, contexto, movimiento!.id);
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
        titulo="Editar movimiento"
        inicial={{
          tipo: movimiento.tipo,
          montoMinor: movimiento.montoMinor,
          ocurridoEn: movimiento.ocurridoEn as dates.PlainDate,
          nombre: movimiento.nombre,
          categoriaId: movimiento.categoriaId as categories.CategoryId | null,
        }}
        onGuardar={guardar}
        onCancelar={() => volver(router)}
        onBorrar={borrar}
        error={error}
      />
    </View>
  );
}
