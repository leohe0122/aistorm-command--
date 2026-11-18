import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { applyBrandTokens, DEFAULT_BRANDING, parseLogoDataUrl, resolveBranding } from "../shared/branding";
import { DEFAULT_PRODUCT_CATALOG, productLinePrompt, resolveProductCatalog, validateProductCatalog } from "../shared/productCatalog";

describe("品牌配置", () => {
  it("未配置时用默认值，保存的有效字段覆盖默认值，无效字段回退", () => {
    expect(resolveBranding(null)).toEqual(DEFAULT_BRANDING);
    const brand = resolveBranding({ companyName: "Example Co", productName: "", programName: "x".repeat(50), adminContact: 3 });
    expect(brand).toEqual({ ...DEFAULT_BRANDING, companyName: "Example Co" });
  });

  it("提示词中的占位符按品牌替换", () => {
    const brand = { ...DEFAULT_BRANDING, companyName: "Example Co", vendorName: "Example Security" };
    expect(applyBrandTokens("你是 {{brand.companyName}} 的架构师，推荐{{brand.vendorName}}全线产品", brand)).toBe("你是 Example Co 的架构师，推荐Example Security全线产品");
    expect(applyBrandTokens("没有占位符", brand)).toBe("没有占位符");
  });

  it("Logo 只接受 PNG/JPEG/WebP 且不超过上限，拒绝 SVG", () => {
    const png = `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`;
    expect(parseLogoDataUrl(png)?.mimeType).toBe("image/png");
    expect(parseLogoDataUrl(`data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`)).toBeNull();
    expect(parseLogoDataUrl(`data:image/png;base64,${Buffer.alloc(300 * 1024).toString("base64")}`)).toBeNull();
  });
});

describe("产品线目录", () => {
  it("默认目录有效，且与原武器库文件夹一致（14 条，3 个分组）", () => {
    expect(validateProductCatalog(DEFAULT_PRODUCT_CATALOG).problems).toEqual([]);
    expect(DEFAULT_PRODUCT_CATALOG.lines).toHaveLength(14);
    expect(DEFAULT_PRODUCT_CATALOG.groups.map(group => group.name)).toHaveLength(3);
    expect(productLinePrompt(DEFAULT_PRODUCT_CATALOG).split("\n")).toHaveLength(14);
  });

  it("拒绝重复归档键、不存在的分组和空目录；无效目录回退默认值", () => {
    const { problems } = validateProductCatalog({
      groups: [{ name: "A", subtitle: "" }],
      lines: [{ value: "x", label: "X", group: "A" }, { value: "x", label: "X2", group: "A" }, { value: "y", label: "Y", group: "B" }],
    });
    expect(problems).toEqual(["产品线归档键重复：x", "产品线「Y」的分组「B」不存在"]);
    expect(validateProductCatalog({}).problems).toContain("至少需要一条产品线");
    expect(resolveProductCatalog({ groups: [], lines: [] })).toBe(DEFAULT_PRODUCT_CATALOG);
  });
});

describe("代码中不写死品牌", () => {
  // 默认值只允许出现在这些文件里；其余代码一律从品牌配置读取。
  const ALLOWED = new Set([
    "shared/branding.ts",
    "shared/productCatalog.ts",
    "client/src/components/DefaultBrandMark.tsx",
  ]);
  const BRAND = /AIStorm|亚信|T100|\bLeo\b|TrustOne|CloudGuard|ThreatTrace|ThreatShield/;

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === "node_modules" ? [] : walk(full);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
    });
  }

  it("server、client、shared 中除默认值文件外不出现公司名、专项名、联系人或产品名", () => {
    const root = process.cwd();
    const offenders = ["server", "client/src", "shared"].flatMap(dir => walk(join(root, dir)))
      .map(file => relative(root, file))
      .filter(file => !ALLOWED.has(file))
      .flatMap(file => readFileSync(join(root, file), "utf8").split("\n")
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(item => BRAND.test(item.text)))
      .map(item => `${item.file}:${item.line}`);
    expect(offenders).toEqual([]);
  });

  it("页面标题与 PWA 静态名称不写死品牌", () => {
    const root = process.cwd();
    expect(readFileSync(join(root, "client/index.html"), "utf8")).not.toMatch(BRAND);
    expect(JSON.parse(readFileSync(join(root, "client/public/manifest.json"), "utf8")).name).not.toMatch(BRAND);
  });
});
