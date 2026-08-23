/**
 * Reglas propias de categorización: "si dice X, es Y".
 *
 * El catálogo que trae la app reconoce el 60 % de las filas que tienen un
 * comercio. El resto son negocios chicos que solo tú sabes clasificar, y
 * escribir la regla una vez es mucho mejor que categorizar el mismo almacén
 * todos los meses.
 *
 * La pantalla ofrece **los nombres que más se repiten sin categoría**: es lo que
 * convierte esto en algo usable. Pedirle a alguien que escriba patrones de
 * memoria, mirando una lista de 700 movimientos en otra pantalla, es pedirle que
 * no lo use.
 */

import { rules } from '@iceberg/core';
import {
  aplicarCategorias, borrarReglaDeCategoria, crearReglaDeCategoria,
  sinCategoriaQueSeReconocen, type ReglaCategoria,
} from '@iceberg/db';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ConDesplegable } from '../components/ConDesplegable';
import { ChipDisparador, ListaDeOpciones } from '../components/SelectorDesplegable';
import { iconoDeCategoria } from '../components/iconos';
import { useAvisar } from '../datos/aviso';
import { useDatos } from '../datos/BaseDeDatos';
import { useMovimientos, useReglasDeCategoria } from '../datos/consultas';
import { volver } from '../datos/navegacion';
import { useTema } from '../datos/tema';
import { PantallaModal } from '../components/PantallaModal';
import { useCategorias } from '../datos/catalogo';

/** Cuantos nombres sin reconocer se ofrecen. Mas que esto es una lista, no una ayuda. */
const SUGERENCIAS = 8;

export default function ReglasDeCategoria() {
  const { theme } = useTema();
  const styles = crearEstilos(theme);
  const categorias = useCategorias();
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const router = useRouter();

  const reglas = useReglasDeCategoria();
  const movimientos = useMovimientos();

  const [patron, setPatron] = useState('');
  const [categoriaId, setCategoriaId] = useState<string>('comida');
  const [eligiendo, setEligiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

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

  const porAplicar = useMemo(
    () => sinCategoriaQueSeReconocen(db, contexto).length,
    // Se recalcula cuando cambian las reglas o los movimientos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, contexto, reglas, movimientos],
  );

  const opciones = useMemo(
    () => categorias.todas.map((c) => ({
      valor: c.id, etiqueta: c.nombre, icono: iconoDeCategoria(c.id),
    })),
    [],
  );

  function agregar(texto: string) {
    try {
      crearReglaDeCategoria(db, contexto, { patron: texto, categoriaId });
      avisar('Regla guardada');
      setPatron('');
      setAviso(null);
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Reglas de categoría</Text>
          <Pressable onPress={() => volver(router)} accessibilityRole="button">
            <Text style={styles.cancelar}>Cerrar</Text>
          </Pressable>
        </View>

        <Text style={styles.ayuda}>
          Si la descripción contiene el texto, el gasto va a esa categoría. Se aplica a lo
          que importes y a lo que ya está sin clasificar.
        </Text>

        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Si dice</Text>
          <TextInput
            value={patron}
            onChangeText={setPatron}
            placeholder="comercial alexis"
            placeholderTextColor={theme.silencio}
            style={styles.entrada}
            autoCapitalize="none"
            accessibilityLabel="Texto del patrón"
          />
        </View>

        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Es</Text>
          <ConDesplegable
            abierto={eligiendo}
            disparador={(
              <View style={styles.filaChip}>
                <ChipDisparador
                  theme={theme}
                  etiqueta={categorias.nombreCorto(categoriaId)}
                  icono={iconoDeCategoria(categoriaId)}
                  abierto={eligiendo}
                  activo
                  onPress={() => setEligiendo(!eligiendo)}
                  accesible={`Categoría ${categorias.nombre(categoriaId)}. Tocar para cambiar`}
                />
              </View>
            )}
            panel={(
              <ListaDeOpciones
                theme={theme}
                opciones={opciones}
                seleccionado={categoriaId}
                onElegir={(valor: string) => {
                  setCategoriaId(valor);
                  setEligiendo(false);
                }}
              />
            )}
          />
        </View>

        <Pressable
          onPress={() => agregar(patron)}
          disabled={patron.trim() === ''}
          style={[styles.guardar, patron.trim() === '' && styles.apagado]}
          accessibilityRole="button"
          accessibilityLabel="Agregar regla"
        >
          <Text style={styles.guardarTexto}>Agregar regla</Text>
        </Pressable>

        {aviso === null ? null : <Text style={styles.error}>{aviso}</Text>}

        {porAplicar > 0 ? (
          <Pressable
            onPress={() => {
              const cuantos = aplicarCategorias(db, contexto);
              setAviso(`${cuantos} ${cuantos === 1 ? 'movimiento categorizado' : 'movimientos categorizados'}.`);
            }}
            style={styles.aplicar}
            accessibilityRole="button"
            accessibilityLabel="Aplicar a los movimientos sin categoría"
          >
            <Text style={styles.aplicarTexto}>
              Categorizar {porAplicar}{' '}
              {porAplicar === 1 ? 'movimiento que ya está' : 'movimientos que ya están'}
            </Text>
          </Pressable>
        ) : null}

        {sinReconocer.length > 0 ? (
          <>
            <Text style={styles.seccion}>Sin clasificar, los más repetidos</Text>
            <Text style={styles.ayuda}>
              Toca uno para usarlo como patrón. Conviene acortarlo a lo que se repite.
            </Text>
            {sinReconocer.map(([nombre, veces]) => (
              <Pressable
                key={nombre}
                onPress={() => setPatron(nombre)}
                style={styles.sugerencia}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${nombre} como patrón`}
              >
                <Text style={styles.sugerenciaTexto} numberOfLines={1}>{nombre}</Text>
                <Text style={styles.veces}>{veces}×</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {reglas.length > 0 ? (
          <>
            <Text style={styles.seccion}>Tus reglas</Text>
            {reglas.map((regla: ReglaCategoria) => {
              const Icono = iconoDeCategoria(regla.categoriaId);
              return (
                <View key={regla.id} style={styles.fila}>
                  <Text style={styles.patron} numberOfLines={1}>{regla.patron}</Text>
                  <Icono size={13} weight="regular" color={theme.silencio} />
                  <Text style={styles.categoria}>
                    {categorias.nombreCorto(regla.categoriaId)}
                  </Text>
                  <Pressable
                    onPress={() => borrarReglaDeCategoria(db, contexto, regla.id)}
                    style={styles.borrar}
                    accessibilityRole="button"
                    accessibilityLabel={`Borrar la regla ${regla.patron}`}
                    hitSlop={8}
                  >
                    <Trash size={13} weight="regular" color={theme.vencidoTexto} />
                  </Pressable>
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </PantallaModal>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
      gap: spacing.md,
    },
    encabezado: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.xxl,
    },
    titulo: { fontFamily: fonts.texto, fontWeight: pesos.bold, fontSize: fontSizes.xl, color: theme.tinta },
    cancelar: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.silencio },
    ayuda: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, lineHeight: 18, color: theme.silencio },

    campo: { gap: spacing.xs },
    etiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    entrada: {
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: fontSizes.md,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
    },
    filaChip: { flexDirection: 'row' },

    guardar: {
      backgroundColor: theme.acento,
      borderRadius: radii.sm,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    apagado: { opacity: 0.4 },
    guardarTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.sobreAcento },
    aplicar: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    aplicarTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    error: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },

    seccion: {
      fontFamily: fonts.texto,
      fontWeight: pesos.semibold,
      fontSize: fontSizes.xs,
      color: theme.tinta,
      paddingTop: spacing.lg,
    },
    sugerencia: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    sugerenciaTexto: { flex: 1, fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    veces: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },

    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    patron: { flex: 1, fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    categoria: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    borrar: { padding: 2 },
  });
}
