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
  deshacerLote, editarCuenta, exportarRespaldo, fusionarRespaldo, leerAjuste, renombrarMiembro,
  restaurarRespaldo, type ConflictoLegible, type Lote, type Miembro,
} from '@iceberg/db';
import {
  AIRE_PARA_EL_FLOTANTE, elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { Ayuda } from '../../components/Ayuda';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { Panel } from '../../components/Panel';
import { Pantalla } from '../../components/Pantalla';
import { Titulo } from '../../components/Titulo';
import { useDesplazamiento } from '../../datos/desplazamiento';
import { useDatos } from '../../datos/BaseDeDatos';
import {
  useCuentas, useLotes, useMiembros, useMovimientos, useSaldo, useSaldoInicial,
} from '../../datos/consultas';
import { useCuentaActiva } from '../../datos/cuenta';
import { TIPOS, usePeriodo } from '../../datos/periodo';
import { elegirRespaldo, guardarRespaldo } from '../../datos/archivo';
import { cargarSemilla } from '../../datos/semilla';
import { useTema } from '../../datos/tema';

export default function Ajustes() {
  const { nombre: tema, theme, alternar } = useTema();
  const desplazamiento = useDesplazamiento();
  const { porDefecto, marcarPorDefecto } = useCuentaActiva();
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

  /**
   * Guarda un archivo con lo que hay.
   *
   * `soloSincronizables` distingue **respaldar** de **compartir**, que no son lo
   * mismo: un respaldo lleva todo, porque si perdieras el telefono querrias de
   * vuelta tambien lo privado; el archivo que se le pasa a otra persona deja
   * fuera las cuentas marcadas como que no sincronizan.
   */
  async function exportar(soloSincronizables = false) {
    try {
      const respaldo = exportarRespaldo(db, contexto, { soloSincronizables });
      const dia = respaldo.exportadoEn.slice(0, 10);
      const conFrase = frase.trim() !== '';

      // Se cifra solo si hay frase. Pedirla siempre haria que alguien que solo
      // quiere un respaldo local invente una y la olvide.
      const contenido = conFrase
        ? JSON.stringify(crypto.cifrar(JSON.stringify(respaldo), frase))
        : JSON.stringify(respaldo);
      const que = soloSincronizables ? 'compartir' : 'iceberg';
      const nombre = conFrase ? `${que}-${dia}.cifrado.json` : `${que}-${dia}.json`;

      await guardarRespaldo(nombre, contenido);
      const fuera = cuentas.filter((c) => c.sincroniza === 0).length;
      setAviso(
        `${soloSincronizables ? 'Archivo' : 'Respaldo'} con ${contarRespaldo(respaldo)} `
        + `filas guardado como ${nombre}.`
        + (soloSincronizables && fuera > 0
          ? ` Quedaron fuera ${fuera === 1 ? 'una cuenta' : `${fuera} cuentas`}.`
          : '')
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
      <ScrollView contentContainerStyle={styles.contenido} {...desplazamiento}>
        <Seccion styles={styles} theme={theme} titulo="Apariencia" />
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

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Quién escribe"
          ayuda={'Cada movimiento guarda quién lo escribió. Ponerle nombre a este teléfono '
            + 'hace que al sincronizar se pueda ver de quién viene cada versión.'}
        />
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

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Frase de cifrado"
          ayuda={'Si escribes una, el archivo que exportes queda cifrado y sin ella no se '
            + 'puede abrir, ni por ti. Se usa también para abrir archivos cifrados. '
            + 'No se guarda en ninguna parte.'}
        />
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

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Sincronizar"
          ayuda={'Trae el respaldo del otro dispositivo sin borrar lo tuyo. Lo que esté en '
            + 'los dos se resuelve por fecha de edición, y aquí se ve qué versión quedó. '
            + 'Las cuentas que marcaste como no compartidas no salen en el archivo, y '
            + 'tampoco entran si el otro dispositivo todavía las manda.'}
        />
        <Pressable
          onPress={fusionar}
          style={styles.botonSecundario}
          accessibilityRole="button"
          accessibilityLabel="Fusionar con otro dispositivo"
        >
          <Text style={styles.botonTexto}>Fusionar con un archivo</Text>
        </Pressable>
        <Pressable
          onPress={() => exportar(true)}
          style={styles.botonSecundario}
          accessibilityRole="button"
          accessibilityLabel="Exportar un archivo para compartir"
        >
          <Text style={styles.botonTexto}>Exportar para compartir</Text>
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

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Cuentas"
          ayuda={'El saldo inicial es cuánto había antes del primer movimiento que '
            + 'registres. Sin él, el saldo de la app no cuadra con el del banco. '
            + 'La estrella marca con cuál abre la app. Si una cuenta no se comparte, '
            + 'lo dice aquí abajo y se cambia al editarla.'}
        />
        {cuentas.map((cuenta) => (
          <View key={cuenta.id} style={styles.cuenta}>
            {/* La estrella va **fuera** del `Link`: dentro, tocarla navegaria a
                editar la cuenta en vez de marcarla. Volver a tocar la marcada la
                desmarca, y la app vuelve a abrir con todas juntas. */}
            <Pressable
              onPress={() => marcarPorDefecto(porDefecto === cuenta.id ? null : cuenta.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ selected: porDefecto === cuenta.id }}
              accessibilityLabel={porDefecto === cuenta.id
                ? `${cuenta.nombre} es la cuenta con la que abre la app. Tocar para quitarla`
                : `Abrir la app con ${cuenta.nombre}`}
            >
              <Star
                size={16}
                weight={porDefecto === cuenta.id ? 'fill' : 'regular'}
                color={porDefecto === cuenta.id ? theme.acentoTexto : theme.silencio}
              />
            </Pressable>
            <Link href={{ pathname: '/cuenta/[id]', params: { id: cuenta.id } }} asChild>
              <Pressable
                style={styles.cuentaTocable}
                accessibilityRole="button"
                accessibilityLabel={`Editar la cuenta ${cuenta.nombre}`}
              >
                <View style={styles.loteTexto}>
                  <Text style={styles.loteArchivo} numberOfLines={1}>{cuenta.nombre}</Text>
                  <Text style={styles.loteDetalle}>
                    {TIPOS_DE_CUENTA_LEGIBLES[cuenta.tipo]}
                    {' · inicial '}{money.format(money.money(cuenta.saldoInicialMinor))}
                    {cuenta.sincroniza === 0 ? ' · no se comparte' : ''}
                  </Text>
                </View>
                <Text style={styles.botonTexto}>Editar</Text>
              </Pressable>
            </Link>
          </View>
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

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Respaldo"
          ayuda={'Todo lo tuyo en un archivo. Restaurar reemplaza lo que haya: no mezcla. '
            + 'Para juntar dos dispositivos sin perder nada, usa Sincronizar.'}
        />
        <View style={styles.acciones}>
          <Pressable
            // Sin la lambda, `Pressable` le pasa el evento como primer argumento
            // y el respaldo saldria en modo compartir por accidente.
            onPress={() => exportar()}
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

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Importar"
          ayuda={'Trae los movimientos del .xls que descargas del banco. Reimportar el '
            + 'mismo archivo no duplica nada, y cada importación se puede deshacer entera.'}
        />
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

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Empezar de cero"
          ayuda={'Borra cuentas, movimientos, reglas e importaciones de este dispositivo. '
            + 'No se puede deshacer: exporta un respaldo antes si hay algo que conservar.'}
        />
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
              style={[styles.botonSecundario, styles.botonDestructivo]}
              accessibilityRole="button"
              accessibilityLabel={confirmando === 'borrar' ? 'Confirmar borrado total' : 'Borrar todos los datos'}
            >
              <Text style={confirmando === 'borrar' ? styles.botonTextoAlerta : styles.botonTextoDestructivo}>
                {confirmando === 'borrar' ? 'Tocar de nuevo para borrar todo' : 'Borrar todos los datos'}
              </Text>
            </Pressable>
          </>
        )}

        {aviso === null ? null : <Text style={styles.aviso}>{aviso}</Text>}

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Período"
          ayuda={'El rango que están mirando todas las pantallas. Se cambia desde la barra '
            + 'de arriba, no desde aquí: acá solo se ve cuál está puesto.'}
        />
        <Panel theme={theme}>
          <Dato
            styles={styles}
            etiqueta="Tipo"
            valor={TIPOS.find((t) => t.valor === periodo.tipo)?.etiqueta ?? periodo.tipo}
          />
          <Dato styles={styles} etiqueta="Desde" valor={periodo.rango.start} />
          <Dato styles={styles} etiqueta="Hasta" valor={periodo.rango.end} />
        </Panel>

        <Seccion styles={styles} theme={theme} titulo="Datos" />
        <Panel theme={theme}>
          <Dato styles={styles} etiqueta="Movimientos" valor={String(movimientos.length)} />
          <Dato styles={styles} etiqueta="Cuentas" valor={String(cuentas.length)} />
          <Dato styles={styles} etiqueta="Saldo" valor={money.format(saldo)} />
        </Panel>
        <Text style={styles.nota}>
          La base arranca vacía, con una cuenta y nada más. Los datos de prueba se cargan
          desde aquí cuando quieras verlos, y se borran igual de fácil.
        </Text>

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Este dispositivo"
          ayuda={'Se crean una sola vez y no cambian. Cada movimiento guarda desde qué '
            + 'dispositivo se escribió, que es lo que hace posible el modo hogar.'}
        />
        <Panel theme={theme}>
          <Dato styles={styles} etiqueta="Dispositivo" valor={identidad.dispositivo ?? '—'} mono />
          <Dato styles={styles} etiqueta="Hogar" valor={identidad.hogar ?? '—'} mono />
          <Dato styles={styles} etiqueta="Miembro" valor={identidad.miembro ?? '—'} mono />
        </Panel>

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

/**
 * El titulo de una seccion, con su explicacion detras de un `?`.
 *
 * Ajustes tenia diez parrafos explicativos, uno por seccion. Todos ciertos y
 * todos ruido despues de la primera lectura: para quien ya sabe que hace
 * "Respaldo", esas tres lineas son solo distancia hasta el boton. Detras del `?`
 * siguen estando y no ocupan.
 */
function Seccion(
  { styles, theme, titulo, ayuda }:
  { styles: Estilos; theme: Theme; titulo: string; ayuda?: string },
) {
  // La regla horizontal se fue: once secciones eran once lineas que solo decian
  // donde empieza cada una, nunca donde termina. Ver `components/Titulo.tsx`.
  return <Titulo texto={titulo} ayuda={ayuda} theme={theme} estilo={styles.seccion} />;
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
      paddingBottom: AIRE_PARA_EL_FLOTANTE,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    // Ajustes tiene once secciones seguidas: el aire por defecto de `Titulo`
    // --pensado para dos o tres por pantalla-- las separaba demasiado y la
    // pantalla se hacia interminable.
    seccion: { marginTop: spacing.xl },

    // Sin subrayado: dos columnas alineadas ya se leen como tabla, y el panel
    // dice donde empieza y donde termina el grupo.
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      paddingVertical: 5,
    },
    // La fila de cuenta ahora lleva la estrella al lado del enlace.
    cuentaTocable: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', gap: spacing.lg,
    },
    // Lo irreversible no puede verse igual que lo reversible: "Borrar todos los
    // datos" tenia el mismo borde y el mismo color que "Exportar".
    botonDestructivo: { borderColor: theme.vencido },
    botonTextoDestructivo: {
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: fontSizes.xs,
      color: theme.vencidoTexto,
    },
    etiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencioHondo },
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
    botonPrincipalTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.sobreAcento },
    notaImportar: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, lineHeight: 18, color: theme.silencio, paddingBottom: spacing.sm },
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
    loteDetalle: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    deshacerTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.vencidoTexto },
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
    fraseOk: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.ingresoTexto },
    fraseFloja: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.vencidoTexto },
    conflictos: {
      gap: spacing.sm,
      padding: spacing.md,
      marginTop: spacing.sm,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    conflictosTitulo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
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
    botonTextoAlerta: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, lineHeight: 18, color: theme.acentoTexto, paddingTop: spacing.sm },
    botonTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },

    nota: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, marginTop: spacing.sm },
  });
}
