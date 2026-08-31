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
 * ## En una tarjeta hundida, y desplegable
 *
 * La tarjeta es lo que lo distingue de la navegacion que tiene debajo: un
 * intento anterior lo puso como lista de filas y el menu entero paso a ser una
 * columna larga donde no se distinguia "a donde voy" de "que estoy mirando".
 * Otro plano, otra cosa.
 *
 * El desplegable se abre **encima** de los destinos y no empujandolos: en un
 * panel de seis filas, correrlas hacia abajo cada vez que uno mira las cuentas
 * hace perder el lugar. La lista tambien va en el tono hundido: sobre la
 * superficie del menu, una lista en `superficie` seria invisible.
 */

import { fonts, pesos, radii, spacing, type Letra, type Theme } from '@iceberg/ui';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ConDesplegable } from './ConDesplegable';
import { Panel } from './Panel';
import { useCuentas } from '../datos/consultas';
import { useCuentaActiva } from '../datos/cuenta';
import { useLetra } from '../datos/letra';

/** Lo que se muestra cuando el alcance son todas juntas. */
const TODAS = 'Todas las cuentas';

export function SelectorDeCuenta(
  { theme, alCerrar }: { theme: Theme; alCerrar: () => void },
) {
  const cuentas = useCuentas();
  const { cuentaId, elegir } = useCuentaActiva();
  const [abierto, setAbierto] = useState(false);
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);

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
  const opciones: { valor: string | null; etiqueta: string }[] = [
    { valor: null, etiqueta: TODAS },
    ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
  ];

  return (
    <ConDesplegable
      abierto={abierto}
      disparador={(
        <Panel theme={theme} estilo={styles.tarjeta}>
          <Text style={styles.titulo}>Cuenta</Text>
          <Pressable
            onPress={() => setAbierto(!abierto)}
            style={styles.disparador}
            accessibilityRole="button"
            accessibilityState={{ expanded: abierto }}
            accessibilityLabel={`Cuenta: ${activa?.nombre ?? TODAS}. Tocar para cambiar`}
          >
            <Text style={styles.nombre} numberOfLines={1}>{activa?.nombre ?? TODAS}</Text>
            <CaretDown size={12} weight="bold" color={theme.silencioHondo} />
          </Pressable>
        </Panel>
      )}
      panel={(
        <View style={styles.lista}>
          {opciones.map((opcion) => {
            const elegida = opcion.valor === cuentaId;
            return (
              <Pressable
                key={opcion.valor ?? 'todas'}
                onPress={() => { elegir(opcion.valor); setAbierto(false); alCerrar(); }}
                style={({ pressed }) => [styles.opcion, pressed && styles.opcionApretada]}
                accessibilityRole="button"
                accessibilityState={{ selected: elegida }}
                accessibilityLabel={`Ver ${opcion.etiqueta}`}
              >
                <Text style={elegida ? styles.opcionActiva : styles.opcionTexto} numberOfLines={1}>
                  {opcion.etiqueta}
                </Text>
                {elegida ? <Check size={12} weight="bold" color={theme.acentoTexto} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    />
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    tarjeta: { marginBottom: spacing.md, gap: spacing.xs },
    titulo: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.px(10),
      color: theme.silencioHondo,
    },
    disparador: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    nombre: {
      flex: 1,
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: letra.xs,
      color: theme.tinta,
    },

    /**
     * La lista flotante, en el mismo tono hundido que la tarjeta.
     *
     * El borde no es decoracion: sobre el fondo del menu, dos superficies
     * oscuras contiguas se funden y no se sabe donde termina una.
     */
    lista: {
      marginTop: -spacing.sm,
      backgroundColor: theme.superficieHonda,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.hairline,
      overflow: 'hidden',
    },
    opcion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    opcionApretada: { opacity: 0.6 },
    opcionTexto: {
      flex: 1,
      fontFamily: fonts.texto, fontWeight: pesos.regular,
      fontSize: letra.xs, color: theme.silencioHondo,
    },
    opcionActiva: {
      flex: 1,
      fontFamily: fonts.texto, fontWeight: pesos.medium,
      fontSize: letra.xs, color: theme.tinta,
    },
  });
}
