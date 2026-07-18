import { vi } from 'vitest';

type InvokeHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

const handlers = new Map<string, InvokeHandler>();
const invokeMock = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
  const handler = handlers.get(cmd);
  if (handler) {
    return handler(args ?? {});
  }
  return undefined;
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...(args as [string, Record<string, unknown>?])),
}));

export function resetTauriMock() {
  handlers.clear();
  invokeMock.mockClear();
}

export function onInvoke(cmd: string, handler: InvokeHandler) {
  handlers.set(cmd, handler);
}

export function getInvokeMock() {
  return invokeMock;
}

export function lastInvoke(cmd: string) {
  const calls = invokeMock.mock.calls.filter((c) => c[0] === cmd);
  return calls.at(-1) as [string, Record<string, unknown>?] | undefined;
}

export function allInvokes(cmd: string) {
  return invokeMock.mock.calls.filter((c) => c[0] === cmd) as Array<
    [string, Record<string, unknown>?]
  >;
}
