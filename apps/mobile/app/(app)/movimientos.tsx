/**
 * El listado completo de movimientos, con filtros y por tandas.
 *
 * El filtro viaja a SQL; el encabezado sale de un agregado y no de contar las
 * filas traídas; y es una `FlatList`, que solo dibuja lo que se ve.
 */

import { money } from '@iceberg/core';
import type { FiltroDeMovimientos, Movimiento, TipoDeMovimiento } from '@iceberg/db';
import { capas, columna, spacing } from '@iceberg/ui';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Anteriores } from '../../components/Anteriores';
import { Ayuda } from '../../components/Ayuda';
import { Boton } from '../../components/Boton';
import { ConDesplegable } from '../../components/ConDesplegable';
import { EXPLICACION_ANOMALIA, FilaMovimiento } from '../../components/FilaMovimiento';
import { iconoDeCategoria } from '../../components/iconos';
import { Pantalla } from '../../components/Pantalla';
import {
  ChipDisparador, ListaDeOpciones, useOpcionesDeCategoria,
} from '../../components/SelectorDesplegable';
import { Vacio } from '../../components/Vacio';
import { useCategorias } from '../../datos/catalogo';
import { useAnomalias, useMovimientosFiltrados, useResumenDeFiltro } from '../../datos/consultas';
import { useAireInferior } from '../../datos/desplazamiento';
import { useEstilos, type Estilo } from '../../datos/estilos';
import { usePeriodo } from '../../datos/periodo';

/**
 * Cuántos se traen por tanda. `null` es "todos": la consulta va sin `LIMIT`, y
 * aguanta porque la lista es virtual y el encabezado sale de un `SUM` aparte.
 */
const TANDAS: readonly { valor: number | null; etiqueta: string }[] = [
  { valor: 25, etiqueta: '25 por tanda' },
  { valor: 40, etiqueta: '40 por tanda' },
  { valor: 100, etiqueta: '100 por tanda' },
  { valor: null, etiqueta: 'Todos de una vez' },
];

const TANDA_INICIAL = 40;

const TIPOS: readonly { valor: TipoDeMovimiento | null; etiqueta: string }[] = [
  { valor: null, etiqueta: 'Todos los movimientos' },
  { valor: 'gasto', etiqueta: 'Solo gastos' },
  { valor: 'ingreso', etiqueta: 'Solo ingresos' },
];

type Desplegable = 'tipo' | 'categoria' | 'tanda' | null;

export default function Movimientos() {
  const styles = useEstilos(crearEstilos);
  const aireInferior = useAireInferior();
  const categorias = useCategorias();
  const opcionesDeCategoria = useOpcionesDeCategoria('Todas las categorías');
  const { rango } = usePeriodo();
  // Se llega desde una categoría o desde un día del calendario: precargan el filtro.
  const params = useLocalSearchParams<{ categoria?: string; dia?: string }>();

  const [tipo, setTipo] = useState<TipoDeMovimiento | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(params.categoria ?? null);
  const [abierto, setAbierto] = useState<Desplegable>(null);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState<number | null>(TANDA_INICIAL);

  const filtro = useMemo<FiltroDeMovimientos>(
    () => ({
      // Dentro del período global, como el resto de las vistas.
      desde: params.dia ? (params.dia as never) : rango.start,
      hasta: params.dia ? (params.dia as never) : rango.end,
      ...(tipo === null ? {} : { tipo }),
      ...(categoriaId === null ? {} : { categoriaId }),
    }),
    [tipo, categoriaId, rango.start, rango.end, params.dia],
  );

  const movimientos = useMovimientosFiltrados(
    useMemo(
      () => (porPagina === null ? filtro : { ...filtro, limite: pagina * porPagina }),
      [filtro, pagina, porPagina],
    ),
  );
  const resumen = useResumenDeFiltro(filtro);
  const anomalias = useAnomalias();
  const hayMas = movimientos.length < resumen.cantidad;
  const hayFiltros = tipo !== null || categoriaId !== null;

  // Cambiar de filtro o de tanda vuelve a la primera página: si no, se vería un tramo suelto.
  const cambiar = useCallback((accion: () => void) => {
    accion();
    setPagina(1);
    setAbierto(null);
  }, []);

  const alternar = (cual: Exclude<Desplegable, null>) => setAbierto(abierto === cual ? null : cual);

  const encabezado = (
    // Elevado para que el panel de un filtro tape las filas que vienen después.
    <View style={styles.encabezado}>
      <View style={styles.cabecera}>
        <Text style={styles.resumen}>
          {resumen.cantidad} {resumen.cantidad === 1 ? 'movimiento' : 'movimientos'}
          {' · '}{money.formatSigned(resumen.neto)}
        </Text>
        <Ayuda titulo="Movimientos fuera de lo habitual" texto={EXPLICACION_ANOMALIA} />
      </View>

      {/* Los disparadores en una línea y un solo panel encima a lo ancho:
          abrir un filtro no puede empujar la lista. */}
      <ConDesplegable
        abierto={abierto !== null}
        disparador={(
          <View style={styles.filtros}>
            <ChipDisparador
              etiqueta={tipo === null ? 'Todos' : tipo === 'gasto' ? 'Gastos' : 'Ingresos'}
              abierto={abierto === 'tipo'}
              activo={tipo !== null}
              onPress={() => alternar('tipo')}
              accesible="Filtrar por tipo"
            />
            <ChipDisparador
              etiqueta={categoriaId === null ? 'Categoría' : categorias.nombreCorto(categoriaId)}
              icono={categoriaId === null ? null : iconoDeCategoria(categoriaId)}
              abierto={abierto === 'categoria'}
              activo={categoriaId !== null}
              onPress={() => alternar('categoria')}
              accesible="Filtrar por categoría"
            />
            {/* Con los filtros y no al pie: es cómo se ve el listado, y al pie
                habría que desplazar hasta el final para cambiarlo. */}
            <ChipDisparador
              etiqueta={porPagina === null ? 'Todos de una vez' : `${porPagina} por tanda`}
              abierto={abierto === 'tanda'}
              activo={porPagina !== TANDA_INICIAL}
              onPress={() => alternar('tanda')}
              accesible="Cuántos movimientos traer por tanda"
            />
          </View>
        )}
        panel={abierto === 'tanda' ? (
          <ListaDeOpciones
            opciones={TANDAS}
            seleccionado={porPagina}
            onElegir={(valor) => cambiar(() => setPorPagina(valor))}
          />
        ) : abierto === 'tipo' ? (
          <ListaDeOpciones
            opciones={TIPOS}
            seleccionado={tipo}
            onElegir={(valor) => cambiar(() => setTipo(valor))}
          />
        ) : (
          <ListaDeOpciones
            opciones={opcionesDeCategoria}
            seleccionado={categoriaId}
            onElegir={(valor) => cambiar(() => setCategoriaId(valor))}
          />
        )}
      />
    </View>
  );

  return (
    <Pantalla titulo="Movimientos">
      {/* Fuera de la lista y no en su `ListHeaderComponent`: FlatList envuelve
          el encabezado en un contexto de apilado que deja el panel debajo de
          las filas. De paso los filtros quedan fijos al desplazar. */}
      <View style={styles.fijo}>{encabezado}</View>
      <FlatList
        data={movimientos}
        keyExtractor={(tx) => tx.id}
        renderItem={({ item }: { item: Movimiento }) => (
          <FilaMovimiento tx={item} anomala={anomalias.has(item.id)} />
        )}
        ListEmptyComponent={hayFiltros ? (
          <Vacio texto="Ningún movimiento con esos filtros.">
            <Boton
              variante="texto"
              etiqueta="Quitar los filtros"
              onPress={() => cambiar(() => { setTipo(null); setCategoriaId(null); })}
            />
          </Vacio>
        ) : <Vacio texto="Sin movimientos en este período." />}
        ListFooterComponent={(
          <>
            {hayMas ? (
              <Boton
                etiqueta={`Ver más · ${movimientos.length} de ${resumen.cantidad}`}
                accesible="Ver más movimientos"
                onPress={() => setPagina(pagina + 1)}
                estilo={styles.verMas}
              />
            ) : resumen.cantidad === 0 ? null : (
              <Text style={styles.pie}>{resumen.cantidad} en total</Text>
            )}
            {/* `Anteriores` mira el período, no el filtro: va al pie y no en el vacío. */}
            <Anteriores />
          </>
        )}
        // Al llegar al final se trae la tanda siguiente sola; el botón queda
        // para quien prefiera pedirla.
        onEndReached={() => { if (hayMas) setPagina((actual) => actual + 1); }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}
        keyboardShouldPersistTaps="handled"
      />
    </Pantalla>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    contenido: columna,
    fijo: { ...columna, zIndex: capas.desplegable },
    encabezado: { zIndex: capas.desplegable, paddingBottom: spacing.lg },
    // La `i` junto a lo que explica, no al otro extremo.
    cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    resumen: { ...t.cifra, fontSize: t.cuerpo.fontSize, color: theme.silencio },
    filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    verMas: { alignSelf: 'stretch', marginTop: spacing.lg },
    pie: { ...t.etiqueta, textAlign: 'center', marginTop: spacing.xl },
  });
}
