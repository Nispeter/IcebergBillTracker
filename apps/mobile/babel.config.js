module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Las migraciones que genera drizzle-kit importan los .sql directamente.
      // Este plugin los inserta como texto en el bundle; sin el, el import falla.
      ['inline-import', { extensions: ['.sql'] }],
      // Reanimated 4 movio su plugin de Babel a react-native-worklets. Va
      // ultimo a proposito: transforma las worklets despues de que el resto ya
      // corrio.
      'react-native-worklets/plugin',
    ],
  };
};
