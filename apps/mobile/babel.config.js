module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 movio su plugin de Babel a react-native-worklets. Va ultimo
    // en la lista a proposito: transforma las worklets despues de que el resto
    // ya corrio.
    plugins: ['react-native-worklets/plugin'],
  };
};
