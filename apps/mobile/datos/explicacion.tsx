/**
 * Una sola hoja para todas las explicaciones de la app.
 *
 * Antes cada `?` abria su propia burbuja absoluta, y esa burbuja peleaba el
 * apilado con lo que tuviera al lado: `zIndex` en la raiz, `zIndex` en el
 * contenedor, `zIndex` en el padre del padre. Cada vez que una pantalla crecia
 * aparecia otro caso de "el globo se dibuja atras". No era un bug, era un
 * enfoque que garantizaba bugs: un elemento flotante solo compite dentro de su
 * contexto de apilado, y ese contexto lo decide cualquier ancestro.
 *
 * La hoja no tiene ese problema **por construccion**: vive una sola vez, arriba
 * de todo, y las pantallas solo piden que se muestre. De paso todas las
 * explicaciones de la app se presentan igual, que es lo que el usuario pidio
 * cuando dijo que prefiere como muestra la informacion la `i` del saldo.
 */

import { fontSizes, fonts, pesos, type Theme } from '@iceberg/ui';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Hoja } from '../components/Hoja';

/** Muestra una explicacion. El titulo es el de la seccion que la pidio. */
type Explicar = (titulo: string, texto: string) => void;

const Contexto = createContext<Explicar>(() => {});

export function useExplicar(): Explicar {
  return useContext(Contexto);
}

export function ProveedorDeExplicacion({ theme, children }: { theme: Theme; children: ReactNode }) {
  const [abierta, setAbierta] = useState<{ titulo: string; texto: string } | null>(null);
  const styles = crearEstilos(theme);

  const explicar = useCallback<Explicar>((titulo, texto) => setAbierta({ titulo, texto }), []);

  return (
    <Contexto.Provider value={explicar}>
      {children}
      {/* Va **despues** de los hijos: es lo ultimo del arbol, asi que se dibuja
          encima de todo sin necesitar un solo `zIndex`. */}
      <Hoja
        abierta={abierta !== null}
        titulo={abierta?.titulo ?? ''}
        theme={theme}
        onCerrar={() => setAbierta(null)}
      >
        <Text style={styles.texto}>{abierta?.texto ?? ''}</Text>
      </Hoja>
    </Contexto.Provider>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    texto: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: fontSizes.sm,
      lineHeight: 22,
      color: theme.tinta,
    },
  });
}
