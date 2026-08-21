/**
 * Los tipos ambientales de Expo, referenciados desde un archivo **nuestro**.
 *
 * Expo genera `expo-env.d.ts` con esta misma linea, pero lo hace al arrancar el
 * servidor de desarrollo y su propia nota pide no versionarlo. En integracion
 * continua nadie corre `expo start` --y `expo prebuild` tampoco lo crea, esta
 * comprobado-- asi que el archivo no existe, los tipos de Expo no se cargan, y
 * `tsc` empieza a reportar incompatibilidades en `node_modules` que en el
 * computador de uno no aparecen nunca. El sintoma fue un error de props de
 * `Svg` dentro de `phosphor-react-native`, a mil kilometros de la causa.
 *
 * Este archivo si se versiona. Tener la referencia dos veces no molesta:
 * TypeScript las unifica.
 */

/// <reference types="expo/types" />
