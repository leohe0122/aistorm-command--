import { storagePut } from "../server/storage.ts";

try {
  const result = await storagePut(
    `diagnostics/arsenal-note-storage-${Date.now()}.md`,
    "# Storage diagnostic\n",
    "text/markdown; charset=utf-8",
  );
  console.log(JSON.stringify({ ok: true, result }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}
