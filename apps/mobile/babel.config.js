module.exports = function (api) {
  api.cache(true);
  const presets = ['module:@react-native/babel-preset']
  const plugins = [
    [
      'module-resolver',
      {
        root: ["./src"],
        alias: {
          'crypto': 'react-native-quick-crypto',
          'stream': 'readable-stream',
          'buffer': '@craftzdog/react-native-buffer',
          'base64-js': 'react-native-quick-base64',
          "@components/*": "./src/components",
          "@providers/*": "./src/providers",
          "@routes/*": "./src/routes",
          "@screens/*": "./src/screens",
          "@assets/*": "./src/../assets",
        },
      },
    ],
    '@babel/plugin-transform-export-namespace-from',
  ]

  return {
    presets,
    plugins
  }
};
