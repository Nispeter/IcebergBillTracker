/**
 * Sincronizar con otra persona por una carpeta compartida: la carpeta, la
 * palabra de cifrado, y la invitación para juntar dos teléfonos.
 *
 * Los errores de la carpeta se dicen junto a la carpeta; lo demás se confirma
 * con el aviso de siempre.
 */

import { crypto } from '@iceberg/core';
import {
  CLAVE_ARCHIVO_PROPIO, CLAVE_CARPETA, CLAVE_HOGAR, armarInvitacion, escribirAjuste, leerAjuste,
  leerInvitacion, unirseAHogar, type ConflictoLegible,
} from '@iceberg/db';
import { elevation, radii, spacing } from '@iceberg/ui';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Boton } from '../Boton';
import { Campo, Entrada } from '../Formulario';
import { Seccion } from './comun';
import { avisarTrasRemontar, useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { CarpetaPerdidaError, HAY_CARPETA, elegirCarpeta, nombreDeCarpeta } from '../../datos/carpeta';
import { useFraseDeCifrado } from '../../datos/cifrado';
import { useEstilos, type Estilo } from '../../datos/estilos';
import { sincronizarCarpeta } from '../../datos/sincronizar';

export function Sincronizar() {
  const styles = useEstilos(crearEstilos);
  const { db, contexto, cambiarHogar } = useDatos();
  const avisar = useAvisar();
  const cifrado = useFraseDeCifrado();

  const [carpeta, setCarpeta] = useState<string | null>(() => leerAjuste(db, CLAVE_CARPETA) || null);
  const [sincronizando, setSincronizando] = useState(false);
  const [problemaDeCarpeta, setProblemaDeCarpeta] = useState<string | null>(null);
  /** Archivos de la última pasada que se saltaron por venir de otro hogar. */
  const [ajenos, setAjenos] = useState(0);
  const [conflictos, setConflictos] = useState<readonly ConflictoLegible[]>([]);
  /** Lo escrito en el campo, o `null` si nadie lo tocó. */
  const [fraseEditada, setFraseEditada] = useState<string | null>(null);
  /** Lo pegado en "Unirme con una invitación". */
  const [pegada, setPegada] = useState('');
  const hogar = useMemo(() => leerAjuste(db, CLAVE_HOGAR), [db]);

  const frase = fraseEditada ?? cifrado.frase;
  const debilidad = frase === '' ? null : crypto.fraseDebil(frase);

  async function elegir() {
    setProblemaDeCarpeta(null);
    try {
      const elegida = await elegirCarpeta();
      if (elegida === null) return;
      escribirAjuste(db, CLAVE_CARPETA, elegida);
      // El archivo propio vivía en la carpeta anterior.
      escribirAjuste(db, CLAVE_ARCHIVO_PROPIO, '');
      setCarpeta(elegida);
      avisar('Carpeta lista. Desde ahora se sincroniza sola');
    } catch (e) {
      setProblemaDeCarpeta((e as Error).message);
    }
  }

  /**
   * Una pasada: traer lo de los otros y dejar lo propio al día. Un archivo de
   * otro hogar solo entra si alguien lo pide a propósito (`permitirOtroHogar`).
   */
  async function sincronizar(permitirOtroHogar = false) {
    if (carpeta === null) return;
    setProblemaDeCarpeta(null);
    setSincronizando(true);
    try {
      const r = await sincronizarCarpeta(db, contexto, carpeta, { frase: cifrado.frase, permitirOtroHogar });
      setConflictos(r.ejemplos);
      setAjenos(r.ajenos);
      const { nuevas, actualizadas, conflictos: cuantos } = r.total;
      avisar(
        (nuevas === 0 && actualizadas === 0
          ? 'Ya estaban al día'
          : `${nuevas} nuevas, ${actualizadas} actualizadas`
            + (cuantos === 0 ? '' : `. ${cuantos} se resolvieron por fecha`))
        + (r.ajenos === 0 ? '' : `. Se saltaron ${r.ajenos} de otro hogar`)
        + (r.cerrados === 0 ? '' : `. ${r.cerrados} no se pudieron abrir: revisa que la palabra de `
          + 'cifrado sea la misma en los dos teléfonos'),
      );
    } catch (e) {
      // La carpeta se suelta solo cuando el error dice con certeza que ya no
      // hay permiso; por cualquier otro, se queda y se dice qué pasó.
      if (e instanceof CarpetaPerdidaError) {
        escribirAjuste(db, CLAVE_CARPETA, '');
        escribirAjuste(db, CLAVE_ARCHIVO_PROPIO, '');
        setCarpeta(null);
      }
      setProblemaDeCarpeta((e as Error).message);
    } finally {
      setSincronizando(false);
    }
  }

  /** Deja la palabra escrita como la definitiva. Vacía no se acepta. */
  function guardarFrase() {
    const escrita = (fraseEditada ?? '').trim();
    setFraseEditada(null);
    if (escrita === '' || escrita === cifrado.frase) return;
    cifrado.cambiar(escrita);
    avisar('Palabra guardada. Mándale una invitación nueva a la otra persona');
  }

  /** El mensaje entero se puede pegar allá: `leerInvitacion` busca la invitación adentro. */
  function invitar() {
    if (hogar === null || cifrado.frase === '') return;
    Share.share({
      message: 'Únete a mi hogar en Iceberg. Abre Ajustes, Sincronizar, y pega este mensaje '
        + 'en "Unirme con una invitación".\n\n'
        + armarInvitacion({ hogar, frase: cifrado.frase }),
    });
  }

  /** Toma el hogar y la palabra de la invitación, de una vez. */
  function unirse() {
    const invitacion = leerInvitacion(pegada);
    if (invitacion === null) {
      avisar('Eso no es una invitación. Pídele al otro teléfono que la envíe de nuevo');
      return;
    }
    try {
      const filas = unirseAHogar(db, contexto, invitacion.hogar);
      cifrado.cambiar(invitacion.frase);
      setPegada('');
      setFraseEditada(null);
      if (filas === 0) {
        avisar('Listo. Ya estaban en el mismo hogar');
        return;
      }
      // Sin apuntar el contexto al hogar nuevo, las consultas seguirían en el
      // viejo. Eso remonta la app, y con ella el aviso.
      avisarTrasRemontar('Listo. Ahora los dos teléfonos están en el mismo hogar');
      cambiarHogar(invitacion.hogar);
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  return (
    <Seccion
      titulo="Sincronizar"
      ayuda={'Sincronizar deja tus datos en una carpeta del teléfono y trae lo que '
        + 'hayan dejado los demás. La app no habla con ninguna nube: solo con esa '
        + 'carpeta.\n\n'
        + '**Para compartir con otra persona**, una sola vez:\n\n'
        + '1. En los dos teléfonos, creen una carpeta (por ejemplo en Documentos) y '
        + 'sincronícenla con **FolderSync**, en ambos sentidos, contra la misma carpeta '
        + 'de Drive, Dropbox u OneDrive. **Syncthing** también sirve, pero los dos '
        + 'teléfonos tienen que estar en línea a la vez.\n'
        + '2. Cada uno la elige acá con Elegir carpeta.\n'
        + '3. Uno toca "Invitar a otro teléfono" y le manda la invitación al otro.\n'
        + '4. El otro la pega en "Unirme con una invitación" y toca Unirme.\n\n'
        + 'De ahí en adelante la app se sincroniza sola: al abrirla, al salir de ella, '
        + 'unos segundos después de cada cambio y cada minuto mientras está abierta. '
        + 'Sincronizar ahora sirve para no esperar.\n\n'
        + 'Sincronizar nunca borra nada. Si el mismo movimiento se editó en los dos '
        + 'teléfonos, gana la edición más nueva.\n\n'
        + 'Las cuentas marcadas como no compartidas no viajan, así que tampoco '
        + 'quedan respaldadas en la carpeta.\n\n'
        + 'Lo que se deja en la carpeta va **siempre cifrado**, con la palabra que '
        + 'la app se inventó. Los dos teléfonos tienen que tener la misma, y la '
        + 'invitación ya la lleva. Si la cambias, manda una invitación nueva.'}
    >
      {!HAY_CARPETA ? (
        <Text style={styles.nota}>
          Este navegador no sabe abrir una carpeta. Usa la app del teléfono para sincronizar.
        </Text>
      ) : carpeta === null ? (
        <Boton etiqueta="Elegir carpeta compartida" onPress={elegir} />
      ) : (
        <Campo etiqueta="Carpeta">
          <Text style={styles.valor} numberOfLines={1}>{nombreDeCarpeta(carpeta)}</Text>
          <View style={styles.acciones}>
            <Boton
              etiqueta="Sincronizar ahora"
              accesible="Sincronizar con la carpeta"
              onPress={() => sincronizar()}
              cargando={sincronizando}
            />
            <Boton etiqueta="Cambiar carpeta" onPress={elegir} />
          </View>
        </Campo>
      )}

      {problemaDeCarpeta === null ? null : <Text style={styles.problema}>{problemaDeCarpeta}</Text>}

      {ajenos === 0 ? null : (
        <View style={styles.avisoDeHogar}>
          <Text style={styles.avisoDeHogarTexto}>
            {ajenos === 1
              ? 'Hay un archivo en la carpeta que no es de tu hogar. '
              : `Hay ${ajenos} archivos en la carpeta que no son de tu hogar. `}
            Lo que corresponde es unirte a ese hogar con una invitación. Si los mezclas igual,
            sus movimientos quedan con los tuyos y no hay forma de separarlos después.
          </Text>
          <View style={styles.acciones}>
            <Boton
              variante="peligro"
              etiqueta="Mezclar igual"
              confirmar="Tocar de nuevo para mezclar"
              accesible="Mezclar igual, aunque sean de otro hogar"
              onPress={() => sincronizar(true)}
            />
            <Boton etiqueta="Dejarlos fuera" onPress={() => setAjenos(0)} />
          </View>
        </View>
      )}

      {/* Junto a la carpeta porque solo significa algo ahí. Viaja dentro de la
          invitación; se muestra para poder cambiarla. */}
      <Campo
        etiqueta="Palabra de cifrado"
        aviso={debilidad}
        ayuda={frase === '' ? null : 'Todo lo que sale a la carpeta va cifrado con esta palabra.'}
      >
        <Entrada
          value={frase}
          onChangeText={setFraseEditada}
          onBlur={guardarFrase}
          placeholder="Inventándola…"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.codigo}
          accessibilityLabel="Palabra de cifrado"
        />
      </Campo>
      <Boton
        etiqueta="Inventar otra"
        accesible="Inventar otra palabra de cifrado"
        onPress={() => {
          cifrado.renovar();
          setFraseEditada(null);
          avisar('Palabra nueva. Mándale una invitación nueva a la otra persona');
        }}
      />

      {/* El hogar y la palabra van juntos en la invitación: una sola cosa que
          enviar y una sola que pegar. */}
      <Boton
        etiqueta="Invitar a otro teléfono"
        accesible="Enviar una invitación a otro teléfono"
        onPress={invitar}
        deshabilitado={hogar === null || cifrado.frase === ''}
      />
      <Campo etiqueta="Unirme con una invitación">
        <Entrada
          value={pegada}
          onChangeText={setPegada}
          placeholder="Pega aquí la invitación del otro teléfono"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.codigo}
          accessibilityLabel="Invitación del otro teléfono"
        />
      </Campo>
      <Boton
        etiqueta="Unirme"
        accesible="Unirme con esa invitación"
        onPress={unirse}
        deshabilitado={pegada.trim() === ''}
      />

      {conflictos.length === 0 ? null : (
        <View style={styles.conflictos}>
          <Text style={styles.conflictosTitulo}>Se descartaron estas versiones por ser más antiguas</Text>
          {conflictos.map((conflicto) => (
            <View key={`${conflicto.tabla}|${conflicto.id}`} style={styles.conflicto}>
              <Text style={styles.gana} numberOfLines={1}>
                {conflicto.ganadora}
                {conflicto.escribioGanadora === '' ? '' : ` · ${conflicto.escribioGanadora}`}
              </Text>
              <Text style={styles.pierde} numberOfLines={1}>
                antes: {conflicto.descartada}
                {conflicto.escribioDescartada === '' ? '' : ` · ${conflicto.escribioDescartada}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Seccion>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  const linea = t.cuerpo.fontSize + 6;
  return StyleSheet.create({
    acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    nota: t.nota,
    valor: t.cifra,
    // En rojo: es lo único de la sección que exige una decisión.
    problema: { ...t.error, lineHeight: linea },
    avisoDeHogar: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.vencido,
    },
    avisoDeHogarTexto: { ...t.etiqueta, lineHeight: linea, color: theme.tinta },
    // Los códigos se escriben en mono: se dictan carácter por carácter.
    codigo: { ...t.cifra, fontSize: t.cuerpo.fontSize },
    conflictos: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.sm,
      backgroundColor: theme.superficieHonda,
    },
    conflictosTitulo: { ...t.etiqueta, fontWeight: t.seccion.fontWeight, color: theme.tinta },
    conflicto: { gap: 1 },
    gana: t.cifra,
    pierde: { ...t.cifraDeGrafico, textDecorationLine: 'line-through' },
  });
}
