/**
 * Editar una categoría: como se llama y si cuenta como compromiso.
 *
 * Se llega desde el reparto del gasto, tocando una categoría y eligiendo
 * "Editar". Las dos cosas que se cambian acá son las dos que una categoría
 * tiene: el nombre, que es lo que uno lee, y si lo que cae ahí llega igual
 * todos los meses o lo decide uno.
 *
 * ## Una pantalla y no la misma hoja
 *
 * La hoja de la que se sale monta un `BottomSheetScrollView`, y un `TextInput`
 * común ahí adentro no esquiva el teclado: haría falta el `BottomSheetTextInput`
 * de la librería, que no se usa en ninguna otra parte del repo. El molde de
 * `cuenta/[id].tsx` --modal, campo, Guardar, volver-- ya resolvió esto mismo.
 *
 * ## Se lee de una sola vez
 *
 * Como el formulario de movimiento: esto es un borrador local, no una vista de
 * la base. Y acá además evita un bug concreto. Los hooks de la app van por
 * `useLiveQuery`, que devuelve vacío en el primer render: sembrar el campo con
 * `useCategorias()` lo llenaría con el **id pelado** de la categoría, y al tocar
 * Guardar la app entendería que el nombre cambió y la renombraría a su propio
 * id. Lo mismo con el interruptor, que nacería con la lista de omisión y al
 * guardar pisaría lo que el usuario hubiera elegido en Ajustes.
 *
 * ## Las doce de la app también se renombran
 *
 * Se guarda una fila con el id de la built-in que le gana al nombre de `core`;
 * ver `renombrarCategoria`. Por eso existe "Volver al nombre original", que es
 * la única forma de deshacerlo: en una propia no hay a qué volver.
 */

import { categories } from '@iceberg/core';
import {
  aplicarCategorias, borrarReglaDeCategoria, crearReglaDeCategoria, obtenerCategoria,
  renombrarCategoria, restaurarCategoria, type ReglaCategoria,
} from '@iceberg/db';
import {
  elevation, fonts, pesos, radii, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Interruptor } from '../../components/Interruptor';
import { PantallaModal } from '../../components/PantallaModal';
import { iconoDeCategoria } from '../../components/iconos';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import {
  leerComprometidas, useMarcarComprometida, useReglasDeCategoria,
} from '../../datos/consultas';
import { useLetra } from '../../datos/letra';
import { volver } from '../../datos/navegacion';
import { useTema } from '../../datos/tema';

export default function EditarCategoria() {
  const { theme } = useTema();
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const marcarComprometida = useMarcarComprometida();

  const fila = useMemo(() => obtenerCategoria(db, contexto, id), [db, contexto, id]);
  const deLaApp = categories.categoryById(id);

  /**
   * El nombre que se está viendo hoy, con la misma precedencia que el catálogo.
   *
   * `viva → core → borrada → id`. Si se resolviera distinto que el catálogo, el
   * campo llegaría con un nombre y la pantalla anterior mostraría otro.
   */
  const viva = fila !== null && fila.deletedAt === null ? fila.nombre : null;
  const actual = viva ?? deLaApp?.nombre ?? fila?.nombre ?? id;

  const [nombre, setNombre] = useState(actual);
  const [comprometido, setComprometido] = useState(
    () => leerComprometidas(db).has(id),
  );
  const [error, setError] = useState<string | null>(null);

  /**
   * Las reglas que apuntan a esta categoria.
   *
   * Viven aca y no solo en su pantalla aparte porque **son de la categoria**:
   * "si dice VETERINARIA, es mascotas" es una propiedad de mascotas tanto como
   * su nombre. Tenerlas en otra pantalla obligaba a saber que existian.
   *
   * La pantalla aparte se queda igual, y hace algo que esta no puede: ofrece los
   * nombres sin reconocer de **todo** el historial, que no pertenecen a ninguna
   * categoria hasta que uno decide a cual van.
   */
  const reglas = useReglasDeCategoria();
  const mias = reglas.filter((r: ReglaCategoria) => r.categoriaId === id);
  const [patron, setPatron] = useState('');

  const Icono = iconoDeCategoria(id);
  const limpio = nombre.trim();
  const puedeGuardar = limpio !== '';
  // Solo se puede volver al original si hay uno y si hoy dice otra cosa.
  const puedeRestaurar = deLaApp !== null && viva !== null;

  function guardar() {
    try {
      // La guarda importa: sin ella, abrir una de la app y guardar sin tocar
      // nada escribiría una fila de override que dice exactamente lo mismo que
      // `core`, y esa fila después viaja al otro teléfono.
      if (limpio !== actual) renombrarCategoria(db, contexto, id, limpio);
      if (comprometido !== leerComprometidas(db).has(id)) marcarComprometida(id, comprometido);
      avisar('Cambios guardados');
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function agregarRegla() {
    if (patron.trim() === '') return;
    try {
      crearReglaDeCategoria(db, contexto, { patron, categoriaId: id });
      setPatron('');
      // Se aplica al toque sobre lo que ya estaba sin categoria: escribir la
      // regla y que no pasara nada visible hacia dudar de si habia servido.
      const cuantos = aplicarCategorias(db, contexto);
      avisar(cuantos === 0
        ? 'Regla guardada'
        : `Regla guardada. Se categorizaron ${cuantos}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function quitarRegla(reglaId: string, comoDice: string) {
    try {
      borrarReglaDeCategoria(db, contexto, reglaId);
      avisar(`Se quitó "${comoDice}"`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function restaurar() {
    try {
      restaurarCategoria(db, contexto, id);
      avisar(`Vuelve a llamarse "${deLaApp?.nombre ?? id}"`);
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.encabezado}>
          <View style={styles.titulo}>
            <Icono size={18} weight="regular" color={theme.silencio} />
            <Text style={styles.tituloTexto}>Editar categoría</Text>
          </View>
          <Pressable onPress={() => volver(router)} accessibilityRole="button">
            <Text style={styles.cancelar}>Cancelar</Text>
          </Pressable>
        </View>

        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Nombre</Text>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            placeholder={deLaApp?.nombre ?? 'Cómo se llama'}
            placeholderTextColor={theme.silencio}
            autoCapitalize="sentences"
            autoCorrect={false}
            style={styles.entrada}
            accessibilityLabel="Nombre de la categoría"
          />
          {deLaApp === null ? null : (
            <Text style={styles.ayuda}>
              Viene con la app. Cambiarle el nombre no toca los movimientos que ya la usan.
            </Text>
          )}
        </View>

        {/*
          El mismo interruptor que está en Ajustes, escribiendo en el mismo
          ajuste. Acá es la vista de a una, para quien ya entró a cambiarle el
          nombre; allá es la vista en tanda, para quien configura todo de una vez.
        */}
        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Clase de gasto</Text>
          <View style={styles.filaInterruptor}>
            <Text style={styles.clase}>{comprometido ? 'Comprometido' : 'Variable'}</Text>
            <Interruptor
              theme={theme}
              encendido={comprometido}
              onCambiar={setComprometido}
              accesible={comprometido
                ? 'Comprometido. Tocar para marcarlo como variable'
                : 'Variable. Tocar para marcarlo como comprometido'}
            />
          </View>
          <Text style={styles.ayuda}>
            Comprometido es lo que llega igual: arriendo, cuentas, cuotas. Variable es lo
            que decides tú.
          </Text>
        </View>

        {/*
          Las reglas de categorizacion, que antes vivian solo en otra pantalla.

          Se guardan en cuanto se escriben y no esperan a Guardar: son filas
          propias de la base, no campos de este formulario, y mezclarlas con el
          borrador haria que Cancelar significara dos cosas distintas.
        */}
        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Cuando el movimiento diga…</Text>
          {mias.length === 0 ? (
            <Text style={styles.ayuda}>
              Todavía no hay ninguna. Escribe un trozo del nombre que aparece en la
              cartola y todo lo que lo contenga se va a clasificar acá solo.
            </Text>
          ) : mias.map((regla: ReglaCategoria) => (
            <View key={regla.id} style={styles.filaDeRegla}>
              <Text style={styles.patron} numberOfLines={1}>{regla.patron}</Text>
              <Pressable
                onPress={() => quitarRegla(regla.id, regla.patron)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Quitar la regla ${regla.patron}`}
              >
                <Trash size={14} weight="regular" color={theme.silencio} />
              </Pressable>
            </View>
          ))}

          <View style={styles.filaDeAgregar}>
            <TextInput
              value={patron}
              onChangeText={setPatron}
              placeholder="jumbo, uber, veterinaria…"
              placeholderTextColor={theme.silencio}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={agregarRegla}
              returnKeyType="done"
              style={[styles.entrada, styles.entradaDeRegla]}
              accessibilityLabel="Texto que reconoce esta categoría"
            />
            <Pressable
              onPress={agregarRegla}
              disabled={patron.trim() === ''}
              style={[styles.secundario, patron.trim() === '' && styles.apagado]}
              accessibilityRole="button"
              accessibilityLabel="Agregar la regla"
            >
              <Text style={styles.secundarioTexto}>Agregar</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={guardar}
          disabled={!puedeGuardar}
          style={[styles.guardar, !puedeGuardar && styles.apagado]}
          accessibilityRole="button"
          accessibilityLabel="Guardar la categoría"
        >
          <Text style={styles.guardarTexto}>Guardar</Text>
        </Pressable>

        {puedeRestaurar ? (
          <Pressable
            onPress={restaurar}
            style={styles.secundario}
            accessibilityRole="button"
            accessibilityLabel={`Volver a llamarla ${deLaApp?.nombre}`}
          >
            <Text style={styles.secundarioTexto}>
              Volver a “{deLaApp?.nombre}”
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </PantallaModal>
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
      gap: spacing.xl,
    },
    encabezado: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.xxl,
    },
    titulo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    tituloTexto: {
      fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.lg, color: theme.tinta,
    },
    cancelar: {
      fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.sm, color: theme.silencio,
    },

    campo: { gap: spacing.sm },
    etiqueta: {
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: letra.xs,
      color: theme.silencio,
      letterSpacing: 1,
    },
    entrada: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.md,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
    },
    filaInterruptor: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    clase: {
      fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.sm, color: theme.tinta,
    },
    ayuda: {
      fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.silencio,
    },
    error: {
      fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.sm, color: theme.vencidoTexto,
    },

    guardar: {
      backgroundColor: theme.acento,
      borderRadius: radii.sm,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    apagado: { opacity: 0.4 },
    guardarTexto: {
      fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.md, color: theme.sobreAcento,
    },
    secundario: { paddingVertical: spacing.md, alignItems: 'center' },
    secundarioTexto: {
      fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.sm, color: theme.acentoTexto,
    },

    filaDeRegla: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    // En monoespaciada: es un trozo de texto que se compara literalmente, no
    // una frase. Se guarda normalizado, y asi se ve que lo esta.
    patron: {
      flex: 1,
      fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.tinta,
    },
    filaDeAgregar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    entradaDeRegla: { flex: 1 },
  });
}
