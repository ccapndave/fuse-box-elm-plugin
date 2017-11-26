import { File, WorkFlowContext, Plugin } from "fuse-box";
import { resolve } from "path";
import { readFile } from "fs";
import { spawn } from "child_process";
import { tmpName } from "tmp";

const tmp = () =>
  new Promise((resolve, reject) =>
    tmpName((err, path) => (err ? reject(err) : resolve(path)))
  );

export interface ElmPluginOptions {
  warn?: boolean;
  debug?: boolean;
}

export class ElmPluginClass implements Plugin {
  // Match Elm files
  public test: RegExp = /\.elm$/;

  public options: ElmPluginOptions;

  constructor(options: ElmPluginOptions = {}) {
    this.options = Object.assign({}, options);
  }

  public init(context: WorkFlowContext) {
    context.allowExtension(".elm");
  }

  public async transform(file: File) {
    file.loadContents();

    // Get the path to elm-make
    const elmMakePath = getElmMakePath();

    const tmpFilename = `${await tmp()}.js`;

    return await new Promise((resolve, reject) => {
      // Construct the arguments for elm-make
      const args = [
        "--yes",
        "--output",
        tmpFilename,
        this.options.warn ? "--warn" : null,
        this.options.debug ? "--debug" : null,
        file.absPath
      ].filter(x => x !== null);

      const proc = spawn(elmMakePath, args, { stdio: "inherit" });

      proc.on("error", err => reject(err));
      proc.on("close", code => {
        if (code === 0) {
          readFile(tmpFilename, (err, data) => {
            err && reject(err);
            file.contents = data.toString();
            resolve(file);
          });
        } else {
          reject("Failed to compile Elm.");
        }
      });
    });
  }
}

function getElmMakePath() {
  try {
    return resolve("node_modules/.bin/elm-make");
  } catch (_) {}

  return "elm-make";
}

export const ElmPlugin = (options?: ElmPluginOptions) =>
  new ElmPluginClass(options);
