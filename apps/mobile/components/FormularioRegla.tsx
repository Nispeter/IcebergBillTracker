/**
 * El formulario de una cuenta periódica, compartido por el alta y la edición.
 *
 * Como `FormularioMovimiento`, no toca la base. Lo que importa está al final:
 * la regla escrita y sus próximas fechas. "El 31 de cada mes" hace algo
 * distinto en febrero de lo que uno supone, y verlo antes de guardar es lo que
 * evita la sorpresa.
 */

import { dates, money, recurrence } from '@iceberg/core';
import type { TipoDeMovimiento } from '@iceberg/db';
import { elevation, spacing } from '@iceberg/ui';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Boton } from './Boton';
import {
  Campo, Entrada, EntradaDeFecha, EntradaDeMonto, ErrorDelFormulario, Formulario, Opciones,
  type Opcion,
} from './Formulario';
import { TIPOS } from './FormularioMovimiento';
import { iconoDeCategoria } from './iconos';
import { Panel } from './Panel';
import { Desplegable, useOpcionesDeCategoria } from './SelectorDesplegable';
import { useCategorias } from '../datos/catalogo';
import { useEstilos, type Estilo } from '../datos/estilos';

export interface ValoresDeRegla {
  readonly tipo: TipoDeMovimiento;
  readonly montoMinor: number;
  readonly nombre: string;
  readonly categoriaId: string | null;
  readonly frecuencia: recurrence.Frecuencia;
  readonly cada: number;
  readonly desde: dates.PlainDate;
  readonly hasta: dates.PlainDate | null;
}

const FRECUENCIAS: readonly Opcion<recurrence.Frecuencia>[] = [
  { valor: 'mensual', etiqueta: 'Mensual' },
  { valor: 'semanal', etiqueta: 'Semanal' },
  { valor: 'anual', etiqueta: 'Anual' },
  { valor: 'diaria', etiqueta: 'Diaria' },
];

const UNIDADES: Record<recurrence.Frecuencia, string> = {
  diaria: 'días',
  semanal: 'semanas',
  mensual: 'meses',
  anual: 'años',
};

/** Cuántas fechas se anticipan. Con tres ya se ve el patrón. */
const ANTICIPO = 3;

export function FormularioRegla({
  titulo, inicial, onGuardar, onCancelar, onBorrar, error,
}: {
  titulo: string;
  inicial?: Partial<ValoresDeRegla>;
  onGuardar: (valores: ValoresDeRegla) => void;
  onCancelar: () => void;
  onBorrar?: () => void;
  error?: string | null;
}) {
  const styles = useEstilos(crearEstilos);
  const categorias = useCategorias();
  const opcionesDeCategoria = useOpcionesDeCategoria('Sin categoría');

  const [tipo, setTipo] = useState<TipoDeMovimiento>(inicial?.tipo ?? 'gasto');
  const [monto, setMonto] = useState(
    inicial?.montoMinor === undefined ? '' : money.formatNumber(money.money(inicial.montoMinor)),
  );
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [categoriaId, setCategoriaId] = useState<string | null>(inicial?.categoriaId ?? null);
  const [frecuencia, setFrecuencia] = useState<recurrence.Frecuencia>(inicial?.frecuencia ?? 'mensual');
  const [cada, setCada] = useState(String(inicial?.cada ?? 1));
  const [desde, setDesde] = useState<string>(inicial?.desde ?? dates.today());
  const [hasta, setHasta] = useState<string>(inicial?.hasta ?? '');
  const [eligiendoCategoria, setEligiendoCategoria] = useState(false);

  const montoParseado = money.parseMoney(monto);
  const desdeParseado = dates.parsePlainDate(desde);
  // Vacío es "no termina", que no es lo mismo que una fecha mal escrita.
  const hastaParseado = hasta.trim() === '' ? null : dates.parsePlainDate(hasta);
  const hastaMalEscrito = hasta.trim() !== '' && hastaParseado === null;
  const cadaParseado = /^\d+$/.test(cada.trim()) ? Number(cada.trim()) : null;
  const pideCategoria = tipo === 'gasto';

  const regla = desdeParseado !== null && cadaParseado !== null
    ? { frecuencia, cada: cadaParseado, desde: desdeParseado, hasta: hastaParseado }
    : null;
  const problemaDeRegla = regla === null ? null : recurrence.validarRegla(regla);

  const puedeGuardar =
    montoParseado !== null
    && montoParseado.amountMinor > 0
    && nombre.trim().length > 0
    && regla !== null
    && problemaDeRegla === null
    && !hastaMalEscrito;

  const proximas = useMemo(() => {
    if (regla === null || problemaDeRegla !== null) return [];
    const fechas: dates.PlainDate[] = [];
    let cursor = regla.desde;
    for (let i = 0; i < ANTICIPO; i += 1) {
      const proxima = recurrence.proximaOcurrencia(regla, cursor);
      if (proxima === null) break;
      fechas.push(proxima);
      cursor = dates.addDays(proxima, 1);
    }
    return fechas;
  }, [regla?.frecuencia, regla?.cada, regla?.desde, regla?.hasta, problemaDeRegla]);

  function guardar() {
    if (!puedeGuardar || montoParseado === null || regla === null) return;
    onGuardar({
      tipo,
      montoMinor: montoParseado.amountMinor,
      nombre,
      categoriaId: pideCategoria ? categoriaId : null,
      frecuencia: regla.frecuencia,
      cada: regla.cada,
      desde: regla.desde,
      hasta: regla.hasta,
    });
  }

  return (
    <Formulario titulo={titulo} onCancelar={onCancelar}>
      <Opciones opciones={TIPOS} valor={tipo} onElegir={setTipo} />

      <EntradaDeMonto etiqueta="Monto" valor={monto} onCambiar={setMonto} />

      <Campo etiqueta="Descripción">
        <Entrada
          value={nombre}
          onChangeText={setNombre}
          placeholder="Arriendo, luz, internet…"
          accessibilityLabel="Descripción"
        />
      </Campo>

      {pideCategoria ? (
        // Elevado siempre: es el único desplegable, y así su panel no pasa
        // debajo de los campos siguientes mientras se desvanece.
        <Campo etiqueta="Categoría" elevado>
          <Desplegable
            abierto={eligiendoCategoria}
            onAlternar={() => setEligiendoCategoria(!eligiendoCategoria)}
            etiqueta={categorias.nombreCorto(categoriaId)}
            icono={categoriaId === null ? null : iconoDeCategoria(categoriaId)}
            activo={categoriaId !== null}
            accesible={categoriaId === null
              ? 'Elegir categoría'
              : `Categoría ${categorias.nombre(categoriaId)}. Tocar para cambiar`}
            opciones={opcionesDeCategoria}
            valor={categoriaId}
            onElegir={(valor) => { setCategoriaId(valor); setEligiendoCategoria(false); }}
          />
        </Campo>
      ) : null}

      <Campo etiqueta="Cada cuánto">
        <Opciones opciones={FRECUENCIAS} valor={frecuencia} onElegir={setFrecuencia} />
      </Campo>

      <Campo etiqueta="Repetir cada">
        <View style={styles.filaRepetir}>
          <TextInput
            value={cada}
            onChangeText={setCada}
            keyboardType="numeric"
            inputMode="numeric"
            style={styles.entradaCorta}
            accessibilityLabel="Repetir cada"
          />
          <Text style={styles.unidad}>{UNIDADES[frecuencia]}</Text>
        </View>
      </Campo>

      <EntradaDeFecha etiqueta="Primera vez" valor={desde} onCambiar={setDesde} />
      <EntradaDeFecha etiqueta="Hasta" valor={hasta} onCambiar={setHasta} vacia="Sin término" />

      {problemaDeRegla !== null ? (
        <Text style={styles.aviso}>{problemaDeRegla}</Text>
      ) : regla !== null ? (
        <Panel>
          <Text style={styles.resumen}>{recurrence.describirRegla(regla)}</Text>
          {proximas.length > 0 ? (
            <Text style={styles.fechas}>
              Próximas: {proximas.map((f) => dates.formatDate(f)).join(' · ')}
            </Text>
          ) : (
            <Text style={styles.aviso}>Con esas fechas no ocurre nunca.</Text>
          )}
        </Panel>
      ) : null}

      <ErrorDelFormulario error={error} />

      <Boton
        variante="principal"
        etiqueta="Guardar"
        accesible="Guardar cuenta periódica"
        onPress={guardar}
        deshabilitado={!puedeGuardar}
      />

      {onBorrar ? (
        <Boton
          variante="peligro"
          etiqueta="Borrar. Lo ya pagado se queda."
          confirmar="Tocar de nuevo para borrarla"
          onPress={onBorrar}
          estilo={styles.borrar}
        />
      ) : null}
    </Formulario>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    filaRepetir: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    entradaCorta: {
      ...t.cifraGrande,
      width: 64,
      textAlign: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    unidad: { ...t.cuerpo, color: theme.silencio },
    resumen: { ...t.seccion, paddingBottom: 2 },
    fechas: { ...t.cifra, color: theme.silencioHondo },
    aviso: { ...t.nota, color: theme.vencidoTexto },
    borrar: { alignSelf: 'center' },
  });
}
