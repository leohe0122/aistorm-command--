import { AsyncLocalStorage } from "node:async_hooks";

// 为 AI 调用记录（ai_runs）提供默认功能名：tRPC 接口内发起的调用自动记为接口路径，
// 包括接口里用 setImmediate / Promise 延后执行的后台调用（异步上下文会随之传递）。
const storage = new AsyncLocalStorage<{ feature: string }>();

export function runWithAiFeature<T>(feature: string, fn: () => T): T {
  return storage.run({ feature }, fn);
}

export function currentAiFeature(): string | undefined {
  return storage.getStore()?.feature;
}
