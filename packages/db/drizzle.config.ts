import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './migraciones',
  dialect: 'sqlite',
  // `expo` hace que drizzle-kit emita ademas un migrations.js que la app carga
  // con el migrador de expo-sqlite.
  driver: 'expo',
} satisfies Config;
