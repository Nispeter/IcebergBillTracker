/**
 * El marco que comparten todas las vistas: menu, marca, periodo y el boton de agregar.
 *
 * Existe para que el periodo este **en todas partes**. Si cada pantalla armara
 * su propio encabezado, tarde o temprano alguna se olvidaria de la barra y el
 * usuario perderia la referencia de que fecha esta mirando.
 *
 * El **mas flota abajo a la derecha**, no en el encabezado. Es la accion mas
 * frecuente de la app y arriba quedaba lejos del pulgar; ademas competia por
 * ancho con el nombre del periodo, que en "17 al 23 de agosto" ya va justo.
 * Abajo no compite con nada y se alcanza sin mover la mano.
 */

import { fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { List } from 'phosphor-react-native/src/icons/List';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarraDePeriodo } from './BarraDePeriodo';
import { Pinguino } from './Pinguino';
import { Sidebar } from './Sidebar';
import { useTema } from '../datos/tema';

export function Pantalla(
  { children, sinPeriodo, permitirFuturo }: {
    children: ReactNode;
    sinPeriodo?: boolean;
    /** Ver `BarraDePeriodo`: solo Tempanos necesita mirar hacia adelante. */
    permitirFuturo?: boolean;
  },
) {
  const { nombre: tema, theme } = useTema();
  const styles = crearEstilos(theme);
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <View style={styles.marco}>
        <View style={styles.encabezado}>
          {/* Sin burbuja: tres lineas ya se leen como menu, y el circulo solo
              agregaba un borde mas a una fila que ya tiene varios. El area
              tocable la sostiene el `hitSlop`, no el dibujo. */}
          <Pressable
            onPress={() => setMenuAbierto(true)}
            style={styles.boton}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú"
            hitSlop={12}
          >
            <List size={18} weight="bold" color={theme.tinta} />
          </Pressable>

          {sinPeriodo ? (
            <View style={styles.marcaFila}>
              <Pinguino theme={theme} tamano={18} />
              <Text style={styles.marca}>ICEBERG</Text>
            </View>
          ) : (
            <View style={styles.periodo}><BarraDePeriodo theme={theme} permitirFuturo={permitirFuturo} /></View>
          )}
        </View>
      </View>

      {children}

      <Link href="/nuevo" asChild>
        <Pressable
          style={styles.flotante}
          accessibilityRole="button"
          accessibilityLabel="Agregar movimiento"
        >
          <Plus size={26} weight="bold" color={theme.sobreAcento} />
        </Pressable>
      </Link>

      <Sidebar theme={theme} abierta={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: theme.fondo },
    /**
     * Elevado sobre el contenido para que el panel del periodo se abra encima.
     *
     * El marco va **antes** que los hijos en el orden del documento, asi que sin
     * esto cualquier fila de la pantalla le pasa por arriba. El numero es mayor
     * que el de los desplegables de contenido: si los dos estan abiertos, el del
     * periodo manda, porque es el que se acaba de tocar.
     */
    marco: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      zIndex: 40,
    },
    // El periodo va en la misma linea que el menu: es marco, no contenido, y no
    // merece una franja propia.
    encabezado: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, zIndex: 40 },
    periodo: { flex: 1, zIndex: 40 },
    marcaFila: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    marca: { fontFamily: fonts.ui, fontWeight: pesos.bold, fontSize: fontSizes.xs, color: theme.tinta, letterSpacing: 3 },
    boton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },

    /**
     * 56 px es el tamano al que un boton flotante se toca sin apuntar. Va sobre
     * el contenido, asi que las listas dejan aire abajo para que no tape la
     * ultima fila.
     */
    flotante: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.acento,
      zIndex: 5,
    },
  });
}
