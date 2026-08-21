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
 * ## Fichas, no una lista
 *
 * El primer intento aca fue una lista de filas, y el problema fue que se veia
 * **igual que la lista de destinos** justo debajo: el menu entero pasaba a ser
 * una sola columna larga donde no se distinguia "a donde voy" de "que estoy
 * mirando". Las fichas tienen otra forma --pildoras, en linea, envolviendo-- y
 * viven dentro de un panel hundido, asi que se leen como un control y no como
 * mas navegacion. De paso ocupan dos lineas en vez de cuatro.
 *
 * Un desplegable no servia: el menu ya es una capa sobre la pantalla, y abrir
 * otro adentro seria capa sobre capa para elegir entre tres cosas que caben a la
 * vista.
 */

import { fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Panel } from './Panel';
import { useCuentas } from '../datos/consultas';
import { useCuentaActiva } from '../datos/cuenta';

/** Corto a proposito: en una ficha, "Todas las cuentas" ocuparia dos lineas. */
const TODAS = 'Todas';

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
    <Panel theme={theme} estilo={styles.panel}>
      <Text style={styles.titulo}>Cuenta</Text>
      <View style={styles.fichas}>
        {opciones.map((opcion) => {
          const activa = opcion.valor === cuentaId;
          return (
            <Pressable
              key={opcion.valor ?? 'todas'}
              onPress={() => { elegir(opcion.valor); alCerrar(); }}
              style={({ pressed }) => [
                styles.ficha,
                activa && styles.fichaActiva,
                pressed && styles.fichaApretada,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={`Ver ${opcion.etiqueta === TODAS ? 'todas las cuentas' : opcion.etiqueta}`}
            >
              <Text style={activa ? styles.textoActivo : styles.texto} numberOfLines={1}>
                {opcion.etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    panel: { marginBottom: spacing.md, gap: spacing.sm },
    titulo: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: 10,
      color: theme.silencioHondo,
    },
    fichas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    ficha: {
      paddingVertical: 5,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: theme.hairline,
    },
    fichaActiva: { backgroundColor: theme.acento, borderColor: theme.acento },
    fichaApretada: { opacity: 0.6 },
    texto: {
      fontFamily: fonts.texto, fontWeight: pesos.regular,
      fontSize: 11, color: theme.silencioHondo,
    },
    textoActivo: {
      fontFamily: fonts.texto, fontWeight: pesos.medium,
      fontSize: 11, color: theme.sobreAcento,
    },
  });
}
