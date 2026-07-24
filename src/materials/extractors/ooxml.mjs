import yauzl from "yauzl";
import { decodeXmlText, ExtractionError, extractionLimits, splitBlock } from "./common.mjs";

function readZip(path, select, maxBytes) {
  return new Promise((resolve, reject) => yauzl.open(path, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
    if (error) return reject(new ExtractionError("invalid_container", "Office container is malformed"));
    const files = new Map(); let total = 0;
    zip.on("error", () => reject(new ExtractionError("invalid_container", "Office container is malformed")));
    zip.on("entry", entry => {
      if (!select(entry.fileName)) return zip.readEntry();
      if (entry.uncompressedSize > maxBytes || total + entry.uncompressedSize > maxBytes) { zip.close(); return reject(new ExtractionError("extracted_text_too_large", "Selected Office XML exceeds its limit")); }
      zip.openReadStream(entry, (streamError, stream) => {
        if (streamError) return reject(new ExtractionError("invalid_container", "Office entry cannot be read"));
        const chunks = []; let size = 0;
        stream.on("data", chunk => { size += chunk.length; if (size <= maxBytes) chunks.push(chunk); });
        stream.on("error", () => reject(new ExtractionError("invalid_container", "Office entry is truncated")));
        stream.on("end", () => { total += size; files.set(entry.fileName, Buffer.concat(chunks).toString("utf8")); zip.readEntry(); });
      });
    });
    zip.on("end", () => resolve(files)); zip.readEntry();
  }));
}

function paragraphs(xml) { return [...xml.matchAll(/<(?:w:p|a:p)(?:\s[^>]*)?>([\s\S]*?)<\/(?:w:p|a:p)>/g)].map(match => decodeXmlText(match[1])).filter(Boolean); }

export async function extractOoxml({ path, extension }, limits = extractionLimits) {
  if (extension === ".docx") {
    const files = await readZip(path, name => name === "word/document.xml", limits.maxTextBytes);
    const xml = files.get("word/document.xml"); if (!xml) throw new ExtractionError("invalid_container", "DOCX document part is missing");
    return paragraphs(xml).flatMap((text, index) => splitBlock(text, "paragraph", { type: "paragraph", paragraph: index + 1 }, limits));
  }
  if (extension === ".pptx") {
    const files = await readZip(path, name => /^ppt\/slides\/slide\d+\.xml$/.test(name), limits.maxTextBytes);
    const entries = [...files].sort((a, b) => Number(a[0].match(/\d+/)?.[0]) - Number(b[0].match(/\d+/)?.[0]));
    return entries.flatMap(([name, xml]) => { const slide = Number(name.match(/slide(\d+)/)?.[1]); return paragraphs(xml).flatMap((text, index) => splitBlock(text, "slide", { type: "slide", slide, paragraph: index + 1 }, limits)); });
  }
  if (extension === ".xlsx") {
    const files = await readZip(path, name => name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name), limits.maxTextBytes);
    const shared = [...(files.get("xl/sharedStrings.xml") ?? "").matchAll(/<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(match => decodeXmlText(match[1]));
    const sheets = [...files].filter(([name]) => /worksheets\/sheet/.test(name)).sort();
    return sheets.flatMap(([name, xml], sheetIndex) => [...xml.matchAll(/<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g)].flatMap(match => {
      const cell = match[1].match(/\br="([^"]+)"/)?.[1]; const raw = match[2].match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? "";
      const value = /\bt="s"/.test(match[1]) ? shared[Number(raw)] : decodeXmlText(raw);
      return splitBlock(value, "sheet", { type: "sheet-cell", sheet: `Sheet${sheetIndex + 1}`, cell }, limits);
    }));
  }
  throw new ExtractionError("unsupported_type", "Unsupported Office material type");
}
