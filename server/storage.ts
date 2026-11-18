// 文件存储抽象：由 STORAGE_DRIVER 选择驱动，与托管平台无关。
//   STORAGE_DRIVER=local  本地磁盘（STORAGE_LOCAL_DIR，默认 ./data/uploads），适合单机部署
//   STORAGE_DRIVER=s3     S3 兼容对象存储（AWS S3、Cloudflare R2、MinIO、阿里云 OSS 等）
//
// 所有文件都通过本服务的 /files/<key> 访问（见 server/_core/files.ts）：默认要求登录；
// 需要交给外部预览服务时，用 storageGetSignedUrl 生成限时签名链接。存储桶无需公开。

import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { ENV } from "./_core/env";

export type StorageDriver = "local" | "s3";
export const FILES_ROUTE_PREFIX = "/files/";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function storageDriver(): StorageDriver {
  const value = (process.env.STORAGE_DRIVER ?? "").trim().toLowerCase();
  if (value === "local" || value === "s3") return value;
  throw new Error(value
    ? `STORAGE_DRIVER=${value} 无效：只能是 local 或 s3`
    : "未配置文件存储：请设置 STORAGE_DRIVER=local（本地磁盘）或 STORAGE_DRIVER=s3（S3 兼容对象存储）");
}

/** 规范化对象键并拒绝路径穿越；只允许 ASCII 可见字符。 */
export function normalizeKey(relKey: string): string {
  const key = relKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!key || key.split("/").some(part => part === ".." || part === ".") || /[^\x21-\x7E]/.test(key)) {
    throw new Error("非法的文件路径");
  }
  return key;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1 || lastDot < relKey.lastIndexOf("/")) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/**
 * 生成纯 ASCII 的文档键。中文标题仅保存在数据库 title/filename，绝不进入对象路径。
 */
export function createAsciiDocumentStorageKey(
  directory = "product-docs/notes",
  extension = "md",
): string {
  const safeDirectory = directory.replace(/[^A-Za-z0-9/_-]/g, "").replace(/\/+$/, "") || "documents";
  const safeExtension = extension.replace(/[^A-Za-z0-9]/g, "") || "txt";
  const id = crypto.randomUUID().replace(/-/g, "");
  return `${safeDirectory}/note-${Date.now()}-${id}.${safeExtension}`;
}

export function fileUrlForKey(key: string): string {
  return `${FILES_ROUTE_PREFIX}${normalizeKey(key).split("/").map(encodeURIComponent).join("/")}`;
}

// ── 本地磁盘 ────────────────────────────────────────────────────────────────
function localRoot(): string {
  return path.resolve(process.env.STORAGE_LOCAL_DIR?.trim() || "data/uploads");
}

function localPath(key: string): string {
  const root = localRoot();
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("非法的文件路径");
  return full;
}

// ── S3 兼容 ─────────────────────────────────────────────────────────────────
let s3Client: import("@aws-sdk/client-s3").S3Client | null = null;

async function s3(): Promise<{ client: import("@aws-sdk/client-s3").S3Client; bucket: string; prefix: string; sdk: typeof import("@aws-sdk/client-s3") }> {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) throw new Error("STORAGE_DRIVER=s3 时必须设置 S3_BUCKET");
  const sdk = await import("@aws-sdk/client-s3");
  if (!s3Client) {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
    s3Client = new sdk.S3Client({
      region: process.env.S3_REGION?.trim() || "auto",
      endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      // 未提供密钥时使用 AWS SDK 默认凭证链（实例角色、环境变量等）
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }
  const prefix = (process.env.S3_PREFIX?.trim() || "").replace(/^\/+|\/+$/g, "");
  return { client: s3Client, bucket, prefix: prefix ? `${prefix}/` : "", sdk };
}

// ── 对外接口 ────────────────────────────────────────────────────────────────
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const driver = storageDriver();
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);

  if (driver === "local") {
    const target = localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  } else {
    const { client, bucket, prefix, sdk } = await s3();
    await client.send(new sdk.PutObjectCommand({ Bucket: bucket, Key: prefix + key, Body: body, ContentType: contentType }));
  }
  return { key, url: fileUrlForKey(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: fileUrlForKey(key) };
}

/** 读取文件内容（服务端内部使用，例如补跑文字提取）。 */
export async function storageGetBuffer(relKey: string): Promise<Buffer> {
  const key = normalizeKey(relKey);
  if (storageDriver() === "local") return readFile(localPath(key));
  const { client, bucket, prefix, sdk } = await s3();
  const result = await client.send(new sdk.GetObjectCommand({ Bucket: bucket, Key: prefix + key }));
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) throw new Error("文件为空");
  return Buffer.from(bytes);
}

/** 以流的方式读取文件，供 /files 路由回传；文件不存在时返回 null。 */
export async function storageOpenStream(relKey: string): Promise<{ stream: Readable; contentType?: string; contentLength?: number } | null> {
  const key = normalizeKey(relKey);
  if (storageDriver() === "local") {
    const full = localPath(key);
    const info = await stat(full).catch(() => null);
    if (!info?.isFile()) return null;
    return { stream: createReadStream(full), contentLength: info.size };
  }
  const { client, bucket, prefix, sdk } = await s3();
  try {
    const result = await client.send(new sdk.GetObjectCommand({ Bucket: bucket, Key: prefix + key }));
    if (!result.Body) return null;
    return { stream: result.Body as Readable, contentType: result.ContentType, contentLength: result.ContentLength };
  } catch (error: any) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

// ── 限时签名链接 ────────────────────────────────────────────────────────────
function signingSecret(): string {
  if (!ENV.cookieSecret) throw new Error("生成文件签名链接需要设置 JWT_SECRET");
  return ENV.cookieSecret;
}

function signature(key: string, expires: number): string {
  return crypto.createHmac("sha256", signingSecret()).update(`files:${key}:${expires}`).digest("base64url");
}

/** 校验 /files/<key>?expires=&sig= 形式的限时链接。 */
export function verifyFileSignature(relKey: string, expires: unknown, sig: unknown, now = Date.now()): boolean {
  if (typeof expires !== "string" || typeof sig !== "string" || !ENV.cookieSecret) return false;
  const exp = Number(expires);
  if (!Number.isInteger(exp) || exp * 1000 < now) return false;
  const expected = Buffer.from(signature(normalizeKey(relKey), exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/**
 * 生成无需登录即可访问的限时链接（默认 1 小时），用于交给外部预览服务等场景。
 * 传入 baseUrl 时返回绝对地址。
 */
export async function storageGetSignedUrl(relKey: string, options: { baseUrl?: string; ttlSeconds?: number } = {}): Promise<string> {
  const key = normalizeKey(relKey);
  const expires = Math.floor(Date.now() / 1000) + (options.ttlSeconds ?? SIGNED_URL_TTL_SECONDS);
  const query = `expires=${expires}&sig=${signature(key, expires)}`;
  return `${options.baseUrl ?? ""}${fileUrlForKey(key)}?${query}`;
}
