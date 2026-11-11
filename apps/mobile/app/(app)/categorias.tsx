/**
 * Categorías: en qué se me va la plata en este período. La torta dice qué parte
 * del total; las barras, cuánto más que la siguiente.
 *
 * Apagar una categoría la saca del reparto para ver cómo se reparte el resto
 * cuando una sola se lleva casi todo. Es estado de la pantalla, no preferencia:
 * se apaga, se mira y vuelve al salir. La escala de las barras sale de la lista
 * completa, para que la fila apagada siga diciendo cuánto era lo que se sacó.
 *
 * La casilla vive solo en la lista completa. Cuando estuvo también en la leyenda
 * de la torta, cada apagada se quedaba al final de la leyenda para poder volver
 * a prenderla, y empujaba el resto de la pantalla hacia abajo.
 *
 * Tocar una categoría lleva a sus movimientos; configurarla vive en Ajustes.
 */

import { analytics, dates, money } from '@iceberg/core';
import { columna, holguraDeToque, niceUnit, notchesFor, spacing } from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { CheckSquare } from 'phosphor-react-native/src/icons/CheckSquare';
import { Square } from 'phosphor-react-native/src/icons/Square';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Anteriores } from '../../components/Anteriores';
import { BarraSegmentada } from '../../components/BarraSegmentada';
import { Boton } from '../../components/Boton';
import { Creditos } from '../../components/Creditos';
import { Hoja } from '../../components/Hoja';
import { iconoDeCategoria } from '../../components/iconos';
import { Pantalla } from '../../components/Pantalla';
import { QueCambio } from '../../components/QueCambio';
import { Titulo } from '../../components/Titulo';
import { TortaDeCategorias } from '../../components/TortaDeCategorias';
import { useCategorias } from '../../datos/catalogo';
import { useAnalisisDeRango } from '../../datos/consultas';
import { useAireInferior } from '../../datos/desplazamiento';
import { useEstilo, useEstilos, type Estilo } from '../../datos/estilos';
import { nombreDePeriodo, usePeriodo } from '../../datos/periodo';

/** Seis toques al pingüino de la torta abren los créditos: es para el que insiste. */
const TOQUES_PARA_LOS_CREDITOS = 6;

const CASILLA = 16;

export default function Categorias() {
  const styles = useEstilos(crearEstilos);
  const { theme } = useEstilo();
  const aireInferior = useAireInferior();
  const categorias = useCategorias();
  const { tipo, rango, corte } = usePeriodo();
  const router = useRouter();
  const [toquesAlPinguino, setToquesAlPinguino] = useState(0);
  const [creditos, setCreditos] = useState(false);

  const a = useAnalisisDeRango(rango, corte);
  // Va detrás de "vs." en medio de una frase: sin la mayúscula de título.
  const referencia = useMemo(() => {
    const nombre = nombreDePeriodo(tipo, dates.previousPeriod(rango));
    return nombre.charAt(0).toLowerCase() + nombre.slice(1);
  }, [tipo, rango]);
  const unidad = niceUnit(a.mayorCategoria);
  const muescas = notchesFor(a.mayorCategoria, unidad);

  const [apagadas, setApagadas] = useState<ReadonlySet<string>>(() => new Set());
  const alternar = (categoriaId: string) => setApagadas((previas) => {
    const siguientes = new Set(previas);
    if (!siguientes.delete(categoriaId)) siguientes.add(categoriaId);
    return siguientes;
  });
  // De las que se ven: al cambiar de período, ids que ya no están no cuentan.
  const hayApagadas = a.porCategoria.some((p) => apagadas.has(p.categoriaId));

  const verMovimientos = (categoriaId: string) =>
    router.push({ pathname: '/movimientos', params: { categoria: categoriaId } });

  // "Sin categoría" es una clave interna, no un id del catálogo.
  const idDelCatalogo = (categoriaId: string) =>
    (categoriaId === analytics.SIN_CATEGORIA ? undefined : categoriaId);

  return (
    <Pantalla titulo="Categorías">
      <ScrollView contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}>
        <Titulo
          primero
          texto="Reparto del gasto"
          ayuda={'Las cinco categorías más grandes llevan color propio; el resto se '
            + 'junta en "Otras" porque doce porciones no se distinguen. Los porcentajes '
            + 'son sobre el gasto del período, no sobre el total del año.\n\n'
            + 'Las casillas de "Todas las categorías", más abajo, sacan una del reparto '
            + 'y la torta se rehace sobre las que quedan, que es la forma de ver cómo se '
            + 'reparte el resto cuando una sola se lleva casi todo. Las apagadas no '
            + 'aparecen acá.'}
        />
        <TortaDeCategorias
          porciones={a.porCategoria}
          apagadas={apagadas}
          onElegir={verMovimientos}
          onTocarPinguino={() => {
            const van = toquesAlPinguino + 1;
            setToquesAlPinguino(van);
            if (van === TOQUES_PARA_LOS_CREDITOS) setCreditos(true);
          }}
        />

        <QueCambio deriva={a.deriva} referencia={referencia} onElegir={verMovimientos} />

        {a.porCategoria.length > 0 ? (
          <>
            <Titulo
              texto="Todas las categorías"
              ayuda={'Cada barra es una categoría del período, de mayor a menor. Tocar '
                + 'una lleva al listado filtrado por ella. Las muescas son de un mismo '
                + 'tamaño, así que dos barras se comparan contándolas.\n\n'
                + 'La casilla la saca del reparto de la torta de arriba. Apagada conserva '
                + 'su barra, para que se siga viendo cuánto era lo que sacaste. Se apaga '
                + 'solo para mirar: no borra nada y vuelven todas al salir.\n\n'
                + 'Para cambiarle el nombre o si cuenta como compromiso fijo, entra a '
                + 'Ajustes y toca la categoría en la lista.'}
              derecha={hayApagadas ? (
                <Boton
                  variante="texto"
                  etiqueta="Prender todas"
                  accesible="Volver a prender todas las categorías"
                  onPress={() => setApagadas(new Set())}
                />
              ) : undefined}
            />

            {a.porCategoria.map(({ categoriaId, total }) => {
              const Icono = iconoDeCategoria(categoriaId);
              const apagada = apagadas.has(categoriaId);
              const comoSeLlama = categorias.nombre(idDelCatalogo(categoriaId));
              const Casilla = apagada ? Square : CheckSquare;
              // Dos zonas hermanas: un tocable dentro de otro se pelea el toque.
              return (
                <View key={categoriaId} style={styles.fila}>
                  <Pressable
                    onPress={() => alternar(categoriaId)}
                    hitSlop={holguraDeToque(CASILLA)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !apagada }}
                    accessibilityLabel={apagada
                      ? `${comoSeLlama} está fuera del reparto. Tocar para volver a incluirla`
                      : `${comoSeLlama} entra en el reparto. Tocar para sacarla`}
                  >
                    <Casilla
                      size={CASILLA}
                      weight={apagada ? 'regular' : 'fill'}
                      color={apagada ? theme.silencio : theme.acentoTexto}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => verMovimientos(categoriaId)}
                    style={({ pressed }) => [styles.filaTocable, pressed && styles.apretada]}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver movimientos de ${comoSeLlama}, ${money.format(total)}`}
                  >
                    <Icono size={15} weight="regular" color={theme.silencio} />
                    <Text style={[styles.nombre, apagada && styles.apagado]} numberOfLines={1}>
                      {categorias.nombreCorto(idDelCatalogo(categoriaId))}
                    </Text>
                    <BarraSegmentada valor={total.amountMinor} unidad={unidad} total={muescas} apagada={apagada} />
                    <Text style={[styles.monto, apagada && styles.apagado]}>{money.formatNumber(total)}</Text>
                    <CaretRight size={12} weight="bold" color={theme.silencio} />
                  </Pressable>
                </View>
              );
            })}
          </>
        ) : null}

        <Anteriores />
      </ScrollView>

      <Hoja
        abierta={creditos}
        titulo="Gracias"
        onCerrar={() => { setCreditos(false); setToquesAlPinguino(0); }}
      >
        <Creditos />
      </Hoja>
    </Pantalla>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    contenido: { ...columna, paddingTop: spacing.lg },
    // Sin subrayado: el `>` del final dice que lleva a alguna parte.
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    filaTocable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    apretada: { opacity: 0.6 },
    // `silencio` y no opacidad: con la opacidad que hace falta, el texto cae de AA.
    apagado: { color: theme.silencio },
    nombre: { ...t.etiqueta, width: 78, color: theme.tinta },
    monto: { ...t.cifra, width: 66, textAlign: 'right' },
  });
}
