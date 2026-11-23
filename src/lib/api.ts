import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: Record<string, unknown>,
  ) {
    super(code);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Access sessions expire; a reload goes through the Access login again.
  if (response.status === 401) location.reload();
  if (!response.ok) {
    const { error = "error", ...details } = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(response.status, error, details);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T = void>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T = void>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};

/** GETs `path` (skipped when null) and keeps the result; `reload` fetches again. */
export function useApi<T>(path: string | null): { data: T | undefined; error: ApiError | undefined; reload: () => void } {
  const [state, setState] = useState<{ data?: T; error?: ApiError }>({});
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (path === null) return;
    let live = true;
    api.get<T>(path).then(
      (data) => live && setState({ data }),
      (error: ApiError) => live && setState({ error }),
    );
    return () => {
      live = false;
    };
  }, [path, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: state.data, error: state.error, reload };
}
