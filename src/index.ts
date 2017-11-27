import { File, WorkFlowContext, Plugin } from "fuse-box";
import { resolve } from "path";
import { readFile } from "fs";
import { tmpName } from "tmp";
import * as spawn from "cross-spawn";

const tmp = () =>
  new Promise((resolve, reject) =>
    tmpName((err, path) => (err ? reject(err) : resolve(path)))
  );

const getElmMakePath = (): string => {
  try {
    return resolve("node_modules/.bin/elm-make");
  } catch (_) {}

  return "elm-make";
};

const handleError = (pathToMake: string, err: NodeJS.ErrnoException): void => {
  if (err.code === "ENOENT") {
    console.error(
      `Could not find Elm compiler @ "${pathToMake}" \n Is it installed?`
    );
  } else if (err.code === "EACCES") {
    console.error(
      `Elm compiler @ "${pathToMake}" did not have permission to run. 
      You may need give it executable permissions.`
    );
  } else {
    console.error(
      `Error attempting to run Elm compiler @ "${pathToMake}" \n ${err}`
    );
  }
};

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

  public async transform(file: File): Promise<any> {
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

      proc.on("error", (err: NodeJS.ErrnoException) =>
        handleError(elmMakePath, err)
      );

      proc.on("close", (code: Number) => {
        if (code === 0) {
          readFile(tmpFilename, (err: NodeJS.ErrnoException, data: Buffer) => {
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

export const ElmPlugin = (options?: ElmPluginOptions) =>
  new ElmPluginClass(options);
