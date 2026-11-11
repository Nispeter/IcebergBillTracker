/**
 * Configurar una categoría: el nombre, si cuenta como compromiso y las reglas
 * que la reconocen al importar.
 *
 * Es una pantalla y no la hoja de donde se llega porque un `TextInput` dentro
 * de la hoja no esquiva el teclado.
 *
 * Se lee de una sola vez: es un borrador. Además `useLiveQuery` devuelve vacío
 * en el primer render, y sembrar el campo así lo llenaría con el id pelado, que
 * al guardar renombraría la categoría a su propio id.
 *
 * Las doce de la app también se renombran (una fila con su id le gana al
 * nombre de `core`); por eso existe "Volver a ...", que es la única forma de
 * deshacerlo.
 */

import { categories } from '@iceberg/core';
import {
  aplicarCategorias, borrarReglaDeCategoria, crearReglaDeCategoria, obtenerCategoria,
  renombrarCategoria, restaurarCategoria, type ReglaCategoria,
} from '@iceberg/db';
import { spacing } from '@iceberg/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Boton, BotonDeIcono } from '../../components/Boton';
import {
  Agregador, Campo, Entrada, ErrorDelFormulario, Formulario,
} from '../../components/Formulario';
import { iconoDeCategoria } from '../../components/iconos';
import { Interruptor } from '../../components/Interruptor';
import { PantallaModal } from '../../components/PantallaModal';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import {
  leerComprometidas, useMarcarComprometida, useReglasDeCategoria,
} from '../../datos/consultas';
import { useEstilos, type Estilo } from '../../datos/estilos';
import { volver } from '../../datos/navegacion';

export default function EditarCategoria() {
  const styles = useEstilos(crearEstilos);
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const marcarComprometida = useMarcarComprometida();

  const fila = useMemo(() => obtenerCategoria(db, contexto, id), [db, contexto, id]);
  const deLaApp = categories.categoryById(id);

  // El nombre de hoy, con la misma precedencia que el catálogo: viva, core,
  // borrada, id. Resuelto distinto, el campo diría otra cosa que la lista.
  const viva = fila !== null && fila.deletedAt === null ? fila.nombre : null;
  const actual = viva ?? deLaApp?.nombre ?? fila?.nombre ?? id;

  const [nombre, setNombre] = useState(actual);
  const [comprometido, setComprometido] = useState(() => leerComprometidas(db).has(id));
  const [error, setError] = useState<string | null>(null);

  // Las reglas son de la categoría tanto como su nombre: "si dice VETERINARIA,
  // es mascotas". Se guardan al escribirlas, no con Guardar: son filas propias,
  // y mezclarlas con el borrador haría que Cancelar significara dos cosas.
  const mias = useReglasDeCategoria().filter((r: ReglaCategoria) => r.categoriaId === id);
  const [patron, setPatron] = useState('');

  const limpio = nombre.trim();
  // Solo se puede volver al original si hay uno y hoy dice otra cosa.
  const puedeRestaurar = deLaApp !== null && viva !== null;

  function intentar(accion: () => void) {
    try {
      accion();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const guardar = () => intentar(() => {
    // Sin cambios no se escribe: una fila que repite el nombre de `core`
    // viajaría igual al otro teléfono.
    if (limpio !== actual) renombrarCategoria(db, contexto, id, limpio);
    if (comprometido !== leerComprometidas(db).has(id)) marcarComprometida(id, comprometido);
    avisar('Cambios guardados');
    volver(router);
  });

  const agregarRegla = () => intentar(() => {
    if (patron.trim() === '') return;
    crearReglaDeCategoria(db, contexto, { patron, categoriaId: id });
    setPatron('');
    // Se aplica en el acto a lo que estaba sin categoría, para que se vea que sirvió.
    const cuantos = aplicarCategorias(db, contexto);
    avisar(cuantos === 0 ? 'Regla guardada' : `Regla guardada. Se categorizaron ${cuantos}`);
  });

  const quitarRegla = (reglaId: string, comoDice: string) => intentar(() => {
    borrarReglaDeCategoria(db, contexto, reglaId);
    avisar(`Se quitó "${comoDice}"`);
  });

  const restaurar = () => intentar(() => {
    restaurarCategoria(db, contexto, id);
    avisar(`Vuelve a llamarse "${deLaApp?.nombre ?? id}"`);
    volver(router);
  });

  return (
    <PantallaModal>
      <Formulario titulo="Editar categoría" icono={iconoDeCategoria(id)} onCancelar={() => volver(router)}>
        <Campo
          etiqueta="Nombre"
          ayuda={deLaApp === null
            ? null
            : 'Viene con la app. Cambiarle el nombre no toca los movimientos que ya la usan.'}
        >
          <Entrada
            value={nombre}
            onChangeText={setNombre}
            placeholder={deLaApp?.nombre ?? 'Cómo se llama'}
            autoCapitalize="sentences"
            autoCorrect={false}
            accessibilityLabel="Nombre de la categoría"
          />
        </Campo>

        <Campo
          etiqueta="Clase de gasto"
          ayuda="Comprometido es lo que llega igual: arriendo, cuentas, cuotas. Variable es lo que decides tú."
        >
          <View style={styles.fila}>
            <Text style={styles.clase}>{comprometido ? 'Comprometido' : 'Variable'}</Text>
            <Interruptor
              encendido={comprometido}
              onCambiar={setComprometido}
              accesible={comprometido
                ? 'Comprometido. Tocar para marcarlo como variable'
                : 'Variable. Tocar para marcarlo como comprometido'}
            />
          </View>
        </Campo>

        <Campo
          etiqueta="Cuando el movimiento diga…"
          ayuda={mias.length === 0
            ? 'Todavía no hay ninguna. Escribe un trozo del nombre que aparece en la cartola y todo lo que lo contenga se va a clasificar acá solo.'
            : null}
        >
          {mias.map((regla: ReglaCategoria) => (
            <View key={regla.id} style={styles.fila}>
              <Text style={styles.patron} numberOfLines={1}>{regla.patron}</Text>
              <BotonDeIcono
                icono={Trash}
                tamano={16}
                onPress={() => quitarRegla(regla.id, regla.patron)}
                accesible={`Quitar la regla ${regla.patron}`}
              />
            </View>
          ))}
          <Agregador
            valor={patron}
            onCambiar={setPatron}
            onAgregar={agregarRegla}
            placeholder="jumbo, uber, veterinaria…"
            accesible="Texto que reconoce esta categoría"
          />
        </Campo>

        <ErrorDelFormulario error={error} />

        <Boton
          variante="principal"
          etiqueta="Guardar"
          accesible="Guardar la categoría"
          onPress={guardar}
          deshabilitado={limpio === ''}
        />

        {puedeRestaurar ? (
          <Boton
            etiqueta={`Volver a "${deLaApp?.nombre}"`}
            accesible={`Volver a llamarla ${deLaApp?.nombre}`}
            onPress={restaurar}
            estilo={styles.centrado}
          />
        ) : null}
      </Formulario>
    </PantallaModal>
  );
}

function crearEstilos({ t }: Estilo) {
  return StyleSheet.create({
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    clase: t.cuerpo,
    patron: { ...t.cifra, flex: 1 },
    centrado: { alignSelf: 'center' },
  });
}
