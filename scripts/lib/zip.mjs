// Read one entry out of a zip, with no dependencies.
//
// An Android App Bundle is a zip, and `verify-aab.mjs` needs to look inside one.
// The tempting shortcut is a timestamp comparison - "the bundle is newer than its
// inputs" - but that is an inference about what the packaging step did, and the
// whole reason this module exists is that a bundle can be internally perfect and
// still contain the wrong code. So the bundle is opened and read.
//
// The central directory is parsed rather than scanning for local file headers,
// because a local header's size fields are zero whenever the writer used a data
// descriptor, and an AAB is exactly the kind of archive that does. The central
// directory always carries the real sizes.
//
// Layout of a central directory record (offsets from the record's start):
//   0  signature 0x02014b50   10 filename length
//   4  version made by        12 extra length
//   6  version needed         14 comment length
//   8  flags                  16 disk number start
//   10 compression method     18 internal attributes
//   ...                       20 relative offset of local header
// The filename starts at 46. The local header repeats filename+extra lengths,
// so the data begins at localOffset + 30 + fnLen + extraLen.

import { inflateRawSync } from 'node:zlib'

const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50

// Every entry in the archive: { name, size, method, localOffset }.
export function readZipDirectory(buf) {
  // The End Of Central Directory record is at the end, but its offset field is
  // the only reliable pointer, so find it by scanning backwards from the tail.
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record')

  const count = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const entries = []
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(at) !== CENTRAL_SIG) {
      throw new Error(`corrupt zip: expected a central directory record at ${at}`)
    }
    const method = buf.readUInt16LE(at + 10)
    const compressedSize = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const localOffset = buf.readUInt32LE(at + 42)
    entries.push({
      name: buf.toString('utf8', at + 46, at + 46 + nameLen),
      method,
      compressedSize,
      localOffset
    })
    at += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

// The uncompressed bytes of one entry, or null when it is not in the archive.
export function readZipEntry(buf, entry) {
  const lo = entry.localOffset
  if (buf.readUInt32LE(lo) !== LOCAL_SIG) {
    throw new Error(`corrupt zip: no local header for ${entry.name}`)
  }
  const nameLen = buf.readUInt16LE(lo + 26)
  const extraLen = buf.readUInt16LE(lo + 28)
  const start = lo + 30 + nameLen + extraLen
  const raw = buf.subarray(start, start + entry.compressedSize)
  if (entry.method === 0) return raw
  if (entry.method === 8) return inflateRawSync(raw)
  throw new Error(`unsupported zip compression method ${entry.method} for ${entry.name}`)
}

// Convenience: one entry by exact name.
export function readZipFile(buf, directory, name) {
  const entry = directory.find((e) => e.name === name)
  return entry ? readZipEntry(buf, entry) : null
}