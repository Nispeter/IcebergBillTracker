/**
 * Las piezas de todo lo que se abre encima para escribir algo: movimientos,
 * cuentas, categorías, cuentas periódicas, importaciones.
 *
 * Un solo vocabulario para los seis formularios. Antes cada uno armaba su
 * encabezado, sus etiquetas y sus campos, y ya habían divergido: tres tamaños
 * de título, tres estilos de etiqueta y dos controles distintos para elegir
 * entre dos opciones.
 */

import { dates, money } from '@iceberg/core';
import { ANCHO_MAXIMO, capas, elevation, radii, spacing } from '@iceberg/ui';
import { useRouter } from 'expo-router';
import type { IconProps } from 'phosphor-react-native';
import type { ComponentType, ReactNode } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { Boton } from './Boton';
import { useEstilos, type Estilo } from '../datos/estilos';
import { volver } from '../datos/navegacion';
import { useTema } from '../datos/tema';

/**
 * El marco: título, la salida y los campos debajo, desplazables. La salida dice
 * "Cancelar" donde se descarta un borrador y "Cerrar" donde todo se guarda al
 * hacerlo.
 */
export function Formulario(
  { titulo, icono: Icono, onCancelar, salida = 'Cancelar', children }: {
    titulo: string;
    icono?: ComponentType<IconProps>;
    onCancelar: () => void;
    salida?: 'Cancelar' | 'Cerrar';
    children: ReactNode;
  },
) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  return (
    <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
      <View style={styles.encabezado}>
        {Icono === undefined ? null : <Icono size={20} weight="regular" color={theme.silencio} />}
        <Text style={styles.titulo} accessibilityRole="header">{titulo}</Text>
        <Pressable onPress={onCancelar} hitSlop={12} accessibilityRole="button">
          <Text style={styles.cancelar}>{salida}</Text>
        </Pressable>
      </View>
      {children}
    </ScrollView>
  );
}

/**
 * Una etiqueta y lo que nombra. `ayuda` aclara debajo; `aviso` dice qué está
 * mal y reemplaza a la ayuda mientras dure.
 *
 * `elevado` es para el campo cuyo desplegable está abierto: el panel compite
 * por encima solo dentro de su contexto de apilado, y sin esto los campos que
 * vienen después se dibujan sobre la lista.
 */
export function Campo(
  { etiqueta, ayuda, aviso, elevado, estilo, children }: {
    etiqueta: string;
    ayuda?: string | null;
    aviso?: string | null;
    elevado?: boolean;
    estilo?: StyleProp<ViewStyle>;
    children: ReactNode;
  },
) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={[styles.campo, elevado && styles.elevado, estilo]}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      {children}
      {aviso ? <Text style={styles.aviso}>{aviso}</Text>
        : ayuda ? <Text style={styles.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

/** El campo de texto de siempre: subrayado, sin caja. */
export function Entrada({ style, ...props }: TextInputProps) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  return (
    <TextInput
      placeholderTextColor={theme.silencio}
      {...props}
      style={[styles.entrada, style]}
    />
  );
}

/**
 * Un monto en pesos. Los puntos de miles se ponen solos mientras se escribe:
 * desde el quinto dígito, `150000` obliga a contar con el dedo.
 */
export function EntradaDeMonto(
  { etiqueta, valor, onCambiar, ayuda }: {
    etiqueta: string;
    valor: string;
    onCambiar: (valor: string) => void;
    ayuda?: string;
  },
) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  const malEscrito = valor.trim() !== '' && money.parseMoney(valor) === null;
  return (
    <Campo
      etiqueta={etiqueta}
      ayuda={ayuda}
      aviso={malEscrito ? 'No se entiende ese monto. Sin decimales: el peso no los tiene.' : null}
    >
      <View style={styles.filaMonto}>
        <Text style={styles.simbolo}>$</Text>
        <TextInput
          value={valor}
          onChangeText={(texto) => onCambiar(money.agruparMientrasSeEscribe(texto))}
          placeholder="0"
          placeholderTextColor={theme.silencio}
          keyboardType="numeric"
          inputMode="numeric"
          style={styles.entradaMonto}
          accessibilityLabel={etiqueta}
        />
      </View>
    </Campo>
  );
}

/**
 * Una fecha escrita como `AAAA-MM-DD`, con la fecha larga debajo para
 * confirmar que se leyó bien. Con `vacia`, dejarla en blanco es válido y
 * significa eso que dice.
 */
export function EntradaDeFecha(
  { etiqueta, valor, onCambiar, vacia }: {
    etiqueta: string;
    valor: string;
    onCambiar: (valor: string) => void;
    vacia?: string;
  },
) {
  const enBlanco = valor.trim() === '';
  const fecha = enBlanco ? null : dates.parsePlainDate(valor.trim());
  const aviso = enBlanco
    ? (vacia === undefined ? 'Falta la fecha.' : null)
    : fecha !== null ? null
      : vacia === undefined ? 'Fecha inválida. El formato es AAAA-MM-DD.'
        : 'Fecha inválida. El formato es AAAA-MM-DD, o déjala en blanco.';
  return (
    <Campo
      etiqueta={etiqueta}
      aviso={aviso}
      ayuda={fecha === null ? null : dates.formatDateLong(fecha)}
    >
      <Entrada
        value={valor}
        onChangeText={onCambiar}
        placeholder={vacia ?? 'AAAA-MM-DD'}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={etiqueta}
      />
    </Campo>
  );
}

export interface Opcion<T> {
  readonly valor: T;
  readonly etiqueta: string;
  readonly accesible?: string;
}

/**
 * Elegir una entre pocas. Hasta tres van unidas, como un solo control; más de
 * tres se reparten en fichas que bajan de línea cuando no caben.
 */
export function Opciones<T>(
  { opciones, valor, onElegir }: {
    opciones: readonly Opcion<T>[];
    valor: T;
    onElegir: (valor: T) => void;
  },
) {
  const styles = useEstilos(crearEstilos);
  const unidas = opciones.length <= 3;
  return (
    <View style={unidas ? styles.unidas : styles.fichas} accessibilityRole="radiogroup">
      {opciones.map((opcion, indice) => {
        const elegida = opcion.valor === valor;
        return (
          <Pressable
            key={String(opcion.valor)}
            onPress={() => onElegir(opcion.valor)}
            style={[
              unidas ? styles.segmento : styles.ficha,
              unidas && indice > 0 && styles.segmentoConBorde,
              elegida && styles.elegida,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ checked: elegida }}
            accessibilityLabel={opcion.accesible ?? opcion.etiqueta}
          >
            <Text style={elegida ? styles.opcionElegida : styles.opcion} numberOfLines={1}>
              {opcion.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Un campo con su botón al lado, para agregar cosas de a una. Enter también agrega. */
export function Agregador(
  { valor, onCambiar, onAgregar, placeholder, accesible, autoCapitalize = 'none' }: {
    valor: string;
    onCambiar: (valor: string) => void;
    onAgregar: () => void;
    placeholder: string;
    /** Qué es lo que se escribe, para el lector de pantalla. */
    accesible: string;
    autoCapitalize?: TextInputProps['autoCapitalize'];
  },
) {
  const styles = useEstilos(crearEstilos);
  const vacio = valor.trim() === '';
  return (
    <View style={styles.agregador}>
      <Entrada
        value={valor}
        onChangeText={onCambiar}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        onSubmitEditing={() => { if (!vacio) onAgregar(); }}
        returnKeyType="done"
        style={styles.entradaDelAgregador}
        accessibilityLabel={accesible}
      />
      <Boton etiqueta="Agregar" onPress={onAgregar} deshabilitado={vacio} accesible={`Agregar: ${accesible}`} />
    </View>
  );
}

/** Lo que salió mal al guardar. */
export function ErrorDelFormulario({ error }: { error?: string | null }) {
  const styles = useEstilos(crearEstilos);
  return error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null;
}

/** Para cuando se abre algo que ya se borró, desde otro teléfono o desde atrás. */
export function NoExiste({ mensaje }: { mensaje: string }) {
  const styles = useEstilos(crearEstilos);
  const router = useRouter();
  return (
    <View style={styles.noExiste}>
      <Text style={styles.titulo}>{mensaje}</Text>
      <Boton variante="texto" etiqueta="Volver" onPress={() => volver(router)} />
    </View>
  );
}

function crearEstilos({ theme, t, letra }: Estilo) {
  const subrayado = {
    borderBottomWidth: elevation.hairlineWidth,
    borderBottomColor: theme.hairline,
  } as const;

  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      maxWidth: ANCHO_MAXIMO,
      width: '100%',
      alignSelf: 'center',
      gap: spacing.xl,
    },
    encabezado: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: spacing.xl,
    },
    titulo: { ...t.titulo, flex: 1 },
    cancelar: { ...t.cuerpo, fontWeight: t.accion.fontWeight, color: theme.silencio },

    campo: { gap: spacing.sm },
    elevado: { zIndex: capas.desplegable },
    etiqueta: { ...t.etiqueta, fontWeight: t.accion.fontWeight },
    ayuda: { ...t.nota, lineHeight: letra.px(17) },
    aviso: { ...t.nota, lineHeight: letra.px(17), color: theme.vencidoTexto },
    error: t.error,

    entrada: { ...t.cuerpo, fontSize: letra.md, ...subrayado, paddingVertical: spacing.sm },
    filaMonto: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      ...subrayado,
      paddingBottom: spacing.sm,
    },
    simbolo: { ...t.cifraGrande, fontSize: letra.lg, color: theme.silencio },
    entradaMonto: { ...t.cifraGrande, flex: 1, fontSize: letra.px(34), padding: 0 },

    unidas: {
      flexDirection: 'row',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    segmento: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
    segmentoConBorde: { borderLeftWidth: elevation.hairlineWidth, borderLeftColor: theme.hairline },
    fichas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    ficha: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    elegida: { backgroundColor: theme.tinta, borderColor: theme.tinta },
    opcion: { ...t.cuerpo, color: theme.silencio },
    opcionElegida: { ...t.cuerpo, fontWeight: t.seccion.fontWeight, color: theme.fondo },

    agregador: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    entradaDelAgregador: { flex: 1 },

    noExiste: { flex: 1, padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.md },
  });
}
