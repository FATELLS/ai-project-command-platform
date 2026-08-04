import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { ExtractionError, splitBlock } from "./common.mjs";

// MIME 映射
const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf"
};

// 单张图片/PDF 的 base64 大小上限（原始文件，约 15MB）
const MAX_FILE_BYTES = 15 * 1024 * 1024;

/**
 * LLM 多模态视觉提取器
 *
 * 核心思路：
 * - 图片（png/jpg/webp）：直接 base64 data URL → image_url 传给模型
 * - PDF：先上传到智谱文件服务拿到 file_id，再用 file_url 传给模型
 *   （GLM-4V 的 file_url 不支持 base64 data URL，必须先上传）
 *
 * 视觉提取使用独立的多模态模型，不是文本生成模型。
 * 多模态调用的消息格式和返回处理与文本生成差异较大（content 是数组、容许 length 截断、
 * 容许非 JSON 返回），因此这里直接调 fetch 而不走 openai-compatible-provider 的 generate。
 *
 * @param {object} input  - { path, extension, ... }
 * @param {object} limits - 提取限制
 * @param {object} deps   - { config } config 包含 baseUrl/apiKey/model/timeoutMs/maxOutputTokens
 * @returns {Promise<Array<{kind,text,location}>>} evidence blocks
 */
export async function extractWithVision(input, limits, deps = {}) {
  const config = deps.visionConfig;
  if (!config || !config.apiKey || !config.model) {
    throw new ExtractionError("vision_provider_unavailable", "LLM vision provider is not configured");
  }

  const ext = String(input.extension ?? "").toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) throw new ExtractionError("unsupported_vision_type", `Vision extractor does not support ${ext}`);

  const fileBuffer = await readFile(input.path);
  if (fileBuffer.byteLength > MAX_FILE_BYTES) {
    throw new ExtractionError("file_too_large_for_vision", `File exceeds ${MAX_FILE_BYTES} bytes vision limit`);
  }

  // 判断文件类型：图片直接 base64，PDF 需要先上传
  const isPdf = mime === "application/pdf";

  let contentBlock;
  if (isPdf) {
    // PDF：上传到智谱文件服务，拿到 file_id 构造 URL
    const fileId = await uploadFileForVision(fileBuffer, input.path, config);
    contentBlock = { type: "file_url", file_url: { url: fileId } };
  } else {
    // 图片：直接 base64 data URL
    const base64 = fileBuffer.toString("base64");
    contentBlock = { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } };
  }

  // 构造多模态请求体
  const requestBody = {
    model: config.model,
    messages: [
      {
        role: "user",
        content: [contentBlock, { type: "text", text: VISION_EXTRACTION_PROMPT }]
      }
    ],
    temperature: 0.1,
    max_tokens: config.maxOutputTokens ?? 1024,
    stream: false
  };

  // 直接 fetch 调用（不走 provider.generate，因为多模态返回处理逻辑不同）
  const endpoint = config.baseUrl.replace(/\/$/, "") + "/chat/completions";
  const timeoutMs = config.timeoutMs ?? 120_000;

  let rawContent;
  try {
    const deadline = AbortSignal.timeout(timeoutMs);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: deadline
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new ExtractionError(
        "vision_llm_http_error",
        `LLM vision API returned ${response.status}: ${errorBody.slice(0, 500)}`
      );
    }

    const payload = await response.json();
    const choice = payload?.choices?.[0];
    if (!choice?.message?.content) {
      throw new ExtractionError("vision_llm_empty", "LLM vision API returned no content");
    }

    rawContent = choice.message.content;
    // 容许 finish_reason: "length"（截断也是有效内容）
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new ExtractionError("vision_llm_timeout", `LLM vision API timed out after ${timeoutMs}ms`);
    }
    throw new ExtractionError("vision_llm_failed", `LLM vision extraction failed: ${error?.message ?? error}`);
  }

  // 解析 LLM 输出 → blocks
  return parseVisionOutput(rawContent, ext, limits);
}

/**
 * 上传文件到 AI 服务商的文件服务，返回可用于 file_url 的标识符。
 *
 * 从 vision config 的 baseUrl 推导文件上传端点：
 *   /coding/paas/v4 → /paas/v4/files（去掉 coding 路径段）
 *   /paas/v4      → /paas/v4/files
 *   /v1           → /v1/files
 *
 * 注意：部分供应商的 coding 端点不支持文件上传，需用标准端点。
 */
async function uploadFileForVision(fileBuffer, filePath, config) {
  // 文件上传走标准端点（从 vision baseUrl 推导，去掉 coding/ 路径段）
  // 例：https://provider.com/api/coding/paas/v4 → https://provider.com/api/paas/v4/files
  //     https://provider.com/api/paas/v4      → https://provider.com/api/paas/v4/files
  const baseForUpload = config.baseUrl
    .replace(/\/$/, "")
    .replace(/\/coding\//, "/");
  const uploadEndpoint = baseForUpload + "/files";
  const filename = basename(filePath);

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "application/pdf" });
  formData.append("file", blob, filename);
  formData.append("purpose", "file-extract");

  const deadline = AbortSignal.timeout(config.timeoutMs ?? 60_000);
  const response = await fetch(uploadEndpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}` },
    body: formData,
    signal: deadline
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new ExtractionError(
      "vision_upload_failed",
      `File upload failed (${response.status}): ${errorBody.slice(0, 300)}`
    );
  }

  const result = await response.json();
  if (!result.id) {
    throw new ExtractionError("vision_upload_no_id", "File upload returned no file id");
  }

  return result.id;
}

/**
 * 提示词：引导 LLM 做结构化文本提取
 * 不做摘要/分析，只做忠实的文本转录 + 结构化分块。
 */
const VISION_EXTRACTION_PROMPT = `你是一个文档文本提取器。请仔细阅读提供的图片或 PDF，执行以下任务：

1. 识别文档中所有可见的文字内容（包括标题、正文、表格、图表标注、页眉页脚等）
2. 按阅读顺序，将内容按"段落/区域"组织成结构化的文本块
3. 对于表格数据，转为 Markdown 表格格式
4. 对于图表/示意图，描述其内容并提取其中的文字标注

输出格式（JSON）：
{
  "blocks": [
    {
      "text": "这个文本块的完整内容（保留原始语言和格式）",
      "kind": "heading | paragraph | table | chart | list | note",
      "page": 1,
      "section": "该文本块所属的章节标题（如有）"
    }
  ]
}

要求：
- 忠实转录，不要摘要、不要分析、不要添加原文没有的内容
- 中文文档保持中文，英文文档保持英文
- 表格转为 Markdown 表格语法
- 如果文档有多个页面，按页面顺序分块
- 每个文本块不超过 1200 字符，超长的拆分为多个块
- 如果文档是扫描件/图片，做 OCR 转录
- 如果完全是空白/无文字的图片，返回空数组`;

/**
 * 解析 LLM 输出为 evidence blocks
 */
function parseVisionOutput(content, ext, limits) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    // LLM 没返回合法 JSON，退化为整段文本
    const text = String(content ?? "").trim();
    if (!text) throw new ExtractionError("vision_empty_output", "LLM vision extraction returned no text");
    return splitBlock(text, "vision", { type: ext.replace(".", ""), source: "llm-vision" }, limits);
  }

  const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  if (!rawBlocks.length) {
    // 退化为把整个 content 作为单块
    const fallback = String(content ?? "").trim();
    if (!fallback) throw new ExtractionError("vision_empty_output", "LLM vision extraction returned no usable text");
    return splitBlock(fallback, "vision", { type: ext.replace(".", ""), source: "llm-vision" }, limits);
  }

  const blocks = [];
  for (let i = 0; i < rawBlocks.length; i++) {
    const item = rawBlocks[i];
    const text = String(item.text ?? "").trim();
    if (!text) continue;
    const kind = String(item.kind ?? "paragraph").trim();
    const page = Number(item.page) || 1;
    const section = String(item.section ?? "").trim();
    const location = {
      type: ext.replace(".", ""),
      source: "llm-vision",
      kind,
      page,
      ...(section ? { section } : {}),
      block: i + 1
    };
    blocks.push(...splitBlock(text, kind, location, limits));
  }

  if (!blocks.length) throw new ExtractionError("vision_no_text", "Vision extraction produced no text blocks");
  return blocks;
}
