// Browser side of the upload flow: start → upload parts straight to storage →
// complete. Parts already uploaded are remembered, so a retry after a dropped
// connection continues where it stopped instead of starting over.

export class UploadError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type UploadStart = {
  caseId: string;
  filename: string;
  size: number;
  type: string;
  label?: string;
  category?: string;
  internal?: boolean;
  replacesFileId?: string;
};

// Mutable per-file progress, kept by the caller between attempts.
export type UploadSession = {
  fileId?: string;
  partSize?: number;
  partCount?: number;
  doneParts: Set<number>;
};

const PARALLEL_PARTS = 3;
const PART_ATTEMPTS = 4;
// Presigned URLs last 15 minutes; small batches are used well within that.
const SIGN_BATCH = 6;

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new UploadError("Connection lost. Check your internet connection and retry.", 0);
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new UploadError(data.error ?? `Upload failed (error ${response.status}).`, response.status);
  }
  return data;
}

function putPart(url: string, body: Blob, onProgress: (loaded: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new UploadError(`Storage rejected part (HTTP ${xhr.status}).`, xhr.status));
    xhr.onerror = () => reject(new UploadError("Connection lost while uploading.", 0));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runUpload(
  file: File,
  start: UploadStart,
  session: UploadSession,
  callbacks: {
    onStarted?: (fileId: string) => void;
    onProgress: (fraction: number) => void;
    onVerifying?: () => void;
  },
  signal: AbortSignal,
) {
  if (!session.fileId) {
    const started = await api<{ fileId: string; partSize: number; partCount: number }>(
      "/api/uploads",
      "POST",
      start,
    );
    Object.assign(session, started, { doneParts: new Set<number>() });
    callbacks.onStarted?.(started.fileId);
  }
  const { fileId, partSize, partCount } = session as Required<UploadSession>;

  const inFlight = new Map<number, number>();
  const partBytes = (n: number) => Math.min(partSize, file.size - (n - 1) * partSize);
  const report = () => {
    let loaded = 0;
    for (const n of session.doneParts) loaded += partBytes(n);
    for (const bytes of inFlight.values()) loaded += bytes;
    callbacks.onProgress(Math.min(loaded / file.size, 1));
  };
  report();

  const queue = Array.from({ length: partCount }, (_, i) => i + 1).filter(
    (n) => !session.doneParts.has(n),
  );

  // Presigned part URLs, fetched a few at a time. Each is used once, so a
  // retried part always gets a fresh one.
  const urls = new Map<number, string>();
  async function urlFor(n: number) {
    if (!urls.has(n)) {
      const batch = [n, ...queue.filter((p) => !urls.has(p)).slice(0, SIGN_BATCH - 1)];
      const signed = await api<{ urls: Record<number, string> }>(
        `/api/uploads/${fileId}/parts`,
        "POST",
        { partNumbers: batch },
      );
      for (const [part, url] of Object.entries(signed.urls)) urls.set(Number(part), url);
    }
    const url = urls.get(n)!;
    urls.delete(n);
    return url;
  }

  // One failed part stops the others; the retry resumes from what finished.
  const stop = new AbortController();
  const forwardAbort = () => stop.abort();
  signal.addEventListener("abort", forwardAbort, { once: true });

  async function worker() {
    for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
      const blob = file.slice((n - 1) * partSize, (n - 1) * partSize + partBytes(n));
      for (let attempt = 1; ; attempt++) {
        stop.signal.throwIfAborted();
        try {
          await putPart(await urlFor(n), blob, (loaded) => {
            inFlight.set(n, loaded);
            report();
          }, stop.signal);
          inFlight.delete(n);
          session.doneParts.add(n);
          report();
          break;
        } catch (error) {
          inFlight.delete(n);
          const retryable = error instanceof UploadError && (error.status === 0 || error.status >= 500);
          if (!retryable || attempt >= PART_ATTEMPTS) throw error;
          await wait(1000 * 2 ** attempt);
        }
      }
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL_PARTS, queue.length) }, () =>
        worker().catch((error) => {
          stop.abort();
          throw error;
        }),
      ),
    );
  } finally {
    signal.removeEventListener("abort", forwardAbort);
  }
  signal.throwIfAborted();
  callbacks.onVerifying?.();
  await api(`/api/uploads/${fileId}/complete`, "POST");
}

export function updateLabel(fileId: string, label: string) {
  return api(`/api/uploads/${fileId}`, "PATCH", { label });
}

export function removeFile(fileId: string) {
  return api(`/api/uploads/${fileId}`, "DELETE");
}
