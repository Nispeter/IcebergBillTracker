/**
 * Témpanos: lo que viene, flotando hacia uno.
 *
 * Cada fila es una ocurrencia ("el arriendo del 5 de septiembre"), no la regla
 * entera: así se puede marcar una y dejar las otras, que es lo que pasa cuando
 * un mes se paga distinto. Lo vencido va arriba y en rojo: es lo único de la
 * pantalla sobre lo que hay que hacer algo hoy.
 */

import { dates, money, recurrence } from '@iceberg/core';
import {
  crearRegla, desmarcar, listarCuentas, marcarOmitida, marcarPagada, type Tempano,
} from '@iceberg/db';
import { columna, elevation, holguraDeToque, radii, spacing } from '@iceberg/ui';
import { Link } from 'expo-router';
import { ArrowCounterClockwise } from 'phosphor-react-native/src/icons/ArrowCounterClockwise';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { X } from 'phosphor-react-native/src/icons/X';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ayuda } from '../../components/Ayuda';
import { Boton } from '../../components/Boton';
import { iconoDeCategoria } from '../../components/iconos';
import { MarcaDeFecha } from '../../components/MarcaDeFecha';
import { Pantalla } from '../../components/Pantalla';
import { Pinguino } from '../../components/Pinguino';
import { Titulo } from '../../components/Titulo';
import { Vacio } from '../../components/Vacio';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { useCategorias } from '../../datos/catalogo';
import { useCandidatasARegla, useTempanos } from '../../datos/consultas';
import { useAireInferior } from '../../datos/desplazamiento';
import { useEstilo, useEstilos, type Estilo } from '../../datos/estilos';
import { usePeriodo } from '../../datos/periodo';

/**
 * Cuánto se asoma la sección de próximos más allá del período. Las reglas se
 * repiten para siempre; tres meses es lo que alcanza a cambiar una decisión de hoy.
 */
const DIAS_ADELANTE = 90;

/** Lo que mide el círculo de cada acción de fila; el área táctil llega a 48. */
const ACCION = 26;

export default function Tempanos() {
  const styles = useEstilos(crearEstilos);
  const aireInferior = useAireInferior();
  const { rango, corte } = usePeriodo();
  const { db, contexto } = useDatos();
  const avisar = useAvisar();

  const tempanos = useTempanos(rango, corte);
  // Lo que vence después del período: el 28 de agosto, el arriendo del 5 ya importa.
  const proximos = useTempanos(
    useMemo(
      () => dates.dateRange(dates.addDays(rango.end, 1), dates.addDays(rango.end, DIAS_ADELANTE)),
      [rango.end],
    ),
    corte,
  ).filter((t) => t.estado === 'pendiente');
  // Las que se repiten en el historial: evitan cargar a mano el arriendo y la luz.
  const candidatas = useCandidatasARegla(corte);

  const pendientes = tempanos.filter((t) => t.estado === 'pendiente');
  const vencidos = pendientes.filter((t) => t.diasRestantes < 0);
  const porPagar = money.money(
    pendientes.filter((t) => t.regla.tipo === 'gasto').reduce((s, t) => s + t.montoMinor, 0),
    'CLP',
  );

  const acciones = (tempano: Tempano) => ({
    onPagar: () => marcarPagada(db, contexto, tempano.regla.id, tempano.ocurreEn),
    onOmitir: () => marcarOmitida(db, contexto, tempano.regla.id, tempano.ocurreEn),
    onDeshacer: () => desmarcar(db, contexto, tempano.regla.id, tempano.ocurreEn),
  });

  function crearDesde(candidata: recurrence.Candidata) {
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
  }

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
      <ScrollView contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}>
        <View style={styles.cabecera}>
          <View style={styles.total}>
            <View style={styles.etiquetaConAyuda}>
              <Text style={styles.totalEtiqueta}>por pagar</Text>
              <Ayuda
                titulo="Por pagar"
                texto={'Cada fila es una fecha concreta, no la cuenta entera. Marcar pagada crea '
                  + 'el movimiento; omitir no crea nada. Las dos se pueden deshacer.'}
              />
            </View>
            <Text style={styles.totalCifra}>{money.format(porPagar)}</Text>
          </View>
          {/* Con etiqueta y contorno: un círculo relleno sería un segundo botón
              flotante compitiendo con el más de la barra. */}
          <Boton etiqueta="Nueva cuenta periódica" href="/regla/nueva" />
        </View>

        {/* Todo pagado y nada cargado se ven igual de vacíos, y son opuestos: vale decirlo. */}
        {vencidos.length === 0 && tempanos.length > 0 && pendientes.length === 0 ? (
          <View style={styles.filaAviso}>
            <Pinguino tamano={22} estado="contento" />
            <Text style={styles.alDia}>Todo al día en este período.</Text>
          </View>
        ) : null}

        {vencidos.length > 0 ? (
          <View style={styles.filaAviso}>
            <Pinguino tamano={22} estado="alerta" />
            <Text style={styles.vencidos}>
              {vencidos.length === 1 ? '1 cuenta vencida' : `${vencidos.length} cuentas vencidas`} sin resolver.
            </Text>
          </View>
        ) : null}

        {tempanos.length === 0
          ? <Vacio texto="No hay cuentas periódicas en este período." />
          : tempanos.map((tempano) => (
            <Fila key={`${tempano.regla.id}|${tempano.ocurreEn}`} tempano={tempano} {...acciones(tempano)} />
          ))}

        {proximos.length > 0 ? (
          <>
            <Titulo
              texto="Próximos"
              ayuda={'Lo que vence **después** de este período, hasta tres meses adelante.\n\n'
                + 'Está acá porque el borde del mes no es el borde de tus cuentas: el 28 de '
                + 'agosto, el arriendo del 5 ya es asunto tuyo.\n\n'
                + 'Se pueden marcar igual que las de arriba, por si pagas una antes de tiempo.'}
            />
            {proximos.map((tempano) => (
              <Fila key={`${tempano.regla.id}|${tempano.ocurreEn}`} tempano={tempano} {...acciones(tempano)} />
            ))}
          </>
        ) : null}

        {candidatas.length > 0 ? (
          <>
            <Titulo
              texto="Detectadas en tu historial"
              ayuda={'Movimientos que se repiten con la misma frecuencia y un monto '
                + 'parecido. Son una propuesta: nada se crea hasta que la confirmes.'}
            />
            {candidatas.map((candidata) => (
              <Sugerencia key={candidata.nombre} candidata={candidata} onCrear={() => crearDesde(candidata)} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </Pantalla>
  );
}

/** Cerca de hoy, el número de días no dice nada por sí solo. */
function cuando(diasRestantes: number): string {
  if (diasRestantes === 0) return 'hoy';
  if (diasRestantes === 1) return 'mañana';
  if (diasRestantes === -1) return 'ayer';
  if (diasRestantes < 0) return `hace ${Math.abs(diasRestantes)} días`;
  return `en ${diasRestantes} días`;
}

function Fila(
  { tempano, onPagar, onOmitir, onDeshacer }: {
    tempano: Tempano;
    onPagar: () => void;
    onOmitir: () => void;
    onDeshacer: () => void;
  },
) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useEstilo();
  const categorias = useCategorias();
  const { regla, estado, diasRestantes } = tempano;
  const Icono = regla.categoriaId ? iconoDeCategoria(regla.categoriaId) : null;
  const vencido = estado === 'pendiente' && diasRestantes < 0;
  const resuelto = estado !== 'pendiente';

  return (
    // Lo resuelto sigue a la vista, pero deja de pedir atención.
    <View style={[styles.fila, resuelto && styles.resuelta]}>
      <MarcaDeFecha fecha={tempano.ocurreEn} vencida={vencido} />

      <View style={styles.texto}>
        <Link href={{ pathname: '/regla/[id]', params: { id: regla.id } }} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${regla.nombre}`}>
            <Text style={styles.nombre} numberOfLines={1}>{regla.nombre}</Text>
          </Pressable>
        </Link>
        <View style={styles.meta}>
          {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
          <Text style={vencido ? styles.subtituloVencido : styles.subtitulo}>
            {estado === 'pagada' ? 'Pagada' : estado === 'omitida' ? 'Omitida' : cuando(diasRestantes)}
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
          hitSlop={holguraDeToque(ACCION)}
          accessibilityRole="button"
          accessibilityLabel={`Deshacer ${regla.nombre}`}
        >
          <ArrowCounterClockwise size={14} weight="bold" color={theme.silencio} />
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={onOmitir}
            style={styles.accion}
            hitSlop={holguraDeToque(ACCION)}
            accessibilityRole="button"
            accessibilityLabel={`Omitir ${regla.nombre}`}
          >
            <X size={13} weight="bold" color={theme.silencio} />
          </Pressable>
          <Pressable
            onPress={onPagar}
            style={styles.accionPagar}
            hitSlop={holguraDeToque(ACCION)}
            accessibilityRole="button"
            accessibilityLabel={`Marcar pagada ${regla.nombre}`}
          >
            <Check size={13} weight="bold" color={theme.sobreAcento} />
          </Pressable>
        </>
      )}
    </View>
  );
}

function Sugerencia({ candidata, onCrear }: { candidata: recurrence.Candidata; onCrear: () => void }) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useEstilo();
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
      {/* De contorno: una lista de propuestas no es una pared de acciones principales. */}
      <Boton etiqueta="Crear" accesible={`Crear cuenta periódica ${candidata.nombre}`} onPress={onCrear} />
    </View>
  );
}

function crearEstilos({ theme, t, letra }: Estilo) {
  const circulo = {
    width: ACCION,
    height: ACCION,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  return StyleSheet.create({
    contenido: columna,
    cabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    total: { gap: 1 },
    etiquetaConAyuda: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    totalEtiqueta: t.etiqueta,
    totalCifra: { ...t.cifra, fontSize: letra.px(28), fontWeight: t.accion.fontWeight, letterSpacing: -0.5 },
    filaAviso: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
    vencidos: t.error,
    // El verde de los ingresos: la misma idea de "esto está bien", ya aprendida.
    alDia: { ...t.error, color: theme.ingresoTexto },

    // Sin subrayado: la fecha y los dos renglones ya separan una fila de la siguiente.
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    resuelta: { opacity: 0.45 },
    texto: { flex: 1, gap: 2 },
    nombre: t.nombre,
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    subtitulo: t.etiqueta,
    subtituloVencido: { ...t.error, fontSize: t.etiqueta.fontSize },
    monto: { ...t.cifra, fontSize: t.cuerpo.fontSize },
    montoResuelto: { ...t.cifra, fontSize: t.cuerpo.fontSize, color: theme.silencio, textDecorationLine: 'line-through' },
    accion: { ...circulo, borderWidth: elevation.hairlineWidth, borderColor: theme.hairline },
    accionPagar: { ...circulo, backgroundColor: theme.acento },
  });
}
