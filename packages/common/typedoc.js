module.exports = {
  extends: '../../config/typedoc.js',
  entryPoints: ['src'],
  out: 'docs',
  exclude: ['test/**/**', 'src/chains/**', 'src/eips/**', 'src/hardforks/**'],
}
