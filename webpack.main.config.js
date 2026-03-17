const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/main/main.ts',
  target: 'electron-main',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'main.js',
  },
  externals: {
    'node-pty': 'commonjs node-pty',
    'simple-git': 'commonjs simple-git',
  },
};
