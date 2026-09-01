/**
 * Témpanos: lo que viene, flotando hacia uno.
 *
 * Cada fila es **una ocurrencia**, no una regla: "el arriendo del 5 de
 * septiembre", no "el arriendo". Eso permite marcar una y dejar las otras
 * quietas, que es lo que pasa en la vida real cuando un mes se paga distinto o
 * no se paga.
 *
 * Lo vencido y sin resolver va arriba y en rojo. No es alarmismo: es la unica
 * informacion de la pantalla sobre la que hay que hacer algo hoy.
 */

import { dates, money, recurrence } from '@iceberg/core';
import {
  crearRegla, desmarcar, listarCuentas, marcarOmitida, marcarPagada, type Tempano,
} from '@iceberg/db';
import {
  elevation, fonts, pesos, radii, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { Link } from 'expo-router';
import { ArrowCounterClockwise } from 'phosphor-react-native/src/icons/ArrowCounterClockwise';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { X } from 'phosphor-react-native/src/icons/X';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ayuda } from '../../components/Ayuda';
import { Pantalla } from '../../components/Pantalla';
import { Titulo } from '../../components/Titulo';
import { useAireInferior } from '../../datos/desplazamiento';
import { Pinguino } from '../../components/Pinguino';
import { iconoDeCategoria } from '../../components/iconos';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { useCandidatasARegla, useTempanos } from '../../datos/consultas';
import { useLetra } from '../../datos/letra';
import { usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';
import { useCategorias } from '../../datos/catalogo';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Cuanto se asoma la seccion de proximos mas alla del periodo. */
const DIAS_ADELANTE = 90;

export default function Tempanos() {
  const { theme } = useTema();
  const letra = useLetra();
  const aireInferior = useAireInferior();
  const styles = useMemo(() => crearEstilos(theme, letra), [theme, letra]);
  const categorias = useCategorias();
  const { rango, corte } = usePeriodo();
  const { db, contexto } = useDatos();
  const avisar = useAvisar();

  const tempanos = useTempanos(rango, corte);
  /**
   * Lo que viene **despues** del periodo que se esta mirando.
   *
   * Tempanos es la unica vista que mira hacia adelante, pero solo veia hasta el
   * borde del mes: el 28 de agosto la pantalla decia "todo al dia" y el arriendo
   * del 5 estaba a ocho dias. Que la cuenta exista y no se vea es justo lo que
   * esta pantalla vino a evitar.
   *
   * Noventa dias y no "todo lo que venga": las reglas se repiten para siempre,
   * asi que sin tope la lista es infinita. Tres meses es lo que alcanza a
   * cambiar una decision de hoy.
   */
  const proximos = useTempanos(
    useMemo(
      () => dates.dateRange(dates.addDays(rango.end, 1), dates.addDays(rango.end, DIAS_ADELANTE)),
      [rango.end],
    ),
    corte,
  ).filter((t) => t.estado === 'pendiente');
  // Encontradas en el historial: es lo que evita tener que cargar a mano el
  // arriendo, la luz y el agua antes de que la pantalla sirva para algo.
  const candidatas = useCandidatasARegla(corte);

  const pendientes = tempanos.filter((t) => t.estado === 'pendiente');
  const vencidos = pendientes.filter((t) => t.diasRestantes < 0);
  const porPagar = money.money(
    pendientes.filter((t) => t.regla.tipo === 'gasto').reduce((s, t) => s + t.montoMinor, 0),
    'CLP',
  );

  return (
    <Pantalla
      titulo="Témpanos"
      ayudaDelTitulo={'Tus **cuentas periódicas**: lo que se repite y ya está '
        + 'comprometido aunque todavía no lo hayas pagado. Arriendo, servicios, '
        + 'suscripciones, cuotas.\n\n'
        + 'Se llaman témpanos porque son la parte del gasto que viene igual, la estés '
        + 'mirando o no.\n\n'
        + 'Es la única vista que mira hacia adelante: avanza el período con la flecha '
        + 'de arriba y ves lo que se viene.'}
      permitirFuturo
    >
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}
      >
        <View style={styles.cabecera}>
          <View style={styles.total}>
            {/* La `i` va pegada a "por pagar", que es lo que explica. Estaba al
                otro extremo de la fila, y ahi competia con el + por el mismo
                rincon: dos iconos juntos, uno ambar y uno gris, obligaban a leer
                cual era cual. */}
            <View style={styles.etiquetaConAyuda}>
              <Text style={styles.totalEtiqueta}>por pagar</Text>
              <Ayuda
                titulo="Por pagar"
                theme={theme}
                texto={'Cada fila es una fecha concreta, no la cuenta entera. Marcar pagada crea '
                  + 'el movimiento; omitir no crea nada. Las dos se pueden deshacer.\n\n'
                  + 'El + de arriba agrega una cuenta que se repite: arriendo, luz, una '
                  + 'suscripción.'}
              />
            </View>
            <Text style={styles.totalCifra}>{money.format(porPagar)}</Text>
          </View>

          {/*
            El unico + de la pantalla, y arriba.

            Habia dos --este y un boton al final de la lista-- que hacian lo
            mismo. Dos caminos al mismo formulario no es el doble de descubrible:
            es una pregunta de mas ("¿son distintos?") cada vez que se mira la
            pantalla. Queda el de arriba, que se ve al entrar y no se mueve con
            el largo de la lista.

            No compite con el mas de la barra de abajo --que es el de anotar un
            movimiento-- porque este vive dentro de la vista y al lado de su
            propia cifra: lo que se agrega desde aca es una cuenta que se repite.
          */}
          <Link href="/regla/nueva" asChild>
            <Pressable
              style={styles.mas}
              accessibilityRole="button"
              accessibilityLabel="Nueva cuenta periódica"
            >
              <Plus size={20} weight="bold" color={theme.sobreAcento} />
            </Pressable>
          </Link>
        </View>

        {/*
          El unico momento de la app en que no hay nada que hacer y eso es una
          buena noticia. Vale decirlo: la pantalla se ve igual de vacia cuando
          esta todo pagado que cuando no hay nada cargado, y son cosas opuestas.
        */}
        {vencidos.length === 0 && tempanos.length > 0 && pendientes.length === 0 ? (
          <View style={styles.filaAviso}>
            <Pinguino theme={theme} tamano={22} estado="contento" />
            <Text style={styles.avisoAlDia}>Todo al día en este período.</Text>
          </View>
        ) : null}

        {vencidos.length > 0 ? (
          <View style={styles.filaAviso}>
            <Pinguino theme={theme} tamano={22} estado="alerta" />
            <Text style={styles.aviso}>
            {vencidos.length === 1 ? '1 cuenta vencida' : `${vencidos.length} cuentas vencidas`}
              {' sin resolver.'}
            </Text>
          </View>
        ) : null}

        {tempanos.length === 0 ? (
          <View style={styles.vacio}>
            <Pinguino theme={theme} tamano={40} estado="dormido" />
            <Text style={styles.vacioTexto}>
              No hay cuentas periódicas en este período.
            </Text>
          </View>
        ) : (
          tempanos.map((tempano) => (
            <Fila
              key={`${tempano.regla.id}|${tempano.ocurreEn}`}
              tempano={tempano}
              styles={styles}
              theme={theme}
              onPagar={() => marcarPagada(db, contexto, tempano.regla.id, tempano.ocurreEn)}
              onOmitir={() => marcarOmitida(db, contexto, tempano.regla.id, tempano.ocurreEn)}
              onDeshacer={() => desmarcar(db, contexto, tempano.regla.id, tempano.ocurreEn)}
            />
          ))
        )}

        {proximos.length > 0 ? (
          <>
            <Titulo
              texto="Próximos"
              theme={theme}
              ayuda={'Lo que vence **después** de este período, hasta tres meses adelante.\n\n'
                + 'Está acá porque el borde del mes no es el borde de tus cuentas: el 28 de '
                + 'agosto, el arriendo del 5 ya es asunto tuyo.\n\n'
                + 'Se pueden marcar igual que las de arriba, por si pagas una antes de tiempo.'}
            />

            {proximos.map((tempano) => (
              <Fila
                key={`${tempano.regla.id}|${tempano.ocurreEn}`}
                tempano={tempano}
                styles={styles}
                theme={theme}
                onPagar={() => marcarPagada(db, contexto, tempano.regla.id, tempano.ocurreEn)}
                onOmitir={() => marcarOmitida(db, contexto, tempano.regla.id, tempano.ocurreEn)}
                onDeshacer={() => desmarcar(db, contexto, tempano.regla.id, tempano.ocurreEn)}
              />
            ))}
          </>
        ) : null}

        {candidatas.length > 0 ? (
          <>
            <Titulo
              texto="Detectadas en tu historial"
              theme={theme}
              ayuda={'Movimientos que se repiten con la misma frecuencia y un monto '
                + 'parecido. Son una propuesta: nada se crea hasta que la confirmes.'}
            />

            {candidatas.map((candidata) => (
              <Sugerencia
                key={candidata.nombre}
                candidata={candidata}
                styles={styles}
                theme={theme}
                onCrear={() => {
                  const cuenta = listarCuentas(db, contexto)[0];
                  if (!cuenta) return;
                  crearRegla(db, contexto, {
                    cuentaId: cuenta.id,
                    tipo: 'gasto',
                    montoMinor: candidata.montoMinor,
                    nombre: candidata.nombre,
                    categoriaId: candidata.categoriaId,
                    frecuencia: candidata.frecuencia,
                    cada: candidata.cada,
                    desde: candidata.desde,
                  });
                  avisar('Cuenta periódica creada');
                }}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </Pantalla>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

/** Cuando falta poco o ya se paso, el numero de dias no dice nada por si solo. */
function cuando(diasRestantes: number): string {
  if (diasRestantes === 0) return 'hoy';
  if (diasRestantes === 1) return 'mañana';
  if (diasRestantes === -1) return 'ayer';
  if (diasRestantes < 0) return `hace ${Math.abs(diasRestantes)} días`;
  return `en ${diasRestantes} días`;
}

function Fila(
  { tempano, styles, theme, onPagar, onOmitir, onDeshacer }: {
    tempano: Tempano;
    styles: Estilos;
    theme: Theme;
    onPagar: () => void;
    onOmitir: () => void;
    onDeshacer: () => void;
  },
) {
  const categorias = useCategorias();
  const { regla, estado, diasRestantes } = tempano;
  const Icono = regla.categoriaId ? iconoDeCategoria(regla.categoriaId) : null;
  const vencido = estado === 'pendiente' && diasRestantes < 0;
  const resuelto = estado !== 'pendiente';
  const dia = Number(tempano.ocurreEn.slice(8, 10));
  const mes = MESES[Number(tempano.ocurreEn.slice(5, 7)) - 1];

  return (
    <View style={[styles.fila, resuelto && styles.filaResuelta]}>
      <View style={styles.marcaFecha}>
        <Text style={vencido ? styles.diaVencido : styles.dia}>{dia}</Text>
        <Text style={styles.mes}>{mes}</Text>
      </View>

      <View style={styles.texto}>
        <Link href={{ pathname: '/regla/[id]', params: { id: regla.id } }} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${regla.nombre}`}>
            <Text style={styles.nombre} numberOfLines={1}>{regla.nombre}</Text>
          </Pressable>
        </Link>
        <View style={styles.meta}>
          {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
          <Text style={vencido ? styles.subtituloVencido : styles.subtitulo}>
            {estado === 'pagada' ? 'Pagada'
              : estado === 'omitida' ? 'Omitida'
                : cuando(diasRestantes)}
            {regla.categoriaId ? ` · ${categorias.nombreCorto(regla.categoriaId)}` : ''}
          </Text>
        </View>
      </View>

      <Text style={resuelto ? styles.montoResuelto : styles.monto}>
        {money.format(money.money(tempano.montoMinor))}
      </Text>

      {resuelto ? (
        <Pressable
          onPress={onDeshacer}
          style={styles.accion}
          accessibilityRole="button"
          accessibilityLabel={`Deshacer ${regla.nombre}`}
          hitSlop={8}
        >
          <ArrowCounterClockwise size={14} weight="bold" color={theme.silencio} />
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={onOmitir}
            style={styles.accion}
            accessibilityRole="button"
            accessibilityLabel={`Omitir ${regla.nombre}`}
            hitSlop={8}
          >
            <X size={13} weight="bold" color={theme.silencio} />
          </Pressable>
          <Pressable
            onPress={onPagar}
            style={styles.accionPagar}
            accessibilityRole="button"
            accessibilityLabel={`Marcar pagada ${regla.nombre}`}
            hitSlop={8}
          >
            <Check size={13} weight="bold" color={theme.sobreAcento} />
          </Pressable>
        </>
      )}
    </View>
  );
}

function Sugerencia(
  { candidata, styles, theme, onCrear }: {
    candidata: recurrence.Candidata;
    styles: Estilos;
    theme: Theme;
    onCrear: () => void;
  },
) {
  const Icono = candidata.categoriaId ? iconoDeCategoria(candidata.categoriaId) : null;

  return (
    <View style={styles.fila}>
      <View style={styles.texto}>
        <Text style={styles.nombre} numberOfLines={1}>{candidata.nombre}</Text>
        <View style={styles.meta}>
          {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
          <Text style={styles.subtitulo}>
            {recurrence.describirRegla({
              frecuencia: candidata.frecuencia,
              cada: candidata.cada,
              desde: candidata.desde,
              hasta: null,
            })}
            {` · ${candidata.veces} veces`}
          </Text>
        </View>
      </View>

      <Text style={styles.monto}>{money.format(money.money(candidata.montoMinor))}</Text>

      <Pressable
        onPress={onCrear}
        style={styles.crearChico}
        accessibilityRole="button"
        accessibilityLabel={`Crear cuenta periódica ${candidata.nombre}`}
      >
        <Text style={styles.crearChicoTexto}>Crear</Text>
      </Pressable>
    </View>
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  const boton = {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.lg,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    cabecera: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      zIndex: 20,
    },
    total: { gap: 1 },
    etiquetaConAyuda: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    /**
     * Redondo y relleno con el acento: es la unica accion de la pantalla que
     * crea algo, y el resto de los botones de aca son de 26 px y con contorno.
     * A 40 cae comodo bajo el pulgar sin pelearse con la cifra de al lado.
     */
    mas: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.acento,
    },
    totalEtiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.silencio },
    totalCifra: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: letra.px(28), color: theme.tinta, letterSpacing: -0.5 },
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.xs, color: theme.vencidoTexto, paddingBottom: spacing.sm },
    // En el verde de los ingresos y no en el acento: es la misma idea de "esto
    // suma", y ya esta aprendida en las otras pantallas.
    avisoAlDia: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.xs, color: theme.ingresoTexto, paddingBottom: spacing.sm },

    // Sin subrayado, igual que en la lista de movimientos: la fecha a la
    // izquierda y los dos renglones de cada fila ya la separan de la siguiente.
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    // Lo resuelto sigue a la vista pero deja de pedir atencion.
    filaResuelta: { opacity: 0.45 },
    marcaFecha: { width: 30, alignItems: 'center' },
    dia: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: letra.md, color: theme.tinta },
    diaVencido: { fontFamily: fonts.mono, fontWeight: pesos.bold, fontSize: letra.md, color: theme.vencidoTexto },
    mes: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.silencio },
    texto: { flex: 1, gap: 2 },
    nombre: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.md, color: theme.tinta },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    subtitulo: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.silencio },
    subtituloVencido: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.xs, color: theme.vencidoTexto },
    monto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.sm, color: theme.tinta },
    montoResuelto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.sm, color: theme.silencio, textDecorationLine: 'line-through' },

    accion: { ...boton, borderWidth: elevation.hairlineWidth, borderColor: theme.hairline },
    accionPagar: { ...boton, backgroundColor: theme.acento },

    vacio: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    filaAviso: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
    vacioTexto: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.sm, color: theme.silencio, paddingVertical: spacing.lg },

    regla: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xs, zIndex: 20 },
    reglaTitulo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.xs, color: theme.tinta },
    reglaLinea: { flex: 1, height: elevation.hairlineWidth, backgroundColor: theme.hairline },
    crearChico: {
      paddingVertical: 5,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
      backgroundColor: theme.acento,
    },
    crearChicoTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.xs, color: theme.sobreAcento },
  });
}
