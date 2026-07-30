const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const multer = require("multer");
const yauzl = require("yauzl");

const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;
const MAX_ENTRY_BYTES = 15 * 1024 * 1024;
const MAX_ENTRIES = 200;

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, callback) => callback(null, `edme-${crypto.randomUUID()}.xlsx`),
  }),
  limits: { fileSize: MAX_COMPRESSED_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const allowedMime = new Set([
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ]);
    callback(extension === ".xlsx" && allowedMime.has(file.mimetype)
      ? null
      : new multer.MulterError("LIMIT_UNEXPECTED_FILE"));
  },
});

function validateXlsxArchive(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (openError, zipFile) => {
      if (openError) return reject(new Error("invalid_xlsx_archive"));
      let entries = 0;
      let totalSize = 0;
      zipFile.readEntry();
      zipFile.on("entry", (entry) => {
        entries += 1;
        totalSize += entry.uncompressedSize;
        const unsafePath = entry.fileName.includes("..") || path.isAbsolute(entry.fileName);
        if (
          unsafePath ||
          entries > MAX_ENTRIES ||
          entry.uncompressedSize > MAX_ENTRY_BYTES ||
          totalSize > MAX_UNCOMPRESSED_BYTES
        ) {
          zipFile.close();
          return reject(new Error("xlsx_archive_limits_exceeded"));
        }
        zipFile.readEntry();
      });
      zipFile.on("end", resolve);
      zipFile.on("error", reject);
    });
  });
}

async function removeUpload(filePath) {
  if (!filePath) return;
  await fs.unlink(filePath).catch(() => {});
}

module.exports = {
  upload,
  validateXlsxArchive,
  removeUpload,
  MAX_COMPRESSED_BYTES,
};
