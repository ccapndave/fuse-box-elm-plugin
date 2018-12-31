import { File, WorkFlowContext, Plugin } from "fuse-box";
//import { File, WorkFlowContext, Plugin } from "../../fuse-box/.dev";
import { ChildProcess } from "child_process";
import { resolve, relative } from "path";
import { readFile, existsSync } from "fs";
import { tmpName } from "tmp";
import * as spawn from "cross-spawn";
import { findAllDependencies } from "find-elm-dependencies"

const tmp = () =>
  new Promise((resolve, reject) =>
    tmpName((err, path) => (err ? reject(err) : resolve(path)))
  );

export interface ElmPluginOptions {
  warn?: boolean;
  debug?: boolean;
  optimize?: boolean;
  uglify?: boolean;
}

export class ElmPluginClass implements Plugin {
  // Match Elm files
  public test: RegExp = /\.elm$/;

  public context: WorkFlowContext;

  public options: ElmPluginOptions;

  constructor(options: ElmPluginOptions = {}) {
    this.options = { ...options };
  }

  public init(context: WorkFlowContext): void {
    this.context = context;
    context.allowExtension(".elm");
  }

  private isElm019(): boolean {
    return existsSync(resolve(this.context.homeDir, "elm.json"));
  }

  private getElmMakePath(): string {
    if (this.isElm019()) {
      try {
        return resolve("node_modules/.bin/elm");
      } catch (_) { }

      return "elm";
    } else {
      try {
        return resolve("node_modules/.bin/elm-make");
      } catch (_) { }

      return "elm-make";
    }
  }

  public async transform(file: File): Promise<any> {
    if (this.context.useCache) {
      if (this.context.bundle && this.context.bundle.lastChangedFile && file.loadFromCache()) {
        const lastChangedFile = file.context.convertToFuseBoxPath(this.context.bundle.lastChangedFile);
        const isElmDependency = file.analysis.dependencies.indexOf(lastChangedFile) >= 0;

        // We never go any deeper since elm-make bundles for us
        file.analysis.dependencies = [];

        // If this isn't a dependency of the entry Elm file then there is no need to recompile
        if (!isElmDependency) {
          return;
        }
      }
    }

    file.loadContents();

    // Get the path to elm-make
    const elmMakePath: string = this.getElmMakePath();

    // Create temporary JS file
    const tmpFilename: string = `${await tmp()}.js`;

    return new Promise((resolve, reject) => {
      // Construct the arguments for elm-make
      const args = this.isElm019() ?
        [
          `make`,
          `--output=${tmpFilename}`,
          this.options.optimize ? "--optimize" : null,
          this.options.debug ? "--debug" : null,
          file.absPath
        ].filter(x => x !== null)
        :
        [
          "--yes",
          "--output",
          tmpFilename,
          this.options.warn ? "--warn" : null,
          this.options.debug ? "--debug" : null,
          file.absPath
        ].filter(x => x !== null);

      const proc: ChildProcess = spawn(elmMakePath, args, { cwd: this.context.homeDir, stdio: "inherit" });

      proc.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          reject(
            `Could not find Elm compiler @ "${elmMakePath}"
             \nHave you installed elm yet? If not, please install "elm" via npm`
          );
        } else if (err.code === "EACCES") {
          reject(
            `Elm compiler @ "${elmMakePath}" did not have permission to run
            \nYou may need give it executable permissions`
          );
        } else {
          reject(
            `Error attempting to run Elm compiler @ "${elmMakePath}" \n ${err}`
          );
        }
      });

      proc.on("close", (code: Number) => {
        if (code === 0) {
          readFile(tmpFilename, (err: NodeJS.ErrnoException, data: Buffer) => {
            if (err) {
              reject(err);
            } else {
              file.contents = data.toString();

              findAllDependencies(file.absPath)
                .then((paths: string[]) => {
                  if (this.context.useCache) {
                    // Make the paths relative to the home directory
                    paths = paths.map(path => relative(this.context.homeDir, path));

                    file.analysis.dependencies = paths;

                    this.context.emitJavascriptHotReload(file);
                    this.context.cache.writeStaticCache(file, file.sourceMap);

                    file.analysis.dependencies = [];
                  }

                  if (this.options.uglify) {
                    const Terser = require("terser");

                    const compressed = Terser.minify(file.contents, {
                      compress: {
                        pure_funcs: "F2,F3,F4,F5,F6,F7,F8,F9,A2,A3,A4,A5,A6,A7,A8,A9",
                        pure_getters: true,
                        keep_fargs: false,
                        unsafe_comps: true,
                        unsafe: true
                      }
                    });

                    if (compressed.error) {
                      reject(compressed.error);
                    } else {
                      const mangled = Terser.minify(compressed.code, {
                        mangle: {}
                      });

                      if (mangled.error) {
                        reject(mangled.error);
                      } else {
                        file.contents = mangled.code;
                        resolve(file);
                      }
                    }
                  } else {
                    resolve(file);
                  }
                })
                .catch((err: string) => {
                  reject(err);
                });
            }
          });
        } else {
          reject("Failed to compile Elm. code=" + code);
        }
      });
    });
  }
}

export const ElmPlugin = (options?: ElmPluginOptions) =>
  new ElmPluginClass(options);
