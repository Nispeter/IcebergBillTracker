/**
 * Adonde llega el link de invitación: `iceberg://unirse?i=<invitación>`, que
 * abre la página de invitación desde WhatsApp. Pide confirmar antes de unirse:
 * un link lo puede tocar cualquiera, y unirse mezcla los datos de este
 * teléfono con los del hogar.
 */

import { CLAVE_HOGAR, leerAjuste, leerInvitacion } from '@iceberg/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Boton } from '../components/Boton';
import { ErrorDelFormulario, Formulario } from '../components/Formulario';
import { PantallaModal } from '../components/PantallaModal';
import { useDatos } from '../datos/BaseDeDatos';
import { useEstilos, type Estilo } from '../datos/estilos';
import { volver } from '../datos/navegacion';
import { useUnirse } from '../datos/unirse';

export default function Unirse() {
  const styles = useEstilos(crearEstilos);
  const router = useRouter();
  const { db } = useDatos();
  const unirseCon = useUnirse();
  const { i } = useLocalSearchParams<{ i?: string }>();
  const [error, setError] = useState<string | null>(null);

  const invitacion = useMemo(() => leerInvitacion(i ?? ''), [i]);
  const yaEstamos = invitacion !== null && invitacion.hogar === leerAjuste(db, CLAVE_HOGAR);

  function unirme() {
    if (invitacion === null) return;
    try {
      // Primero a la pantalla de inicio: unirse remonta la app, y así no
      // vuelve a abrir esta.
      volver(router);
      unirseCon(invitacion);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <Formulario titulo="Unirme a un hogar" onCancelar={() => volver(router)}>
        {invitacion === null ? (
          <Text style={styles.texto}>
            Este link no trae una invitación que se pueda leer. Pídele a la otra persona que la
            envíe de nuevo desde Ajustes, Sincronizar.
          </Text>
        ) : yaEstamos ? (
          <Text style={styles.texto}>Este teléfono ya está en ese hogar.</Text>
        ) : (
          <>
            <Text style={styles.texto}>
              Este teléfono va a quedar en el mismo hogar que quien te invitó, y lo que ya
              anotaste acá pasa a ese hogar.
              {invitacion.frase === undefined
                ? ' Se comparte como planilla, sin cifrar.'
                : ' Se comparte cifrado, con la palabra que trae la invitación.'}
            </Text>
            <Text style={styles.nota}>
              Las cuentas que marcaste como no compartidas siguen solo en este teléfono.
            </Text>
            <ErrorDelFormulario error={error} />
            <Boton etiqueta="Unirme" accesible="Unirme a ese hogar" onPress={unirme} />
          </>
        )}
      </Formulario>
    </PantallaModal>
  );
}

function crearEstilos({ t }: Estilo) {
  return StyleSheet.create({
    texto: { ...t.cuerpo, lineHeight: t.cuerpo.fontSize + 8 },
    nota: t.nota,
  });
}
