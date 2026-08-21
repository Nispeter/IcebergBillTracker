/** Edicion de una cuenta periodica. */

import type { categories, dates, recurrence } from '@iceberg/core';
import { borrarRegla, editarRegla, obtenerRegla } from '@iceberg/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { FormularioRegla, type ValoresDeRegla } from '../../components/FormularioRegla';
import { useDatos } from '../../datos/BaseDeDatos';
import { volver } from '../../datos/navegacion';
import { useTema } from '../../datos/tema';
import { PantallaModal } from '../../components/PantallaModal';

export default function EditarRegla() {
  const { theme } = useTema();
  const { db, contexto } = useDatos();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  // Se lee una sola vez: el formulario es su propio estado desde ahi.
  const regla = useMemo(() => obtenerRegla(db, contexto, id), [db, contexto, id]);

  const fondo = { flex: 1, backgroundColor: theme.fondo } as const;

  if (regla === null) {
    return (
      <PantallaModal>
        <Text style={{ padding: 24, color: theme.silencio }}>Esa cuenta periódica ya no existe.</Text>
      </PantallaModal>
    );
  }

  return (
    <PantallaModal>
      <FormularioRegla
        theme={theme}
        titulo="Editar cuenta periódica"
        inicial={{
          tipo: regla.tipo,
          montoMinor: regla.montoMinor,
          nombre: regla.nombre,
          categoriaId: regla.categoriaId as categories.CategoryId | null,
          frecuencia: regla.frecuencia as recurrence.Frecuencia,
          cada: regla.cada,
          desde: regla.desde as dates.PlainDate,
          hasta: regla.hasta as dates.PlainDate | null,
        }}
        onGuardar={(valores: ValoresDeRegla) => {
          try {
            editarRegla(db, contexto, regla.id, valores);
            volver(router);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
        onCancelar={() => volver(router)}
        onBorrar={() => {
          borrarRegla(db, contexto, regla.id);
          volver(router);
        }}
        error={error}
      />
    </PantallaModal>
  );
}
