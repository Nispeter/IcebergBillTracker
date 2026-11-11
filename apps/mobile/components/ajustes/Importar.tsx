/** Importar cartolas, deshacer cada importación entera, y las reglas de categoría. */

import { dates } from '@iceberg/core';
import { deshacerLote, type Lote } from '@iceberg/db';
import { spacing } from '@iceberg/ui';
import { StyleSheet, Text, View } from 'react-native';
import { Boton } from '../Boton';
import { Seccion } from './comun';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { useLotes } from '../../datos/consultas';
import { useEstilos, type Estilo } from '../../datos/estilos';

export function Importar() {
  const styles = useEstilos(crearEstilos);
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const lotes = useLotes();

  return (
    <Seccion
      titulo="Importar"
      ayuda={'Baja la cartola desde la web de tu banco y elígela aquí. En Banco de '
        + 'Chile se llama Cartola en Excel. Verás una vista previa antes de que se '
        + 'escriba nada.\n\n'
        + 'Reimportar el mismo archivo no duplica: reconoce lo que ya está. Y cada '
        + 'importación se puede deshacer entera desde esta misma pantalla.\n\n'
        + 'Si tu banco no es Banco de Chile, igual sirve: te va a pedir que indiques '
        + 'qué columna es cuál.'}
    >
      <View style={styles.acciones}>
        <Boton etiqueta="Importar cartola" href="/importar" />
        <Boton etiqueta="Reglas de categoría" href="/reglas-categoria" />
      </View>

      {[...lotes].reverse().map((lote: Lote) => (
        <View key={lote.id} style={styles.lote}>
          <View style={styles.texto}>
            <Text style={styles.archivo} numberOfLines={1}>{lote.archivo}</Text>
            <Text style={styles.detalle}>
              {lote.cantidad} {lote.cantidad === 1 ? 'movimiento' : 'movimientos'}
              {lote.desde !== null && lote.hasta !== null
                ? ` · ${dates.formatDate(lote.desde as dates.PlainDate)} — ${dates.formatDate(lote.hasta as dates.PlainDate)}`
                : ''}
            </Text>
          </View>
          <Boton
            variante="peligro"
            etiqueta="Deshacer"
            confirmar="¿Seguro?"
            accesible={`Deshacer la importación de ${lote.archivo}`}
            onPress={() => {
              const cuantos = deshacerLote(db, contexto, lote.id);
              avisar(`Se deshizo la importación: ${cuantos} ${cuantos === 1 ? 'movimiento' : 'movimientos'}`);
            }}
          />
        </View>
      ))}
    </Seccion>
  );
}

function crearEstilos({ t }: Estilo) {
  return StyleSheet.create({
    acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    lote: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
    texto: { flex: 1, gap: 2 },
    archivo: t.cifra,
    detalle: t.etiqueta,
  });
}
