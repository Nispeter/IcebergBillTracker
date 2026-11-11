/**
 * Quién escribe: el nombre de este teléfono y los otros del hogar. Cada
 * movimiento guarda quién lo escribió, y al sincronizar se ve de quién viene
 * cada versión.
 */

import { CLAVE_MIEMBRO, leerAjuste, renombrarMiembro, type Miembro } from '@iceberg/db';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Boton } from '../Boton';
import { Campo, Entrada } from '../Formulario';
import { Seccion } from './comun';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { useMiembros } from '../../datos/consultas';
import { useEstilos, type Estilo } from '../../datos/estilos';

export function Hogar() {
  const styles = useEstilos(crearEstilos);
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const miembros = useMiembros();
  const idPropio = useMemo(() => leerAjuste(db, CLAVE_MIEMBRO), [db]);
  const yo = miembros.find((m: Miembro) => m.id === idPropio);
  const otros = miembros.filter((m: Miembro) => m.id !== idPropio);
  /** Lo escrito en el campo, o `null` si nadie lo tocó. */
  const [nombre, setNombre] = useState<string | null>(null);

  function guardar() {
    if (yo === undefined) return;
    try {
      renombrarMiembro(db, contexto, yo.id, nombre ?? yo.nombre);
      setNombre(null);
      avisar('Listo. El nombre viaja en la próxima sincronización');
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  return (
    <Seccion
      titulo="Quién escribe"
      ayuda={'Cada movimiento guarda quién lo escribió. Ponerle nombre a este teléfono '
        + 'hace que al sincronizar se pueda ver de quién viene cada versión.'}
    >
      {yo === undefined ? null : (
        <>
          <Campo etiqueta="Este teléfono">
            <Entrada
              value={nombre ?? yo.nombre}
              onChangeText={setNombre}
              placeholder="Cómo se llama este teléfono"
              accessibilityLabel="Nombre de este teléfono"
            />
          </Campo>
          <Boton
            etiqueta="Guardar nombre"
            accesible="Guardar el nombre de este teléfono"
            onPress={guardar}
            deshabilitado={nombre === null || nombre.trim() === '' || nombre === yo.nombre}
          />
        </>
      )}
      {/* Solo los otros: el propio ya está en el campo de arriba. */}
      {otros.length === 0 ? null : (
        <Text style={styles.otros}>
          También escriben: {otros.map((m: Miembro) => m.nombre).join(', ')}
        </Text>
      )}
    </Seccion>
  );
}

function crearEstilos({ t }: Estilo) {
  return StyleSheet.create({
    otros: t.etiqueta,
  });
}
