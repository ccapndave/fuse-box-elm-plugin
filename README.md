# fuse-box-elm-plugin

[![npm](https://img.shields.io/npm/v/fuse-box-elm-plugin.svg?style=flat-square)](https://www.npmjs.com/package/fuse-box-elm-plugin)
[![license](https://img.shields.io/github/license/ccapndave/fuse-box-elm-plugin.svg?style=flat-square)](https://github.com/ccapndave/fuse-box-elm-plugin/blob/master/LICENSE)
[![npm](https://img.shields.io/npm/dt/fuse-box-elm-plugin.svg?style=flat-square)](https://www.npmjs.com/package/fuse-box-elm-plugin)

A plugin for fuse-box that transpiles and bundles Elm code.

## Installation

```sh
npm install fuse-box-elm-plugin --save-dev
```

## Usage

Simply put `ElmPlugin` in

```ts
import { ElmPlugin } from "fuse-box-elm-plugin"

const fuse = FuseBox.init({
    plugins: [
      ElmPlugin()
    ]
  )};
```

Then `import "./Main.elm"` in your entry file and Fusebox will figure out the rest.

## Options

```ts
ElmPlugin({
  warn: true,
  debug: true
})
```

## Uglifying

This plugin implements the specific arguments that need to be passed to `uglify-js` (actually we use `terser`) in order to minify an optimized Elm file.  To turn this on use:

```ts
ElmPlugin({
  optimize: true,
  uglify: true
})
```