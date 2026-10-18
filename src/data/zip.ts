import { Unzip, UnzipInflate } from 'fflate';

const decoder = new TextDecoder('utf-8', { fatal: true });

export function unpackZip(bytes: Uint8Array, options: { maxCompressed: number; maxExpanded: number; maxFiles: number; validCounts?: number[]; allowName: (name: string) => boolean; error: string }) {
  const invalid = () => new Error(`${options.error}_ZIP`);
  const oversized = () => new Error(`${options.error}_SIZE`);
  if (bytes.length > options.maxCompressed || bytes.length < 22) throw oversized();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { end = offset; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw invalid();
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  const start = view.getUint32(end + 16, true);
  if (count > options.maxFiles || (options.validCounts && !options.validCounts.includes(count)) || count !== view.getUint16(end + 8, true) || start + size !== end) throw invalid();
  const entries = new Map<string, number>();
  const ranges: [number, number][] = [];
  let offset = start, total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw invalid();
    const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true), uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true);
    const attributes = view.getUint32(offset + 38, true);
    const fileType = (attributes >>> 16) & 0xf000;
    const local = view.getUint32(offset + 42, true);
    if (flags & 9 || ![0, 8].includes(method) || (fileType && fileType !== 0x8000) || attributes & 0x10 || compressed === 0xffffffff || uncompressed === 0xffffffff || local === 0xffffffff || offset + 46 + nameLength + extra + comment > end || local + 30 > start) throw invalid();
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (!/^[A-Za-z0-9][A-Za-z0-9./_-]*$/.test(name) || name.split('/').some(segment => !segment || segment === '.' || segment === '..') || !options.allowName(name) || entries.has(name)) throw invalid();
    if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method || view.getUint32(local + 18, true) !== compressed || view.getUint32(local + 22, true) !== uncompressed) throw invalid();
    const localNameLength = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true);
    const localEnd = local + 30 + localNameLength + localExtra + compressed;
    if (localEnd > start || decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name) throw invalid();
    ranges.push([local, localEnd]);
    entries.set(name, uncompressed);
    total += uncompressed;
    if (total > options.maxExpanded) throw oversized();
    offset += 46 + nameLength + extra + comment;
  }
  if (offset !== end || ranges.sort((a, b) => a[0] - b[0]).some((range, index) => index > 0 && range[0] < ranges[index - 1][1])) throw invalid();

  const files: Record<string, Uint8Array> = Object.create(null);
  let expanded = 0;
  const unzip = new Unzip(file => {
    if (!entries.has(file.name) || Object.hasOwn(files, file.name)) throw invalid();
    const chunks: Uint8Array[] = [];
    let length = 0;
    file.ondata = (error, data, final) => {
      if (error) throw error;
      length += data.length;
      expanded += data.length;
      if (length > entries.get(file.name)! || expanded > options.maxExpanded) throw oversized();
      chunks.push(new Uint8Array(data));
      if (final) {
        if (length !== entries.get(file.name)) throw invalid();
        const output = new Uint8Array(length);
        let position = 0;
        for (const chunk of chunks) { output.set(chunk, position); position += chunk.length; }
        files[file.name] = output;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let position = 0; position < bytes.length; position += 64 * 1024) unzip.push(bytes.subarray(position, position + 64 * 1024), position + 64 * 1024 >= bytes.length);
  if (Object.keys(files).length !== count) throw invalid();
  return files;
}
