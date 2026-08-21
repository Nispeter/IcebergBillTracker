import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    /**
     * Procesos, no hilos.
     *
     * Estas pruebas abren SQLite de verdad con `better-sqlite3`, que es un
     * modulo nativo. Vitest por omision reparte los archivos en
     * **`worker_threads`**, y ahi el modulo se cae llevandose el worker entero:
     * el sintoma es `Worker exited unexpectedly` de tinypool, repetido una vez
     * por archivo, sin una sola prueba fallida que mirar.
     *
     * No se ve en el computador de uno --depende de como quedo compilado el
     * binario-- y aparece recien en integracion continua, que es donde mas caro
     * sale diagnosticarlo. Un proceso por archivo evita el problema de raiz y
     * cuesta unos milisegundos de arranque.
     */
    pool: 'forks',
  },
});
