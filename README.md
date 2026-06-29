# fsx

> A better `fs` — built for bots, APIs, and scrapers.

`fsx` adalah wrapper di atas Node.js `fs` dengan tiga keunggulan utama:

1. **Rekursif otomatis** — `mkdir`, `rmdir`, `copy folder` tanpa opsi tambahan
2. **Error yang jelas** — pesan error human-readable, bukan kode OS
3. **Utilitas extra** — hal-hal yang kurang dari `fs` bawaan

Semua fungsi adalah **async/await**. Tidak ada callback.

---

## Install

```bash
# Salin folder fsx ke project kamu, lalu:
const fsx = require('./fsx');          // CommonJS
import * as fsx from './fsx/src/fsx.mjs'; // ESM
```

---

## API

### Read

| Fungsi | Deskripsi |
|--------|-----------|
| `readFile(path, encoding?)` | Baca file sebagai string (default UTF-8) |
| `readJson(path)` | Baca & parse JSON langsung |
| `readLines(path)` | Baca file → array of lines |

```js
const html   = await fsx.readFile('page.html');
const config = await fsx.readJson('config.json');
const lines  = await fsx.readLines('proxies.txt');
```

---

### Write

| Fungsi | Deskripsi |
|--------|-----------|
| `writeFile(path, data)` | Tulis file, **auto-buat parent folder** |
| `writeJson(path, data, indent?)` | Serialize + tulis JSON |
| `appendFile(path, data)` | Append ke file (buat jika belum ada) |
| `writeFileSafe(path, data)` | **Atomic write** — tidak corrupt jika crash |

```js
// fs biasa: harus mkdir dulu. fsx: langsung saja.
await fsx.writeFile('output/data/result.json', JSON.stringify(data));

// Atomic — aman untuk config/database file kecil
await fsx.writeFileSafe('session.json', JSON.stringify(session));
```

> **`writeFileSafe`** menulis ke file `.tmp` dulu, baru di-rename.
> Kalau proses crash di tengah jalan, file asli tetap utuh.

---

### Directory

| Fungsi | Deskripsi |
|--------|-----------|
| `mkdir(path)` | Buat folder, **rekursif otomatis**, tidak error jika sudah ada |
| `ensureDir(path)` | Alias `mkdir` — pastikan folder ada |
| `rmdir(path)` | Hapus folder + semua isinya, **tidak error jika tidak ada** |
| `readdir(path, opts?)` | List isi folder |
| `emptyDir(path)` | Kosongkan folder (isi dihapus, folder tetap) |
| `isDirEmpty(path)` | Cek apakah folder kosong |

```js
// fs biasa butuh { recursive: true }. fsx: tidak perlu.
await fsx.mkdir('logs/2024/december');

// readdir dengan filter
const files = await fsx.readdir('downloads', {
  recursive: true,   // masuk ke subfolder
  filesOnly: true,   // hanya file, bukan folder
});

await fsx.emptyDir('cache'); // hapus isi cache, tapi folder-nya tetap ada
```

---

### Copy / Move / Delete

| Fungsi | Deskripsi |
|--------|-----------|
| `copy(src, dest, opts?)` | Copy file **atau folder** (rekursif otomatis) |
| `move(src, dest)` | Pindahkan file/folder, support cross-drive |
| `remove(target)` | Hapus file atau folder, **aman jika tidak ada** |

```js
// Copy seluruh folder
await fsx.copy('templates/base', 'projects/new-bot');

// Move cross-drive tetap bekerja (copy + delete otomatis)
await fsx.move('/tmp/download.json', '/data/scraped/result.json');

// Hapus tanpa cek exists dulu
await fsx.remove('old-cache');
```

---

### Checks & Metadata

| Fungsi | Return | Deskripsi |
|--------|--------|-----------|
| `exists(path)` | `boolean` | Cek apakah path ada |
| `isFile(path)` | `boolean` | Cek apakah file |
| `isDir(path)` | `boolean` | Cek apakah folder |
| `stat(path)` | `fs.Stats` | Metadata lengkap |
| `size(path)` | `number\|null` | Ukuran file dalam bytes |

```js
if (await fsx.exists('session.json')) {
  const session = await fsx.readJson('session.json');
}

const bytes = await fsx.size('dump.html');
console.log(`File size: ${bytes} bytes`);
```

---

## Error Messages

`fsx` memberikan pesan error yang jelas, bukan kode OS mentah.

```
// fs biasa:
Error: ENOENT: no such file or directory, open 'config.json'

// fsx:
Error: [fsx:readFile] Path not found: "config.json"
```

Semua error juga memiliki properti:
- `err.code` — kode OS asli (`ENOENT`, `EACCES`, dll)
- `err.path` — path yang menyebabkan error
- `err.op`   — nama fungsi fsx yang gagal
- `err.cause` — error original

---

## Perbandingan dengan `fs`

| Kasus | `fs` | `fsx` |
|-------|------|-------|
| Buat nested folder | `fs.mkdirSync(p, { recursive: true })` | `fsx.mkdir(p)` |
| Buat file + folder parent | mkdir dulu, baru writeFile | `fsx.writeFile(p, data)` |
| Copy folder | Tidak ada — harus loop manual | `fsx.copy(src, dest)` |
| Hapus folder isi | `fs.rm(p, { recursive:true, force:true })` | `fsx.remove(p)` |
| Cek file ada | `fs.existsSync()` (sync) / try-catch | `fsx.exists(p)` |
| Baca JSON | readFile + JSON.parse | `fsx.readJson(p)` |
| Atomic write | Tidak ada | `fsx.writeFileSafe(p, data)` |
| Error message | Kode OS | Human-readable + `.code`, `.path`, `.op` |

---

## Requirements

- Node.js ≥ 14
- Zero dependencies (hanya pakai `fs` bawaan Node)

##Credit by Zx?
