/**
 * Elegir que cuenta se esta mirando.
 *
 * **No se dibuja si hay una sola cuenta**, que es el caso de casi todos. Un
 * selector con una unica opcion no es una eleccion, es una fila que ocupa: la
 * app tiene que verse igual que antes para quien no necesita esto.
 *
 * Va bajo el periodo y no al lado: los dos son alcances globales y se leen como
 * un par --que fechas y que cuenta--, pero el periodo se cambia mucho mas
 * seguido y merece la linea de arriba.
 */

import { capas, fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ConDesplegable } from './ConDesplegable';
import { ListaDeOpciones } from './SelectorDesplegable';
import { useCuentas } from '../datos/consultas';
import { useCuentaActiva } from '../datos/cuenta';

/** Lo que se muestra cuando el alcance son todas juntas. */
const TODAS = 'Todas las cuentas';

export function SelectorDeCuenta({ theme }: { theme: Theme }) {
  const cuentas = useCuentas();
  const { cuentaId, elegir } = useCuentaActiva();
  const [abierto, setAbierto] = useState(false);
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

  const activa = cuentas.find((c) => c.id === cuentaId);
  const opciones = [
    { valor: null, etiqueta: TODAS },
    ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
  ];

  return (
    <ConDesplegable
      abierto={abierto}
      disparador={(
        <Pressable
          onPress={() => setAbierto(!abierto)}
          style={styles.disparador}
          accessibilityRole="button"
          accessibilityLabel={`Cuenta: ${activa?.nombre ?? TODAS}. Tocar para cambiar`}
          accessibilityState={{ expanded: abierto }}
        >
          <Text style={styles.nombre} numberOfLines={1}>{activa?.nombre ?? TODAS}</Text>
          <CaretDown size={11} weight="bold" color={theme.silencio} />
        </Pressable>
      )}
      panel={(
        <View style={styles.panel}>
          <ListaDeOpciones
            theme={theme}
            opciones={opciones}
            seleccionado={cuentaId}
            onElegir={(valor) => { elegir(valor); setAbierto(false); }}
          />
        </View>
      )}
    />
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    disparador: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingTop: spacing.xs,
    },
    nombre: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: fontSizes.xs,
      color: theme.silencio,
    },
    // El panel se abre sobre el contenido, asi que necesita fondo propio.
    panel: {
      backgroundColor: theme.superficie,
      borderRadius: radii.sm,
      overflow: 'hidden',
      zIndex: capas.encabezado,
    },
  });
}
