import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  BUNDLE_FORMAT,
  databaseFingerprint,
  loadBundle,
  loadState,
  migratedKey,
  rowForInsert,
  saveState,
  sha256,
  skippedRecords,
  verifyBundleFiles,
  type Bundle,
} from "./productMaterials";

const dirs: string[] = [];
afterAll(async () => { for (const dir of dirs) await rm(dir, { recursive: true, force: true }); });

async function makeBundle(overrides: Partial<Bundle> = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "materials-"));
  dirs.push(dir);
  const content = Buffer.from("白皮书内容");
  await mkdir(path.join(dir, "files", "product_docs"), { recursive: true });
  await writeFile(path.join(dir, "files", "product_docs", "21.pdf"), content);
  const bundle: Bundle = {
    format: BUNDLE_FORMAT,
    exportedAt: "2026-11-18T00:00:00.000Z",
    counts: { products: 0, product_doc_folders: 0, product_docs: 2, arsenal_weapons: 0, arsenal_attachments: 0, arsenal_pricing: 0, listprice_items: 0, case_studies: 0, kill_sheets: 0 },
    tables: {
      products: [], product_doc_folders: [], arsenal_weapons: [], arsenal_attachments: [], arsenal_pricing: [], listprice_items: [], case_studies: [], kill_sheets: [],
      product_docs: [{ id: 21, filename: "白皮书.pdf" }, { id: 23, filename: "lost.docx" }],
    },
    files: [{ table: "product_docs", id: 21, fileKey: "product-docs/a.pdf", path: "files/product_docs/21.pdf", size: content.length, sha256: sha256(content) }],
    failures: [{ table: "product_docs", id: 23, fileKey: "product-docs/lost.docx", error: "404" }],
    ...overrides,
  };
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(bundle));
  return { dir, bundle };
}

describe("产品资料迁移：资料包校验", () => {
  it("文件完整时通过，篡改后在写入前被拦下", async () => {
    const { dir } = await makeBundle();
    const bundle = loadBundle(dir);
    expect(verifyBundleFiles(dir, bundle)).toEqual([]);
    await writeFile(path.join(dir, "files", "product_docs", "21.pdf"), "被改过的内容…");
    expect(verifyBundleFiles(dir, bundle)[0]).toMatch(/product_docs#21/);
  });

  it("拒绝格式不符或记录数不一致的资料包，以及越出目录的文件路径", async () => {
    const wrongFormat = await makeBundle({ format: "other/v0" });
    expect(() => loadBundle(wrongFormat.dir)).toThrow("格式不符");
    const { dir, bundle } = await makeBundle();
    bundle.counts.product_docs = 5;
    await writeFile(path.join(dir, "manifest.json"), JSON.stringify(bundle));
    expect(() => loadBundle(dir)).toThrow("记录数");
    const escape = await makeBundle();
    escape.bundle.files[0].path = "../../etc/passwd";
    expect(verifyBundleFiles(escape.dir, escape.bundle)[0]).toMatch(/非法路径/);
  });

  it("导出时文件下载失败的记录会被跳过", async () => {
    const { bundle } = await makeBundle();
    expect([...skippedRecords(bundle)]).toEqual(["product_docs#23"]);
  });
});

describe("产品资料迁移：写入规则", () => {
  it("存储键固定且为 ASCII，重跑时覆盖同一对象", () => {
    expect(migratedKey("product_docs", 21, "示例白皮书 v2.PDF")).toBe("migrated/product-docs/21/file.pdf");
    expect(migratedKey("arsenal_attachments", 41, "无扩展名")).toBe("migrated/arsenal-attachments/41/file");
  });

  it("去掉原编号、还原时间，其余字段原样保留", () => {
    const values = rowForInsert({ id: 9, title: "标题", tags: ["a"], createdAt: "2026-05-01T10:00:00.000Z", isDemo: false });
    expect(values).toEqual({ title: "标题", tags: ["a"], createdAt: new Date("2026-05-01T10:00:00.000Z"), isDemo: false });
  });

  it("解除与旧环境客户的关联（客户不迁移）", () => {
    expect(rowForInsert({ id: 1, competitorName: "竞品X", clientId: 5, sourceClientId: 6 })).toEqual({ competitorName: "竞品X", clientId: null, sourceClientId: null });
  });

  it("导入状态绑定目标库，且不包含密码", async () => {
    const { dir } = await makeBundle();
    const target = databaseFingerprint("mysql://user:secret@db.internal:3306/command");
    expect(target).toBe("db.internal:3306/command");
    const state = loadState(dir, target);
    state.maps.product_docs["21"] = 1;
    saveState(dir, state);
    expect(loadState(dir, target).maps.product_docs).toEqual({ "21": 1 });
    expect(() => loadState(dir, "other:3306/db")).toThrow("另一个数据库");
  });
});
