/** Edición de una cuenta periódica. */

import type { dates, recurrence } from '@iceberg/core';
import { borrarRegla, editarRegla, obtenerRegla } from '@iceberg/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { NoExiste } from '../../components/Formulario';
import { FormularioRegla, type ValoresDeRegla } from '../../components/FormularioRegla';
import { PantallaModal } from '../../components/PantallaModal';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { volver } from '../../datos/navegacion';

export default function EditarRegla() {
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  // Se lee una sola vez: desde ahí el formulario es su propio borrador.
  const regla = useMemo(() => obtenerRegla(db, contexto, id), [db, contexto, id]);

  if (regla === null) {
    return (
      <PantallaModal>
        <NoExiste mensaje="Esa cuenta periódica ya no existe" />
      </PantallaModal>
    );
  }

  return (
    <PantallaModal>
      <FormularioRegla
        titulo="Editar cuenta periódica"
        inicial={{
          tipo: regla.tipo,
          montoMinor: regla.montoMinor,
          nombre: regla.nombre,
          categoriaId: regla.categoriaId,
          frecuencia: regla.frecuencia as recurrence.Frecuencia,
          cada: regla.cada,
          desde: regla.desde as dates.PlainDate,
          hasta: regla.hasta as dates.PlainDate | null,
        }}
        onGuardar={(valores: ValoresDeRegla) => {
          try {
            editarRegla(db, contexto, regla.id, valores);
            avisar('Cambios guardados');
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
