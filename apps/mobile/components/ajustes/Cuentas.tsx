/** Las cuentas: cuál abre la app (la estrella) y entrar a editarlas. */

import { money } from '@iceberg/core';
import { holguraDeToque, spacing } from '@iceberg/ui';
import { Link } from 'expo-router';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Boton } from '../Boton';
import { Seccion } from './comun';
import { useAvisar } from '../../datos/aviso';
import { useCuentas } from '../../datos/consultas';
import { NOMBRES_DE_TIPO_DE_CUENTA, useCuentaActiva } from '../../datos/cuenta';
import { useEstilo, useEstilos, type Estilo } from '../../datos/estilos';

const ESTRELLA = 18;

export function Cuentas({ primera }: { primera?: boolean }) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useEstilo();
  const cuentas = useCuentas();
  const { porDefecto, marcarPorDefecto } = useCuentaActiva();
  const avisar = useAvisar();

  return (
    <Seccion
      primera={primera}
      titulo="Cuentas"
      ayuda={'El saldo inicial es cuánto había antes del primer movimiento que '
        + 'registres. Sin él, el saldo de la app no cuadra con el del banco. '
        + 'La estrella marca con cuál abre la app. Si una cuenta no se comparte, '
        + 'lo dice aquí abajo y se cambia al editarla.'}
    >
      {cuentas.map((cuenta) => {
        const esLaDeSiempre = porDefecto === cuenta.id;
        return (
          <View key={cuenta.id} style={styles.cuenta}>
            {/* Fuera del enlace: tocarla marca, no navega. Tocar la marcada la
                quita, y la app vuelve a abrir con todas juntas. */}
            <Pressable
              onPress={() => {
                marcarPorDefecto(esLaDeSiempre ? null : cuenta.id);
                avisar(esLaDeSiempre ? 'Ya no abre con esta cuenta' : `Abre con ${cuenta.nombre}`);
              }}
              hitSlop={holguraDeToque(ESTRELLA)}
              accessibilityRole="button"
              accessibilityState={{ selected: esLaDeSiempre }}
              accessibilityLabel={esLaDeSiempre
                ? `${cuenta.nombre} es la cuenta con la que abre la app. Tocar para quitarla`
                : `Abrir la app con ${cuenta.nombre}`}
            >
              <Star
                size={ESTRELLA}
                weight={esLaDeSiempre ? 'fill' : 'regular'}
                color={esLaDeSiempre ? theme.acentoTexto : theme.silencio}
              />
            </Pressable>
            <Link href={{ pathname: '/cuenta/[id]', params: { id: cuenta.id } }} asChild>
              <Pressable
                style={styles.tocable}
                accessibilityRole="button"
                accessibilityLabel={`Editar la cuenta ${cuenta.nombre}`}
              >
                <View style={styles.texto}>
                  <Text style={styles.nombre} numberOfLines={1}>{cuenta.nombre}</Text>
                  <Text style={styles.detalle}>
                    {NOMBRES_DE_TIPO_DE_CUENTA[cuenta.tipo]}
                    {' · inicial '}{money.format(money.money(cuenta.saldoInicialMinor))}
                    {cuenta.sincroniza === 0 ? ' · no se comparte' : ''}
                  </Text>
                </View>
                <CaretRight size={12} weight="bold" color={theme.silencio} />
              </Pressable>
            </Link>
          </View>
        );
      })}
      <Boton etiqueta="Agregar cuenta" href={{ pathname: '/cuenta/[id]', params: { id: 'nueva' } }} />
    </Seccion>
  );
}

function crearEstilos({ t }: Estilo) {
  return StyleSheet.create({
    cuenta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    tocable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    texto: { flex: 1, gap: 2 },
    nombre: { ...t.cuerpo, fontWeight: t.accion.fontWeight },
    detalle: t.etiqueta,
  });
}
