/**
 * La barra de período: flechas para moverse y el nombre al medio. Es una línea
 * porque es marco, no contenido. El tipo se elige tocando el nombre; después
 * se navega con las flechas, que es lo que se hace casi siempre.
 */

import { dates } from '@iceberg/core';
import { elevation, holguraDeToque, radii, spacing } from '@iceberg/ui';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// El de gesture-handler: dentro del scroll de la pantalla, el nativo cede el gesto.
import { ScrollView } from 'react-native-gesture-handler';
import { Boton } from './Boton';
import { ConDesplegable } from './ConDesplegable';
import { useEstilos, type Estilo } from '../datos/estilos';
import { TIPOS, nombreDePeriodo, usePeriodo, type TipoDePeriodo } from '../datos/periodo';
import { useTema } from '../datos/tema';

/** Lo que mide una flecha con su relleno. */
const FLECHA = 21;

export function BarraDePeriodo(
  { permitirFuturo }: {
    /**
     * Deja avanzar más allá del período de hoy. Por omisión la flecha se apaga
     * ahí, para no pasear por meses vacíos; Témpanos sí mira hacia adelante.
     */
    permitirFuturo?: boolean;
  },
) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  const periodo = usePeriodo();
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState<string>(periodo.rango.start);
  const [hasta, setHasta] = useState<string>(periodo.rango.end);

  const desdeOk = dates.parsePlainDate(desde);
  const hastaOk = dates.parsePlainDate(hasta);
  const rangoValido = desdeOk !== null && hastaOk !== null && desdeOk <= hastaOk;
  const frenado = periodo.esElActual && permitirFuturo !== true;
  const nombre = nombreDePeriodo(periodo.tipo, periodo.rango);

  const elegir = (tipo: TipoDePeriodo) => {
    if (tipo === 'custom') {
      setDesde(periodo.rango.start);
      setHasta(periodo.rango.end);
      periodo.cambiarTipo('custom');
      return;
    }
    periodo.cambiarTipo(tipo);
    setAbierto(false);
  };

  const barra = (
    <View style={styles.barra}>
      <Pressable
        onPress={periodo.anterior}
        style={styles.flecha}
        accessibilityRole="button"
        accessibilityLabel="Período anterior"
        hitSlop={holguraDeToque(FLECHA)}
      >
        <CaretLeft size={13} weight="bold" color={theme.tinta} />
      </Pressable>

      <Pressable
        onPress={() => setAbierto(!abierto)}
        style={styles.centro}
        hitSlop={holguraDeToque(FLECHA)}
        accessibilityRole="button"
        accessibilityLabel={`${nombre}. Tocar para cambiar el período`}
        accessibilityState={{ expanded: abierto }}
      >
        <Text style={styles.nombre} numberOfLines={1}>{nombre}</Text>
        <CaretDown size={10} weight="bold" color={theme.silencio} />
      </Pressable>

      <Pressable
        onPress={periodo.siguiente}
        style={styles.flecha}
        disabled={frenado}
        accessibilityRole="button"
        accessibilityLabel="Período siguiente"
        accessibilityState={{ disabled: frenado }}
        hitSlop={holguraDeToque(FLECHA)}
      >
        <CaretRight size={13} weight="bold" color={frenado ? theme.hairline : theme.tinta} />
      </Pressable>
    </View>
  );

  return (
    <ConDesplegable
      abierto={abierto}
      disparador={barra}
      panel={(
        // Desplazable: con el rango libre abierto pide unos 390 px y en un
        // teléfono chico no entra.
        <ScrollView style={styles.panel} nestedScrollEnabled>
          {TIPOS.map((tipo, indice) => {
            const activo = tipo.valor === periodo.tipo;
            return (
              <Pressable
                key={tipo.valor}
                onPress={() => elegir(tipo.valor)}
                style={[styles.opcion, indice > 0 && styles.opcionConLinea]}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
              >
                <Text style={activo ? styles.opcionActiva : styles.opcionTexto}>{tipo.etiqueta}</Text>
                {activo ? <Check size={12} weight="bold" color={theme.acentoTexto} /> : null}
              </Pressable>
            );
          })}

          {periodo.tipo === 'custom' ? (
            <View style={styles.libre}>
              <View style={styles.campos}>
                <TextInput
                  value={desde}
                  onChangeText={setDesde}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={theme.silencio}
                  style={[styles.entrada, desdeOk === null && styles.entradaMala]}
                  autoCapitalize="none"
                  accessibilityLabel="Desde"
                />
                <Text style={styles.guion}>—</Text>
                <TextInput
                  value={hasta}
                  onChangeText={setHasta}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={theme.silencio}
                  style={[styles.entrada, hastaOk === null && styles.entradaMala]}
                  autoCapitalize="none"
                  accessibilityLabel="Hasta"
                />
              </View>
              <Boton
                variante="principal"
                etiqueta={rangoValido
                  ? `Aplicar · ${dates.daysBetween(desdeOk, hastaOk) + 1} días`
                  : 'Fechas inválidas'}
                accesible="Aplicar rango"
                deshabilitado={!rangoValido}
                onPress={() => {
                  if (!rangoValido) return;
                  periodo.fijarRango(desdeOk, hastaOk);
                  setAbierto(false);
                }}
              />
            </View>
          ) : null}

          {!periodo.esElActual ? (
            <Pressable
              onPress={() => { periodo.alDia(); setAbierto(false); }}
              style={[styles.opcion, styles.opcionConLinea]}
              accessibilityRole="button"
            >
              <Text style={styles.volver}>Volver a hoy</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    />
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    // Centrada y no estirada: las flechas al lado del nombre, no en los bordes.
    barra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    flecha: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
    centro: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    nombre: { ...t.etiqueta, fontWeight: t.seccion.fontWeight, color: theme.tinta },

    panel: {
      marginTop: spacing.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      borderRadius: radii.sm,
      backgroundColor: theme.superficie,
    },
    opcion: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    opcionConLinea: { borderTopWidth: elevation.hairlineWidth, borderTopColor: theme.hairline },
    opcionTexto: t.cuerpo,
    opcionActiva: { ...t.cuerpo, fontWeight: t.seccion.fontWeight },
    volver: t.accion,

    libre: {
      padding: spacing.md,
      gap: spacing.sm,
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
    },
    campos: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    entrada: {
      ...t.cifra,
      flex: 1,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: 4,
    },
    entradaMala: { borderBottomColor: theme.vencidoTexto },
    guion: { ...t.cifra, color: theme.silencio },
  });
}
