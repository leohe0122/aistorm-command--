import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir = "";
let storage: typeof import("./storage");

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "command-storage-"));
  vi.stubEnv("STORAGE_DRIVER", "local");
  vi.stubEnv("STORAGE_LOCAL_DIR", dir);
  vi.stubEnv("JWT_SECRET", "test-signing-secret");
  vi.resetModules();
  storage = await import("./storage");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("文件存储（local 驱动）", () => {
  it("写入后可按键读取，返回本服务 /files 地址", async () => {
    const { key, url } = await storage.storagePut("product-docs/a.md", "# 内容", "text/markdown");
    expect(key).toMatch(/^product-docs\/a_[0-9a-f]{8}\.md$/);
    expect(url).toBe(`/files/${key}`);
    expect((await storage.storageGetBuffer(key)).toString("utf8")).toBe("# 内容");
    const opened = await storage.storageOpenStream(key);
    expect(opened?.contentLength).toBe(Buffer.byteLength("# 内容"));
    opened?.stream.destroy();
    expect(await storage.storageOpenStream("product-docs/missing.md")).toBeNull();
  });

  it("拒绝路径穿越与非 ASCII 键", async () => {
    await expect(storage.storagePut("../escape.txt", "x")).rejects.toThrow("非法");
    await expect(storage.storageGetBuffer("a/../../etc/passwd")).rejects.toThrow("非法");
    expect(() => storage.normalizeKey("文档.md")).toThrow("非法");
  });

  it("限时签名链接：正确签名可用，篡改或过期不可用", async () => {
    const url = await storage.storageGetSignedUrl("product-docs/a.md", { baseUrl: "https://command.example.com", ttlSeconds: 60 });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://command.example.com/files/product-docs/a.md");
    const expires = parsed.searchParams.get("expires")!;
    const sig = parsed.searchParams.get("sig")!;
    expect(storage.verifyFileSignature("product-docs/a.md", expires, sig)).toBe(true);
    expect(storage.verifyFileSignature("product-docs/b.md", expires, sig)).toBe(false);
    expect(storage.verifyFileSignature("product-docs/a.md", String(Number(expires) + 1), sig)).toBe(false);
    expect(storage.verifyFileSignature("product-docs/a.md", expires, sig, (Number(expires) + 1) * 1000)).toBe(false);
  });

  it("未配置驱动时明确报错", async () => {
    vi.stubEnv("STORAGE_DRIVER", "");
    expect(() => storage.storageDriver()).toThrow("STORAGE_DRIVER");
    vi.stubEnv("STORAGE_DRIVER", "manus");
    expect(() => storage.storageDriver()).toThrow("只能是 local 或 s3");
    vi.stubEnv("STORAGE_DRIVER", "local");
  });
});
