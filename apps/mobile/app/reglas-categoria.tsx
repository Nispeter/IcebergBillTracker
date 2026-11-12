/**
 * Reglas propias de categorización: "si dice X, es Y".
 *
 * El catálogo de la app reconoce el 60 % de los comercios; el resto son
 * negocios chicos que solo uno sabe clasificar. Lo que hace usable esta
 * pantalla es ofrecer los nombres sin categoría que más se repiten: escribir
 * patrones de memoria es pedirle a alguien que no la use.
 */

import { rules } from '@iceberg/core';
import {
  aplicarCategorias, borrarReglaDeCategoria, crearReglaDeCategoria,
  sinCategoriaQueSeReconocen, type ReglaCategoria,
} from '@iceberg/db';
import { spacing } from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Boton, BotonDeIcono } from '../components/Boton';
import { Campo, Entrada, ErrorDelFormulario, Formulario } from '../components/Formulario';
import { iconoDeCategoria } from '../components/iconos';
import { PantallaModal } from '../components/PantallaModal';
import { Desplegable, useOpcionesDeCategoria } from '../components/SelectorDesplegable';
import { Titulo } from '../components/Titulo';
import { useAvisar } from '../datos/aviso';
import { useDatos } from '../datos/BaseDeDatos';
import { useCategorias } from '../datos/catalogo';
import { useMovimientos, useReglasDeCategoria } from '../datos/consultas';
import { useEstilos, type Estilo } from '../datos/estilos';
import { volver } from '../datos/navegacion';
import { useTema } from '../datos/tema';

/** Cuántos nombres sin reconocer se ofrecen. Más que esto es una lista, no una ayuda. */
const SUGERENCIAS = 8;

export default function ReglasDeCategoria() {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  const categorias = useCategorias();
  const opciones = useOpcionesDeCategoria();
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const router = useRouter();

  const reglas = useReglasDeCategoria();
  const movimientos = useMovimientos();

  const [patron, setPatron] = useState('');
  const [categoriaId, setCategoriaId] = useState('comida');
  const [eligiendo, setEligiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Los gastos que hoy nadie sabe clasificar, agrupados por nombre. */
  const sinReconocer = useMemo(() => {
    const catalogo = [
      ...reglas.map((r) => ({ patron: r.patron, categoriaId: r.categoriaId })),
      ...rules.REGLAS_CHILE,
    ];
    const cuenta = new Map<string, number>();
    for (const movimiento of movimientos) {
      if (movimiento.tipo !== 'gasto' || movimiento.categoriaId !== null) continue;
      if (rules.categorizar(movimiento.nombre, catalogo) !== null) continue;
      const clave = rules.normalizar(movimiento.nombre);
      if (clave === '') continue;
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }
    return [...cuenta.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, SUGERENCIAS);
  }, [movimientos, reglas]);

  // `reglas` y `movimientos` no se usan adentro, pero cuando cambian la cuenta cambia.
  const porAplicar = useMemo(
    () => sinCategoriaQueSeReconocen(db, contexto).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, contexto, reglas, movimientos],
  );

  function agregar() {
    try {
      crearReglaDeCategoria(db, contexto, { patron, categoriaId });
      avisar('Regla guardada');
      setPatron('');
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function aplicar() {
    const cuantos = aplicarCategorias(db, contexto);
    avisar(`${cuantos} ${cuantos === 1 ? 'movimiento categorizado' : 'movimientos categorizados'}`);
  }

  return (
    <PantallaModal>
      <Formulario titulo="Reglas de categoría" salida="Cerrar" onCancelar={() => volver(router)}>
        <Text style={styles.ayuda}>
          Si la descripción contiene el texto, el gasto va a esa categoría. Se aplica a lo que
          importes y a lo que ya está sin clasificar.
        </Text>

        <Campo etiqueta="Si dice">
          <Entrada
            value={patron}
            onChangeText={setPatron}
            placeholder="comercial alexis"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Texto del patrón"
          />
        </Campo>

        {/* Elevado siempre: es el único desplegable de la pantalla. */}
        <Campo etiqueta="Es" elevado>
          <Desplegable
            abierto={eligiendo}
            onAlternar={() => setEligiendo(!eligiendo)}
            etiqueta={categorias.nombreCorto(categoriaId)}
            icono={iconoDeCategoria(categoriaId)}
            activo
            accesible={`Categoría ${categorias.nombre(categoriaId)}. Tocar para cambiar`}
            opciones={opciones}
            valor={categoriaId}
            onElegir={(valor) => { setCategoriaId(valor); setEligiendo(false); }}
          />
        </Campo>

        <ErrorDelFormulario error={error} />

        <Boton
          variante="principal"
          etiqueta="Agregar regla"
          onPress={agregar}
          deshabilitado={patron.trim() === ''}
        />

        {porAplicar > 0 ? (
          <Boton
            etiqueta={`Categorizar ${porAplicar} ${porAplicar === 1
              ? 'movimiento que ya está'
              : 'movimientos que ya están'}`}
            accesible="Aplicar las reglas a los movimientos sin categoría"
            onPress={aplicar}
          />
        ) : null}

        {sinReconocer.length > 0 ? (
          <View>
            <Titulo
              primero
              texto="Sin clasificar, los más repetidos"
              ayuda="Toca uno para usarlo como patrón. Conviene acortarlo a lo que se repite."
            />
            {sinReconocer.map(([nombre, veces]) => (
              <Pressable
                key={nombre}
                onPress={() => setPatron(nombre)}
                style={({ pressed }) => [styles.fila, pressed && styles.apretada]}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${nombre} como patrón`}
              >
                <Text style={styles.patron} numberOfLines={1}>{nombre}</Text>
                <Text style={styles.veces}>{veces}×</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {reglas.length > 0 ? (
          <View>
            <Titulo primero texto="Tus reglas" />
            {reglas.map((regla: ReglaCategoria) => {
              const Icono = iconoDeCategoria(regla.categoriaId);
              return (
                <View key={regla.id} style={styles.fila}>
                  <Text style={styles.patron} numberOfLines={1}>{regla.patron}</Text>
                  <Icono size={13} weight="regular" color={theme.silencio} />
                  <Text style={styles.categoria}>{categorias.nombreCorto(regla.categoriaId)}</Text>
                  <BotonDeIcono
                    icono={Trash}
                    tamano={16}
                    onPress={() => borrarReglaDeCategoria(db, contexto, regla.id)}
                    accesible={`Borrar la regla ${regla.patron}`}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </Formulario>
    </PantallaModal>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    ayuda: { ...t.nota, lineHeight: t.cuerpo.fontSize + 4 },
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    apretada: { opacity: 0.6 },
    patron: { ...t.cifra, flex: 1 },
    veces: { ...t.cifraDeGrafico },
    categoria: { ...t.etiqueta, color: theme.silencio },
  });
}
