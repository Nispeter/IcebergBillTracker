/**
 * Las categorías: cada fila lleva a configurarla (nombre, clase de gasto y
 * reglas), y las propias se pueden quitar.
 */

import { borrarCategoria, crearCategoria } from '@iceberg/db';
import { spacing } from '@iceberg/ui';
import { Link } from 'expo-router';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonDeIcono } from '../Boton';
import { Agregador } from '../Formulario';
import { iconoDeCategoria } from '../iconos';
import { Panel } from '../Panel';
import { Seccion } from './comun';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { useCategorias } from '../../datos/catalogo';
import { useComprometidas } from '../../datos/consultas';
import { useEstilo, useEstilos, type Estilo } from '../../datos/estilos';

/** Unas ocho filas, cortando a mitad de una para que se vea que hay más abajo. */
const ALTO_DE_LA_LISTA = 268;

/** Lo que ocupa el basurero: las de la app reservan el hueco para no correr la columna. */
const BASURERO = 16;

export function Categorias() {
  const styles = useEstilos(crearEstilos);
  const { theme } = useEstilo();
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const categorias = useCategorias();
  const comprometidas = useComprometidas();
  const [nueva, setNueva] = useState('');

  function agregar() {
    if (nueva.trim() === '') return;
    try {
      const creada = crearCategoria(db, contexto, nueva);
      setNueva('');
      avisar(`Categoría "${creada.nombre}" creada`);
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  // Sin confirmar: sus movimientos siguen mostrando el nombre, y volver a
  // escribirla la revive.
  function quitar(id: string, nombre: string) {
    try {
      borrarCategoria(db, contexto, id);
      avisar(`Se quitó "${nombre}"`);
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  return (
    <Seccion
      titulo="Categorías"
      ayuda={'Toca una para cambiarle el nombre, si cuenta como compromiso fijo, y '
        + 'las reglas que la reconocen al importar una cartola.\n\n'
        + 'Cada categoría trae un tipo por omisión, y es solo eso: una suposición '
        + 'para no tener que clasificar a mano cada gasto.\n\n'
        + 'Comprometido es lo que llega igual: arriendo, cuentas, cuotas. Variable es '
        + 'lo que decides tú.\n\n'
        + 'Cámbialas si no te calzan: hay quien paga el arriendo con tarjeta y lo '
        + 'lleva en Deudas, y quien ahorra cuando sobra en vez de todos los meses.\n\n'
        + 'Un gasto suelto se puede corregir sin tocar esto, con el interruptor que '
        + 'está al lado de la categoría al crearlo o editarlo.\n\n'
        + 'Las doce primeras vienen con la app y no se pueden quitar. Las que agregues '
        + 'tú aparecen al final y llevan un basurero: quitarlas no borra ningún '
        + 'movimiento, que sigue mostrando el nombre. Y volver a escribirlas las trae '
        + 'de vuelta.\n\n'
        + 'Las categorías propias viajan al sincronizar, así que el otro teléfono ve '
        + 'los mismos nombres.'}
    >
      <Panel>
        {/* Con alto fijo y scroll propio: la lista no tiene tope y empujaría el resto de Ajustes. */}
        <ScrollView style={styles.lista} nestedScrollEnabled>
          {categorias.todas.map((categoria) => {
            const esCompromiso = comprometidas.has(categoria.id);
            const Icono = iconoDeCategoria(categoria.id);
            return (
              <View key={categoria.id} style={styles.fila}>
                <Link href={{ pathname: '/categoria/[id]', params: { id: categoria.id } }} asChild>
                  <Pressable
                    style={styles.tocable}
                    accessibilityRole="button"
                    accessibilityLabel={`Configurar ${categoria.nombre}. `
                      + `Hoy cuenta como ${esCompromiso ? 'comprometido' : 'variable'}`}
                  >
                    <Icono size={15} weight="regular" color={theme.silencio} />
                    <Text style={styles.nombre} numberOfLines={1}>{categoria.nombre}</Text>
                    <Text style={styles.clase}>{esCompromiso ? 'Comprometido' : 'Variable'}</Text>
                    <CaretRight size={12} weight="bold" color={theme.silencio} />
                  </Pressable>
                </Link>
                {/* El basurero queda fuera del tocable: actúa sobre la fila, no lleva a ningún lado. */}
                {categoria.propia ? (
                  <BotonDeIcono
                    icono={Trash}
                    tamano={BASURERO}
                    onPress={() => quitar(categoria.id, categoria.nombre)}
                    accesible={`Quitar la categoría ${categoria.nombre}`}
                  />
                ) : <View style={styles.huecoDeBasurero} />}
              </View>
            );
          })}
        </ScrollView>
      </Panel>
      <Agregador
        valor={nueva}
        onCambiar={setNueva}
        onAgregar={agregar}
        placeholder="Mascotas, auto, gimnasio…"
        accesible="Nombre de la categoría nueva"
        autoCapitalize="sentences"
      />
    </Seccion>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    lista: { maxHeight: ALTO_DE_LA_LISTA },
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    // Hasta el `>`: toda la fila se toca, no solo el nombre.
    tocable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7 },
    nombre: { ...t.cuerpo, flex: 1 },
    // Chica y apagada: dice cómo está clasificada, no es el título de la fila.
    clase: { ...t.nota, color: theme.silencioHondo },
    huecoDeBasurero: { width: BASURERO },
  });
}
