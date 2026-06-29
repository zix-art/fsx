import { Stats } from 'fs';

/** Read a file as a string (UTF-8 by default) */
export function readFile(filePath: string, encoding?: BufferEncoding): Promise<string>;
export function readFile(filePath: string, encoding: null): Promise<Buffer>;

/** Read & parse a JSON file */
export function readJson<T = any>(filePath: string): Promise<T>;

/** Read all lines as an array */
export function readLines(filePath: string): Promise<string[]>;

/** Write to a file. Auto-creates parent directories. */
export function writeFile(filePath: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;

/** Serialize and write a JSON file */
export function writeJson(filePath: string, data: any, indent?: number): Promise<void>;

/** Append to a file (creates if not exists) */
export function appendFile(filePath: string, data: string | Buffer): Promise<void>;

/** Atomic write — safe against partial writes on crash */
export function writeFileSafe(filePath: string, data: string | Buffer): Promise<void>;

/** Create a directory recursively. No error if already exists. */
export function mkdir(dirPath: string): Promise<void>;

/** Ensure a directory exists (alias for mkdir) */
export function ensureDir(dirPath: string): Promise<void>;

/** Remove a directory and all its contents. No error if not found. */
export function rmdir(dirPath: string): Promise<void>;

export interface ReaddirOptions {
  recursive?: boolean;
  filesOnly?: boolean;
  dirsOnly?: boolean;
}

/** List contents of a directory. Returns absolute paths. */
export function readdir(dirPath: string, opts?: ReaddirOptions): Promise<string[]>;

/** Delete all contents of a directory (keeps the directory itself) */
export function emptyDir(dirPath: string): Promise<void>;

/** Check if a directory is empty */
export function isDirEmpty(dirPath: string): Promise<boolean>;

export interface CopyOptions {
  overwrite?: boolean;
}

/** Copy a file or entire directory tree */
export function copy(src: string, dest: string, opts?: CopyOptions): Promise<void>;

/** Move a file or directory. Handles cross-device moves automatically. */
export function move(src: string, dest: string): Promise<void>;

/** Delete a file or directory. Safe if path doesn't exist. */
export function remove(target: string): Promise<void>;

/** Check whether a path exists */
export function exists(target: string): Promise<boolean>;

/** Check if a path is a file */
export function isFile(target: string): Promise<boolean>;

/** Check if a path is a directory */
export function isDir(target: string): Promise<boolean>;

/** Get full file/directory metadata */
export function stat(target: string): Promise<Stats>;

/** Get file size in bytes. Returns null if not found. */
export function size(filePath: string): Promise<number | null>;
