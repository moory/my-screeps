const path = require('path');
const commonjs = require('@rollup/plugin-commonjs');
const { nodeResolve } = require('@rollup/plugin-node-resolve');

module.exports = {
  input: 'src/main.js', // 入口文件
  output: {
    file: 'dist/main.js', // 输出文件
    format: 'cjs',        // CommonJS格式
    exports: 'named',
  },
  plugins: [
    nodeResolve(),
    commonjs(),
  ],
};