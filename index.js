'use strict';

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

/**
 * Wrap fs errors with human-readable messages.
 * @param {Error} err - Original error
 * @param {string} op  - Operation name e.g. "readFile"
 * @param {string} target - File/dir path involved
 */
function wrapError(err, op, target) {
  const codes = {
    ENOENT:    `[fsx:${op}] Path not found: "${target}"`,
    EACCES:    `[fsx:${op}] Permission denied: "${target}"`,
    EEXIST:    `[fsx:${op}] Already exists: "${target}"`,
    ENOTDIR:   `[fsx:${op}] Not a directory: "${target}"`,
    EISDIR:    `[fsx:${op}] Is a directory, not a file: "${target}"`,
    ENOTEMPTY: `[fsx:${op}] Directory not empty: "${target}"`,
    EBUSY:     `[fsx:${op}] Resource busy or locked: "${target}"`,
    EMFILE:    `[fsx:${op}] Too many open files. Close some handles first.`,
    ENOSPC:    `[fsx:${op}] No space left on device.`,
    EPERM:     `[fsx:${op}] Operation not permitted: "${target}"`,
  };
  const message = codes[err.code] || `[fsx:${op}] ${err.message}`;
  const wrapped = new Error(message);
  wrapped.code  = err.code;
  wrapped.cause = err;
  wrapped.path  = target;
  wrapped.op    = op;
  return wrapped;
}

// ─────────────────────────────────────────────
//  READ
// ─────────────────────────────────────────────

/**
 * Read a file as a string (UTF-8 by default).
 * @param {string} filePath
 * @param {BufferEncoding} [encoding='utf8']
 * @returns {Promise<string|Buffer>}
 */
async function readFile(filePath, encoding = 'utf8') {
  try {
    return await fsPromises.readFile(filePath, encoding);
  } catch (err) {
    throw wrapError(err, 'readFile', filePath);
  }
}

/**
 * Read & parse a JSON file in one call.
 * @param {string} filePath
 * @returns {Promise<any>}
 */
async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`[fsx:readJson] Invalid JSON in "${filePath}": ${err.message}`);
  }
}

/**
 * Read all lines of a file as an array (empty lines are kept).
 * @param {string} filePath
 * @returns {Promise<string[]>}
 */
async function readLines(filePath) {
  const content = await readFile(filePath, 'utf8');
  return content.split(/\r?\n/);
}

// ─────────────────────────────────────────────
//  WRITE
// ─────────────────────────────────────────────

/**
 * Write data to a file. Auto-creates parent directories if missing.
 * @param {string} filePath
 * @param {string|Buffer} data
 * @param {BufferEncoding} [encoding='utf8']
 */
async function writeFile(filePath, data, encoding = 'utf8') {
  try {
    await ensureDir(path.dirname(filePath));
    await fsPromises.writeFile(filePath, data, encoding);
  } catch (err) {
    if (err.op) throw err; // already wrapped
    throw wrapError(err, 'writeFile', filePath);
  }
}

/**
 * Serialize an object to JSON and write it to a file.
 * @param {string} filePath
 * @param {any} data
 * @param {number} [indent=2]
 */
async function writeJson(filePath, data, indent = 2) {
  let serialized;
  try {
    serialized = JSON.stringify(data, null, indent);
  } catch (err) {
    throw new Error(`[fsx:writeJson] Cannot serialize data to JSON: ${err.message}`);
  }
  await writeFile(filePath, serialized + '\n', 'utf8');
}

/**
 * Append data to a file. Creates the file if it doesn't exist.
 * @param {string} filePath
 * @param {string|Buffer} data
 */
async function appendFile(filePath, data) {
  try {
    await ensureDir(path.dirname(filePath));
    await fsPromises.appendFile(filePath, data, 'utf8');
  } catch (err) {
    if (err.op) throw err;
    throw wrapError(err, 'appendFile', filePath);
  }
}

// ─────────────────────────────────────────────
//  DIRECTORY
// ─────────────────────────────────────────────

/**
 * Create a directory. Recursive by default (no error if exists).
 * @param {string} dirPath
 */
async function mkdir(dirPath) {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
  } catch (err) {
    throw wrapError(err, 'mkdir', dirPath);
  }
}

/**
 * Alias: ensure a directory exists (creates all parents too).
 * @param {string} dirPath
 */
async function ensureDir(dirPath) {
  return mkdir(dirPath);
}

/**
 * Remove a directory and ALL its contents recursively.
 * Safe: no error if directory doesn't exist.
 * @param {string} dirPath
 */
async function rmdir(dirPath) {
  try {
    await fsPromises.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    throw wrapError(err, 'rmdir', dirPath);
  }
}

/**
 * List files & folders in a directory.
 * @param {string} dirPath
 * @param {{ recursive?: boolean, filesOnly?: boolean, dirsOnly?: boolean }} [opts]
 * @returns {Promise<string[]>} Absolute paths
 */
async function readdir(dirPath, opts = {}) {
  const { recursive = false, filesOnly = false, dirsOnly = false } = opts;
  try {
    if (!recursive) {
      const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(e => {
          if (filesOnly) return e.isFile();
          if (dirsOnly)  return e.isDirectory();
          return true;
        })
        .map(e => path.join(dirPath, e.name));
    }

    // Recursive walk
    const results = [];
    async function walk(dir) {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!filesOnly) results.push(full);
          await walk(full);
        } else {
          if (!dirsOnly) results.push(full);
        }
      }
    }
    await walk(dirPath);
    return results;
  } catch (err) {
    throw wrapError(err, 'readdir', dirPath);
  }
}

// ─────────────────────────────────────────────
//  COPY / MOVE / DELETE
// ─────────────────────────────────────────────

/**
 * Copy a file OR an entire directory tree.
 * @param {string} src
 * @param {string} dest
 * @param {{ overwrite?: boolean }} [opts]
 */
async function copy(src, dest, opts = {}) {
  const { overwrite = true } = opts;
  try {
    const stat = await fsPromises.stat(src);

    if (stat.isFile()) {
      if (!overwrite && await exists(dest)) {
        throw new Error(`[fsx:copy] Destination already exists: "${dest}"`);
      }
      await ensureDir(path.dirname(dest));
      await fsPromises.copyFile(src, dest);
      return;
    }

    if (stat.isDirectory()) {
      await ensureDir(dest);
      const entries = await fsPromises.readdir(src, { withFileTypes: true });
      for (const entry of entries) {
        await copy(
          path.join(src, entry.name),
          path.join(dest, entry.name),
          opts
        );
      }
      return;
    }

    throw new Error(`[fsx:copy] Source is neither file nor directory: "${src}"`);
  } catch (err) {
    if (err.op || err.message.startsWith('[fsx:')) throw err;
    throw wrapError(err, 'copy', src);
  }
}

/**
 * Move (rename) a file or directory. Falls back to copy+delete across drives.
 * @param {string} src
 * @param {string} dest
 */
async function move(src, dest) {
  try {
    await ensureDir(path.dirname(dest));
    await fsPromises.rename(src, dest);
  } catch (err) {
    // Cross-device move (EXDEV): copy then delete
    if (err.code === 'EXDEV') {
      await copy(src, dest);
      await remove(src);
    } else {
      throw wrapError(err, 'move', src);
    }
  }
}

/**
 * Delete a file or directory (recursive). Safe if path doesn't exist.
 * @param {string} target
 */
async function remove(target) {
  try {
    await fsPromises.rm(target, { recursive: true, force: true });
  } catch (err) {
    throw wrapError(err, 'remove', target);
  }
}

// ─────────────────────────────────────────────
//  EXISTENCE / STAT / TYPE CHECKS
// ─────────────────────────────────────────────

/**
 * Check whether a path exists (file or directory).
 * @param {string} target
 * @returns {Promise<boolean>}
 */
async function exists(target) {
  try {
    await fsPromises.access(target, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path is a file.
 * @param {string} target
 * @returns {Promise<boolean>}
 */
async function isFile(target) {
  try {
    return (await fsPromises.stat(target)).isFile();
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory.
 * @param {string} target
 * @returns {Promise<boolean>}
 */
async function isDir(target) {
  try {
    return (await fsPromises.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get file/directory metadata (size, mtime, etc.)
 * @param {string} target
 * @returns {Promise<fs.Stats>}
 */
async function stat(target) {
  try {
    return await fsPromises.stat(target);
  } catch (err) {
    throw wrapError(err, 'stat', target);
  }
}

/**
 * Get file size in bytes. Returns null if not found.
 * @param {string} filePath
 * @returns {Promise<number|null>}
 */
async function size(filePath) {
  try {
    return (await fsPromises.stat(filePath)).size;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
//  SAFE WRITE (atomic) — useful for config/data files
// ─────────────────────────────────────────────

/**
 * Atomically write a file: write to a temp path, then rename.
 * Prevents partial writes from corrupting the file.
 * @param {string} filePath
 * @param {string|Buffer} data
 */
async function writeFileSafe(filePath, data) {
  const tmp = filePath + '.fsx_tmp_' + Date.now();
  try {
    await writeFile(tmp, data);
    await fsPromises.rename(tmp, filePath);
  } catch (err) {
    // Cleanup temp on failure
    await remove(tmp).catch(() => {});
    if (err.op || err.message.startsWith('[fsx:')) throw err;
    throw wrapError(err, 'writeFileSafe', filePath);
  }
}

// ─────────────────────────────────────────────
//  EMPTY CHECK
// ─────────────────────────────────────────────

/**
 * Check if a directory is empty.
 * @param {string} dirPath
 * @returns {Promise<boolean>}
 */
async function isDirEmpty(dirPath) {
  try {
    const entries = await fsPromises.readdir(dirPath);
    return entries.length === 0;
  } catch (err) {
    throw wrapError(err, 'isDirEmpty', dirPath);
  }
}

/**
 * Empty a directory (delete all contents but keep the dir itself).
 * @param {string} dirPath
 */
async function emptyDir(dirPath) {
  try {
    await ensureDir(dirPath);
    const entries = await fsPromises.readdir(dirPath);
    await Promise.all(entries.map(e => remove(path.join(dirPath, e))));
  } catch (err) {
    if (err.op || err.message.startsWith('[fsx:')) throw err;
    throw wrapError(err, 'emptyDir', dirPath);
  }
}

// ─────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────

module.exports = {
  // Read
  readFile,
  readJson,
  readLines,

  // Write
  writeFile,
  writeJson,
  appendFile,
  writeFileSafe,

  // Directory
  mkdir,
  ensureDir,
  rmdir,
  readdir,
  emptyDir,
  isDirEmpty,

  // Copy / Move / Delete
  copy,
  move,
  remove,

  // Checks / Meta
  exists,
  isFile,
  isDir,
  stat,
  size,
};
