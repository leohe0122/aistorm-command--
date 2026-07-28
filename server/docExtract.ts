/**
 * 文档文字提取工具
 * 支持 PDF、DOCX、PPTX、XLSX 格式
 * 提取结果限制在 8000 字以内（约 4-6 页内容），避免超出 AI 上下文限制
 */

const MAX_CHARS = 8000;

/** 从 Buffer 中提取文字，根据 mimeType 选择对应解析器 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  try {
    const mime = mimeType.toLowerCase();
    const name = filename.toLowerCase();

    // PDF
    if (mime.includes('pdf') || name.endsWith('.pdf')) {
      return await extractPdf(buffer);
    }
    // DOCX / DOC
    if (mime.includes('wordprocessingml') || mime.includes('msword') || name.endsWith('.docx') || name.endsWith('.doc')) {
      return await extractDocx(buffer);
    }
    // PPTX / PPT
    if (mime.includes('presentationml') || mime.includes('powerpoint') || name.endsWith('.pptx') || name.endsWith('.ppt')) {
      return await extractPptx(buffer);
    }
    // XLSX / XLS
    if (mime.includes('spreadsheetml') || mime.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
      return await extractXlsx(buffer);
    }
    return '';
  } catch (err: any) {
    console.error('[docExtract] Error:', err?.message);
    return '';
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // Use pdfjs-dist in legacy mode (no canvas dependency)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any).catch(() => null);
  if (!pdfjsLib) return '';
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const numPages = Math.min(pdf.numPages, 15); // 最多提取前15页
  const texts: string[] = [];
  let totalChars = 0;
  for (let i = 1; i <= numPages; i++) {
    if (totalChars >= MAX_CHARS) break;
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) {
      texts.push(`[第${i}页] ${pageText}`);
      totalChars += pageText.length;
    }
  }
  return texts.join('\n').slice(0, MAX_CHARS);
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
}

async function extractPptx(buffer: Buffer): Promise<string> {
  // PPTX 是 ZIP 格式，解压后读取每个 slide 的 XML
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '0');
      const nb = parseInt(b.match(/\d+/)?.[0] || '0');
      return na - nb;
    })
    .slice(0, 30); // 最多30张幻灯片

  const texts: string[] = [];
  let totalChars = 0;
  for (const slideFile of slideFiles) {
    if (totalChars >= MAX_CHARS) break;
    const xml = await zip.files[slideFile].async('string');
    // 提取 <a:t> 标签内的文字
    const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
    const slideText = matches
      .map(m => m.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .join(' ');
    if (slideText) {
      const slideNum = slideFile.match(/\d+/)?.[0] || '';
      texts.push(`[幻灯片${slideNum}] ${slideText}`);
      totalChars += slideText.length;
    }
  }
  return texts.join('\n').slice(0, MAX_CHARS);
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const texts: string[] = [];
  let totalChars = 0;
  for (const sheetName of workbook.SheetNames.slice(0, 5)) {
    if (totalChars >= MAX_CHARS) break;
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const cleaned = csv.replace(/,+\n/g, '\n').replace(/\n+/g, '\n').trim();
    if (cleaned) {
      texts.push(`[Sheet: ${sheetName}]\n${cleaned}`);
      totalChars += cleaned.length;
    }
  }
  return texts.join('\n').slice(0, MAX_CHARS);
}
