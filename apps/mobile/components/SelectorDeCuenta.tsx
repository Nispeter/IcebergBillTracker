/**
 * Elegir que cuenta se esta mirando.
 *
 * **No se dibuja si hay una sola cuenta**, que es el caso de casi todos. Un
 * selector con una unica opcion no es una eleccion, es una fila que ocupa: la
 * app tiene que verse igual que antes para quien no necesita esto.
 *
 * ## Vive en el menu lateral
 *
 * Estuvo bajo el periodo, en el encabezado, y dejaba una barra de **dos lineas
 * en todas las pantallas** para algo que casi nunca se cambia: uno mira un libro
 * y se queda ahi. El menu es donde ya viven las decisiones de "que estoy
 * mirando", y ademas se abre entero.
 *
 * Por eso mismo aca es una **lista y no un desplegable**: el menu ya es una capa
 * sobre la pantalla, y abrir un desplegable adentro seria capa sobre capa para
 * mostrar tres opciones que caben a la vista. Se toca la que se quiere y el menu
 * se cierra, igual que con cualquier destino.
 */

import { fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCuentas } from '../datos/consultas';
import { useCuentaActiva } from '../datos/cuenta';

/** Lo que se muestra cuando el alcance son todas juntas. */
const TODAS = 'Todas las cuentas';

export function SelectorDeCuenta(
  { theme, alCerrar }: { theme: Theme; alCerrar: () => void },
) {
  const cuentas = useCuentas();
  const { cuentaId, elegir } = useCuentaActiva();
  const styles = crearEstilos(theme);

  /**
   * Si la cuenta activa ya no existe, volver a "todas".
   *
   * Pasa al borrar la cuenta que uno estaba mirando: el alcance se queda con un
   * id muerto y **todas las consultas devuelven vacio**, sin nada que explique
   * por que. Va aca porque este es el unico componente que ve las dos cosas: el
   * alcance y la lista de cuentas.
   */
  useEffect(() => {
    // La lista vacia significa **que todavia no carga**, no que no haya cuentas:
    // `useLiveQuery` devuelve `[]` en el primer render. Sin esta guarda, el
    // efecto corria antes de tiempo y borraba la cuenta por defecto en cada
    // arranque, asi que la app abria siempre en "todas" por mas que hubiera una
    // marcada con estrella.
    if (cuentas.length === 0) return;
    if (cuentaId !== null && !cuentas.some((c) => c.id === cuentaId)) elegir(null);
  }, [cuentaId, cuentas, elegir]);

  // Sin dibujo con una sola cuenta, pero el efecto de arriba corre igual.
  if (cuentas.length < 2) return null;

  const opciones: { valor: string | null; etiqueta: string }[] = [
    { valor: null, etiqueta: TODAS },
    ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
  ];

  return (
    <View style={styles.bloque}>
      <Text style={styles.titulo}>Cuenta</Text>
      {opciones.map((opcion) => {
        const activa = opcion.valor === cuentaId;
        return (
          <Pressable
            key={opcion.valor ?? 'todas'}
            onPress={() => { elegir(opcion.valor); alCerrar(); }}
            style={({ pressed }) => [
              styles.fila,
              activa && styles.filaActiva,
              pressed && styles.filaApretada,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: activa }}
            accessibilityLabel={`Ver ${opcion.etiqueta}`}
          >
            <Text style={activa ? styles.nombreActivo : styles.nombre} numberOfLines={1}>
              {opcion.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    bloque: { paddingBottom: spacing.md, gap: 1 },
    titulo: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: 10,
      color: theme.silencio,
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.xs,
    },
    fila: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.sm,
    },
    filaActiva: { backgroundColor: theme.superficieHonda },
    filaApretada: { opacity: 0.6 },
    nombre: {
      fontFamily: fonts.texto, fontWeight: pesos.regular,
      fontSize: fontSizes.xs, color: theme.silencio,
    },
    nombreActivo: {
      fontFamily: fonts.texto, fontWeight: pesos.medium,
      fontSize: fontSizes.xs, color: theme.tinta,
    },
  });
}
