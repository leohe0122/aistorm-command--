import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateTempPassword } from "./_core/password";

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("初始密码与临时密码", () => {
  it("用安全随机数生成，格式便于转达且足够长", () => {
    const samples = new Set(Array.from({ length: 200 }, () => generateTempPassword()));
    expect(samples.size).toBe(200);
    for (const password of samples) expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}(-[A-HJ-NP-Za-km-z2-9]{4}){3}$/);
  });

  it("应用代码不再含硬编码默认密码或 Math.random 拼出的临时密码", () => {
    const routers = projectFile("server/routers.ts");
    expect(routers).not.toContain("Aistorm2024!");
    expect(routers).not.toContain("Math.floor(1000 + Math.random() * 9000)");
    expect(projectFile("client/src/pages/TeamManagement.tsx")).not.toContain("Aistorm2024!");
  });
});
