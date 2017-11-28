import { File, WorkFlowContext, Plugin } from "fuse-box";
import { ChildProcess } from "child_process";
import { resolve } from "path";
import { readFile } from "fs";
import { tmpName } from "tmp";
import * as spawn from "cross-spawn";

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
    this.options = { ...options };
  }

  public init(context: WorkFlowContext): void {
    context.allowExtension(".elm");
  }

  public getElmMakePath(): string {
    try {
      return resolve("node_modules/.bin/elm-make");
    } catch (_) {}

    return "elm-make";
  }

  public async transform(file: File): Promise<any> {
    file.loadContents();

    // Get the path to elm-make
    const elmMakePath: string = this.getElmMakePath();

    // Create temporary JS file
    const tmpFilename: string = `${await tmp()}.js`;

    return new Promise((resolve, reject) => {
      // Construct the arguments for elm-make
      const args = [
        "--yes",
        "--output",
        tmpFilename,
        this.options.warn ? "--warn" : null,
        this.options.debug ? "--debug" : null,
        file.absPath
      ].filter(x => x !== null);

      const proc: ChildProcess = spawn(elmMakePath, args, { stdio: "inherit" });

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
              resolve(file);
            }
          });
        } else {
          reject("Failed to compile Elm.");
        }
      });
    });
  }
}

export const ElmPlugin = (options?: ElmPluginOptions) =>
  new ElmPluginClass(options);
