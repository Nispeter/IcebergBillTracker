/**
 * Ajustes: apariencia, y de donde salen los datos que se estan viendo.
 *
 * La identidad del dispositivo se muestra porque en modo hogar (F5) va a
 * importar saber cual es este aparato, y porque tenerla a la vista ayuda a
 * depurar cuando algo no cuadra entre dos telefonos.
 */

import { crypto, dates, money } from '@iceberg/core';
import {
  CLAVE_DISPOSITIVO, CLAVE_HOGAR, CLAVE_MIEMBRO, borrarTodo, contarRespaldo, crearCuenta,
  deshacerLote, exportarRespaldo, fusionarRespaldo, leerAjuste, renombrarMiembro,
  restaurarRespaldo, type ConflictoLegible, type Lote, type Miembro,
} from '@iceberg/db';
import { elevation, fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { Pantalla } from '../../components/Pantalla';
import { useDatos } from '../../datos/BaseDeDatos';
import {
  useCuentas, useLotes, useMiembros, useMovimientos, useSaldo, useSaldoInicial,
} from '../../datos/consultas';
import { TIPOS, usePeriodo } from '../../datos/periodo';
import { elegirRespaldo, guardarRespaldo } from '../../datos/archivo';
import { cargarSemilla } from '../../datos/semilla';
import { useTema } from '../../datos/tema';

export default function Ajustes() {
  const { nombre: tema, theme, alternar } = useTema();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const { db, contexto } = useDatos();
  const periodo = usePeriodo();

  const movimientos = useMovimientos();
  const cuentas = useCuentas();
  const saldo = useSaldo(useSaldoInicial());
  const lotes = useLotes();
  const miembros = useMiembros();
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<'borrar' | 'restaurar' | null>(null);
  const [conflictos, setConflictos] = useState<readonly ConflictoLegible[]>([]);
  const [frase, setFrase] = useState('');
  const [nombrePropio, setNombrePropio] = useState<string | null>(null);

  /**
   * Abre un archivo elegido, descifrandolo si hace falta.
   *
   * Un archivo cifrado y uno en claro se distinguen por su forma, asi que no hay
   * que preguntarle al usuario cual es: se mira y se actua.
   */
  function abrir(datos: unknown): unknown {
    if (!crypto.esSobre(datos)) return datos;
    if (frase.trim() === '') {
      throw new Error('Ese archivo está cifrado. Escribe la frase y vuelve a intentar.');
    }
    return JSON.parse(crypto.descifrar(datos, frase)) as unknown;
  }

  const vacia = movimientos.length === 0;

  async function exportar() {
    try {
      const respaldo = exportarRespaldo(db, contexto);
      const dia = respaldo.exportadoEn.slice(0, 10);
      const conFrase = frase.trim() !== '';

      // Se cifra solo si hay frase. Pedirla siempre haria que alguien que solo
      // quiere un respaldo local invente una y la olvide.
      const contenido = conFrase
        ? JSON.stringify(crypto.cifrar(JSON.stringify(respaldo), frase))
        : JSON.stringify(respaldo);
      const nombre = conFrase ? `iceberg-${dia}.cifrado.json` : `iceberg-${dia}.json`;

      await guardarRespaldo(nombre, contenido);
      setAviso(
        `Respaldo con ${contarRespaldo(respaldo)} filas guardado como ${nombre}.`
        + (conFrase ? ' Sin la frase no se puede abrir.' : ''),
      );
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  async function fusionar() {
    try {
      const archivo = await elegirRespaldo();
      if (archivo === null) return;
      const resultado = fusionarRespaldo(db, contexto, abrir(archivo.datos));
      setConflictos(resultado.ejemplos);

      const { nuevas, actualizadas, conflictos: cuantos } = resultado.total;
      setAviso(
        nuevas === 0 && actualizadas === 0
          ? 'Ya estaban sincronizados: nada que traer.'
          : `${nuevas} nuevas, ${actualizadas} actualizadas.`
            + (cuantos === 0 ? '' : ` ${cuantos} se resolvieron por fecha.`),
      );
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  async function restaurar() {
    try {
      const archivo = await elegirRespaldo();
      if (archivo === null) return;
      const filas = restaurarRespaldo(db, contexto, abrir(archivo.datos));
      setConfirmando(null);
      setConflictos([]);
      setAviso(`Restauradas ${filas} filas desde ${archivo.nombre}.`);
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  const identidad = useMemo(() => ({
    dispositivo: leerAjuste(db, CLAVE_DISPOSITIVO),
    hogar: leerAjuste(db, CLAVE_HOGAR),
    miembro: leerAjuste(db, CLAVE_MIEMBRO),
  }), [db]);
  const identidadDelMiembro = identidad.miembro;
  const yo = miembros.find((m: Miembro) => m.id === identidadDelMiembro);

  return (
    <Pantalla sinPeriodo>
      <ScrollView contentContainerStyle={styles.contenido}>
        <Seccion styles={styles} titulo="Apariencia" />
        <View style={styles.fila}>
          <Text style={styles.etiqueta}>Tema</Text>
          <Pressable
            onPress={alternar}
            style={styles.boton}
            accessibilityRole="button"
            accessibilityLabel={`Cambiar a tema ${tema === 'dark' ? 'claro' : 'oscuro'}`}
          >
            <Text style={styles.botonTexto}>{tema === 'dark' ? 'Noche polar' : 'Deshielo'}</Text>
          </Pressable>
        </View>

        <Seccion styles={styles} titulo="Quién escribe" />
        <Text style={styles.notaImportar}>
          Cada movimiento guarda quién lo escribió. Ponerle nombre a este teléfono hace que
          al sincronizar se pueda ver de quién viene cada versión.
        </Text>
        {miembros.map((miembro: Miembro) => {
          const soyYo = miembro.id === identidadDelMiembro;
          return (
            <View key={miembro.id} style={styles.lote}>
              <View style={styles.loteTexto}>
                <Text style={styles.loteArchivo} numberOfLines={1}>{miembro.nombre}</Text>
                <Text style={styles.loteDetalle}>
                  {soyYo ? 'Este teléfono' : 'Otro dispositivo'}
                </Text>
              </View>
            </View>
          );
        })}
        {yo === undefined ? null : (
          <>
            <TextInput
              value={nombrePropio ?? yo.nombre}
              onChangeText={setNombrePropio}
              placeholder="Cómo se llama este teléfono"
              placeholderTextColor={theme.silencio}
              style={styles.entradaFrase}
              accessibilityLabel="Nombre de este dispositivo"
            />
            <Pressable
              onPress={() => {
                try {
                  renombrarMiembro(db, contexto, yo.id, nombrePropio ?? yo.nombre);
                  setNombrePropio(null);
                  setAviso('Listo. El nombre viaja en la próxima sincronización.');
                } catch (e) {
                  setAviso((e as Error).message);
                }
              }}
              style={styles.botonSecundario}
              accessibilityRole="button"
              accessibilityLabel="Guardar el nombre de este dispositivo"
            >
              <Text style={styles.botonTexto}>Guardar nombre</Text>
            </Pressable>
          </>
        )}

        <Seccion styles={styles} titulo="Frase de cifrado" />
        <Text style={styles.notaImportar}>
          Si escribes una, el archivo que exportes queda cifrado y sin ella no se puede
          abrir —ni por ti—. Se usa también para abrir archivos cifrados. No se guarda en
          ninguna parte.
        </Text>
        <TextInput
          value={frase}
          onChangeText={setFrase}
          placeholder="Sin cifrar"
          placeholderTextColor={theme.silencio}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.entradaFrase}
          accessibilityLabel="Frase de cifrado"
        />
        {frase.trim() === '' ? null : (
          <Text style={crypto.fraseDebil(frase) === null ? styles.fraseOk : styles.fraseFloja}>
            {crypto.fraseDebil(frase) ?? 'Se cifrará con esta frase.'}
          </Text>
        )}

        <Seccion styles={styles} titulo="Sincronizar" />
        <Text style={styles.notaImportar}>
          Trae el respaldo del otro dispositivo sin borrar lo tuyo. Lo que esté en los dos
          se resuelve por fecha de edición, y aquí se ve qué versión quedó.
        </Text>
        <Pressable
          onPress={fusionar}
          style={styles.botonSecundario}
          accessibilityRole="button"
          accessibilityLabel="Fusionar con otro dispositivo"
        >
          <Text style={styles.botonTexto}>Fusionar con un archivo</Text>
        </Pressable>

        {conflictos.length === 0 ? null : (
          <View style={styles.conflictos}>
            <Text style={styles.conflictosTitulo}>
              Se descartaron estas versiones por ser más antiguas
            </Text>
            {conflictos.map((conflicto) => (
              <View key={`${conflicto.tabla}|${conflicto.id}`} style={styles.conflicto}>
                <Text style={styles.conflictoGana} numberOfLines={1}>
                  {conflicto.ganadora}
                  {conflicto.escribioGanadora === '' ? '' : ` · ${conflicto.escribioGanadora}`}
                </Text>
                <Text style={styles.conflictoPierde} numberOfLines={1}>
                  antes: {conflicto.descartada}
                  {conflicto.escribioDescartada === '' ? '' : ` · ${conflicto.escribioDescartada}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Seccion styles={styles} titulo="Cuentas" />
        <Text style={styles.notaImportar}>
          El saldo inicial es cuánto había antes del primer movimiento. Sin él, el saldo
          de la app no cuadra con el del banco.
        </Text>
        {cuentas.map((cuenta) => (
          <Link key={cuenta.id} href={{ pathname: '/cuenta/[id]', params: { id: cuenta.id } }} asChild>
            <Pressable
              style={styles.cuenta}
              accessibilityRole="button"
              accessibilityLabel={`Editar la cuenta ${cuenta.nombre}`}
            >
              <View style={styles.loteTexto}>
                <Text style={styles.loteArchivo} numberOfLines={1}>{cuenta.nombre}</Text>
                <Text style={styles.loteDetalle}>
                  {TIPOS_DE_CUENTA_LEGIBLES[cuenta.tipo]}
                  {' · inicial '}{money.format(money.money(cuenta.saldoInicialMinor))}
                </Text>
              </View>
              <Text style={styles.botonTexto}>Editar</Text>
            </Pressable>
          </Link>
        ))}
        <Link href={{ pathname: '/cuenta/[id]', params: { id: 'nueva' } }} asChild>
          <Pressable
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel="Agregar una cuenta"
          >
            <Text style={styles.botonTexto}>Agregar cuenta</Text>
          </Pressable>
        </Link>

        <Seccion styles={styles} titulo="Respaldo" />
        <Text style={styles.notaImportar}>
          Todo lo tuyo en un archivo. Restaurar reemplaza lo que haya: no mezcla.
        </Text>
        <View style={styles.acciones}>
          <Pressable
            onPress={exportar}
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel="Exportar respaldo"
          >
            <Text style={styles.botonTexto}>Exportar</Text>
          </Pressable>
          <Pressable
            onPress={() => (confirmando === 'restaurar' ? restaurar() : setConfirmando('restaurar'))}
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel={confirmando === 'restaurar' ? 'Confirmar restauración' : 'Restaurar respaldo'}
          >
            <Text style={confirmando === 'restaurar' ? styles.botonTextoAlerta : styles.botonTexto}>
              {confirmando === 'restaurar' ? 'Elegir archivo y reemplazar' : 'Restaurar'}
            </Text>
          </Pressable>
        </View>

        <Seccion styles={styles} titulo="Importar" />
        <Text style={styles.notaImportar}>
          Trae los movimientos del .xls que descargas del banco. Reimportar el mismo
          archivo no duplica nada, y cada importación se puede deshacer entera.
        </Text>
        <Link href="/importar" asChild>
          <Pressable
            style={styles.botonPrincipal}
            accessibilityRole="button"
            accessibilityLabel="Importar una cartola"
          >
            <Text style={styles.botonPrincipalTexto}>Importar cartola</Text>
          </Pressable>
        </Link>

        {lotes.length === 0 ? null : [...lotes].reverse().map((lote: Lote) => (
          <View key={lote.id} style={styles.lote}>
            <View style={styles.loteTexto}>
              <Text style={styles.loteArchivo} numberOfLines={1}>{lote.archivo}</Text>
              <Text style={styles.loteDetalle}>
                {lote.cantidad} {lote.cantidad === 1 ? 'movimiento' : 'movimientos'}
                {lote.desde !== null && lote.hasta !== null
                  ? ` · ${dates.formatDate(lote.desde as dates.PlainDate)} — ${dates.formatDate(lote.hasta as dates.PlainDate)}`
                  : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => deshacerLote(db, contexto, lote.id)}
              style={styles.boton}
              accessibilityRole="button"
              accessibilityLabel={`Deshacer la importación de ${lote.archivo}`}
            >
              <Text style={styles.deshacerTexto}>Deshacer</Text>
            </Pressable>
          </View>
        ))}

        <Link href="/reglas-categoria" asChild>
          <Pressable
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel="Reglas de categoría"
          >
            <Text style={styles.botonTexto}>Reglas de categoría</Text>
          </Pressable>
        </Link>

        <Seccion styles={styles} titulo="Empezar de cero" />
        {vacia ? (
          <>
            <Text style={styles.notaImportar}>
              La base está vacía. Puedes cargar 18 meses de datos chilenos inventados para
              ver cómo se comporta la app antes de meter los tuyos.
            </Text>
            <Pressable
              onPress={() => {
                const cuantos = cargarSemilla(db, contexto);
                setAviso(`Cargados ${cuantos} movimientos de prueba.`);
              }}
              style={styles.botonSecundario}
              accessibilityRole="button"
              accessibilityLabel="Cargar datos de prueba"
            >
              <Text style={styles.botonTexto}>Cargar datos de prueba</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.notaImportar}>
              Borra cuentas, movimientos, reglas e importaciones. No se puede deshacer:
              exporta un respaldo antes si hay algo que quieras conservar.
            </Text>
            <Pressable
              onPress={() => {
                if (confirmando !== 'borrar') {
                  setConfirmando('borrar');
                  return;
                }
                borrarTodo(db, contexto);
                // `borrarTodo` se lleva tambien la cuenta, y sin cuenta la app no
                // deja escribir ni un movimiento: quedaria vacia y ademas rota.
                crearCuenta(db, contexto, {
                  nombre: 'Cuenta corriente', tipo: 'corriente', saldoInicialMinor: 0,
                });
                setConfirmando(null);
                setAviso('Se borró todo. Quedó una cuenta vacía para empezar.');
              }}
              style={styles.botonSecundario}
              accessibilityRole="button"
              accessibilityLabel={confirmando === 'borrar' ? 'Confirmar borrado total' : 'Borrar todos los datos'}
            >
              <Text style={confirmando === 'borrar' ? styles.botonTextoAlerta : styles.botonTexto}>
                {confirmando === 'borrar' ? 'Tocar de nuevo para borrar todo' : 'Borrar todos los datos'}
              </Text>
            </Pressable>
          </>
        )}

        {aviso === null ? null : <Text style={styles.aviso}>{aviso}</Text>}

        <Seccion styles={styles} titulo="Período" />
        <Dato
          styles={styles}
          etiqueta="Tipo"
          valor={TIPOS.find((t) => t.valor === periodo.tipo)?.etiqueta ?? periodo.tipo}
        />
        <Dato styles={styles} etiqueta="Desde" valor={periodo.rango.start} />
        <Dato styles={styles} etiqueta="Hasta" valor={periodo.rango.end} />

        <Seccion styles={styles} titulo="Datos" />
        <Dato styles={styles} etiqueta="Movimientos" valor={String(movimientos.length)} />
        <Dato styles={styles} etiqueta="Cuentas" valor={String(cuentas.length)} />
        <Dato styles={styles} etiqueta="Saldo" valor={money.format(saldo)} />
        <Text style={styles.nota}>
          La base arranca vacía, con una cuenta y nada más. Los datos de prueba se cargan
          desde aquí cuando quieras verlos, y se borran igual de fácil.
        </Text>

        <Seccion styles={styles} titulo="Este dispositivo" />
        <Dato styles={styles} etiqueta="Dispositivo" valor={identidad.dispositivo ?? '—'} mono />
        <Dato styles={styles} etiqueta="Hogar" valor={identidad.hogar ?? '—'} mono />
        <Dato styles={styles} etiqueta="Miembro" valor={identidad.miembro ?? '—'} mono />
        <Text style={styles.nota}>
          Se crean una sola vez y no cambian: cada movimiento guarda desde qué dispositivo
          se escribió, que es lo que hará posible el modo hogar.
        </Text>
      </ScrollView>
    </Pantalla>
  );
}

/** Como se lee cada tipo de cuenta en pantalla. */
const TIPOS_DE_CUENTA_LEGIBLES: Record<string, string> = {
  corriente: 'Corriente',
  vista: 'Vista',
  ahorro: 'Ahorro',
  credito: 'Crédito',
  efectivo: 'Efectivo',
};

type Estilos = ReturnType<typeof crearEstilos>;

function Seccion({ styles, titulo }: { styles: Estilos; titulo: string }) {
  return (
    <View style={styles.regla}>
      <Text style={styles.reglaTitulo}>{titulo}</Text>
      <View style={styles.reglaLinea} />
    </View>
  );
}

function Dato(
  { styles, etiqueta, valor, mono }:
  { styles: Estilos; etiqueta: string; valor: string; mono?: boolean },
) {
  return (
    <View style={styles.fila}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={mono ? styles.valorMono : styles.valor} numberOfLines={1}>{valor}</Text>
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    regla: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xl,
      marginBottom: spacing.xs,
    },
    reglaTitulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    reglaLinea: { flex: 1, height: elevation.hairlineWidth, backgroundColor: theme.hairline },

    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    etiqueta: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    valor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.tinta },
    valorMono: {
      flex: 1,
      textAlign: 'right',
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: 10,
      color: theme.tinta,
    },

    boton: {
      paddingVertical: 4,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    botonPrincipal: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: radii.sm,
      backgroundColor: theme.acento,
      marginBottom: spacing.sm,
    },
    botonPrincipalTexto: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.sobreAcento },
    notaImportar: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, lineHeight: 18, color: theme.silencio, paddingBottom: spacing.sm },
    lote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    loteTexto: { flex: 1, gap: 1 },
    loteArchivo: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    loteDetalle: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    deshacerTexto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    acciones: { flexDirection: 'row', gap: spacing.sm },
    entradaFrase: {
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: fontSizes.sm,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
    },
    fraseOk: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.ingresoTexto },
    fraseFloja: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.vencidoTexto },
    conflictos: {
      gap: spacing.sm,
      padding: spacing.md,
      marginTop: spacing.sm,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    conflictosTitulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    conflicto: { gap: 1 },
    conflictoGana: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    conflictoPierde: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, textDecorationLine: 'line-through' },
    cuenta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    botonSecundario: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      alignSelf: 'flex-start',
    },
    botonTextoAlerta: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    aviso: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, lineHeight: 18, color: theme.acentoTexto, paddingTop: spacing.sm },
    botonTexto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },

    nota: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, marginTop: spacing.sm },
  });
}
