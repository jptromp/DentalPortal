"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  acceptAttribute,
  checkFile,
  describeAccepted,
  fileLabels,
  formatBytes,
  guessLabel,
  PART_SIZE,
  type UploadLimits,
} from "@/lib/files/rules";
import {
  removeFile,
  runUpload,
  updateLabel,
  UploadError,
  type UploadSession,
  type UploadStart,
} from "@/lib/files/upload-client";
import { buttonClass, cn } from "./ui";

export type UploadedFile = {
  id: string;
  name: string;
  size: number;
  label: string | null;
  status: "uploaded" | "pending" | "failed";
  removable: boolean;
};

type Status = "queued" | "uploading" | "verifying" | "done" | "error" | "rejected" | "interrupted";

type Entry = {
  key: string;
  name: string;
  size: number;
  label: string;
  status: Status;
  progress: number;
  error?: string;
  fileId?: string;
  removable: boolean;
  file?: File;
  session: UploadSession;
  extra: Pick<UploadStart, "category" | "internal">;
  controller?: AbortController;
  removed?: boolean;
};

export type UploaderSummary = { uploaded: number; busy: boolean; problems: number };

const PARALLEL_FILES = 2;

function fromExisting(file: UploadedFile): Entry {
  return {
    key: file.id,
    name: file.name,
    size: file.size,
    label: file.label ?? "Other",
    status: file.status === "uploaded" ? "done" : file.status === "pending" ? "interrupted" : "error",
    progress: file.status === "uploaded" ? 1 : 0,
    error:
      file.status === "pending"
        ? "Upload was interrupted. Add the same file again to continue, or remove it."
        : file.status === "failed"
          ? "Upload failed. Remove it and try again."
          : undefined,
    fileId: file.id,
    removable: file.removable || file.status !== "uploaded",
    session: { doneParts: new Set() },
    extra: {},
  };
}

// Collects files from a drop, walking into dropped folders where supported.
async function filesFromDrop(event: DragEvent) {
  const entries = Array.from(event.dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (!entries.length) return Array.from(event.dataTransfer.files);

  const files: File[] = [];
  async function walk(entry: FileSystemEntry) {
    if (entry.isFile) {
      files.push(
        await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject),
        ),
      );
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        for (const child of batch) await walk(child);
      } while (batch.length);
    }
  }
  for (const entry of entries) await walk(entry);
  return files;
}

export function FileUploader({
  caseId,
  limits,
  initialFiles = [],
  removableAfterUpload,
  hideFinished,
  design,
  onChange,
  onFileUploaded,
}: {
  caseId: string;
  limits: UploadLimits;
  initialFiles?: UploadedFile[];
  // Whether a finished upload can still be removed (true while drafting).
  removableAfterUpload: boolean;
  // Drop finished files from this list, e.g. when the page lists them itself.
  hideFinished?: boolean;
  // Design team uploads: choose the file category and whether it is internal.
  design?: { categories: { value: string; label: string }[] };
  onChange?: (summary: UploaderSummary) => void;
  onFileUploaded?: () => void;
}) {
  // Upload state lives in a ref so async callbacks always see the latest;
  // commit() copies it into React state for rendering.
  const [entries, setEntries] = useState<Entry[]>(() => initialFiles.map(fromExisting));
  const store = useRef<Entry[]>(entries);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [category, setCategory] = useState(design?.categories[0]?.value ?? "");
  const [internal, setInternal] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const busy = entries.some((e) => ["queued", "uploading", "verifying"].includes(e.status));

  // Not a React-known attribute; set after mount to keep hydration clean.
  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, []);

  // Leaving the page would cancel uploads in progress.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  function commit() {
    if (hideFinished) {
      store.current = store.current.filter((e) => e.status !== "done");
    }
    setEntries(store.current.map((e) => ({ ...e })));
    onChange?.({
      uploaded: store.current.filter((e) => e.status === "done").length,
      busy: store.current.some((e) => ["queued", "uploading", "verifying"].includes(e.status)),
      problems: store.current.filter((e) => ["error", "rejected", "interrupted"].includes(e.status))
        .length,
    });
  }

  function pump() {
    const active = store.current.filter(
      (e) => e.status === "uploading" || e.status === "verifying",
    ).length;
    store.current
      .filter((e) => e.status === "queued")
      .slice(0, Math.max(0, PARALLEL_FILES - active))
      .forEach((entry) => void upload(entry));
  }

  async function upload(entry: Entry) {
    entry.status = "uploading";
    entry.error = undefined;
    entry.controller = new AbortController();
    commit();
    try {
      await runUpload(
        entry.file!,
        {
          caseId,
          filename: entry.name,
          size: entry.size,
          type: entry.file!.type,
          label: entry.label,
          ...entry.extra,
        },
        entry.session,
        {
          onStarted: (fileId) => {
            entry.fileId = fileId;
          },
          onProgress: (fraction) => {
            entry.progress = fraction;
            commit();
          },
          onVerifying: () => {
            entry.status = "verifying";
            commit();
          },
        },
        entry.controller.signal,
      );
      entry.status = "done";
      entry.progress = 1;
      entry.removable = removableAfterUpload;
      onFileUploaded?.();
    } catch (error) {
      if (entry.removed) return;
      entry.status = "error";
      entry.error =
        error instanceof UploadError ? error.message : "Upload stopped. Retry to continue.";
      // The server rejected or dropped this upload; a retry starts a fresh one.
      if (error instanceof UploadError && [404, 409, 422].includes(error.status)) {
        entry.fileId = undefined;
        entry.session = { doneParts: new Set() };
        if (error.status === 422) entry.status = "rejected";
      }
    } finally {
      commit();
      pump();
    }
  }

  function addFiles(files: File[]) {
    const skipped: string[] = [];
    for (const file of files) {
      if (file.name.startsWith(".")) continue; // Hidden system files in folders.
      const problem = checkFile(file, limits);
      if (problem && files.length > 1 && problem.startsWith("This file type")) {
        skipped.push(file.name);
        continue;
      }
      // Re-adding a file whose upload was interrupted continues that upload.
      const interrupted = store.current.find(
        (e) => e.status === "interrupted" && e.name === file.name && e.size === file.size,
      );
      if (interrupted && !problem) {
        Object.assign(interrupted, {
          file,
          status: "queued",
          error: undefined,
          session: {
            fileId: interrupted.fileId,
            partSize: PART_SIZE,
            partCount: Math.max(1, Math.ceil(file.size / PART_SIZE)),
            doneParts: new Set(),
          },
        });
        continue;
      }
      store.current.push({
        key: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        label: design ? "" : guessLabel(file.name),
        status: problem ? "rejected" : "queued",
        progress: 0,
        error: problem ?? undefined,
        removable: true,
        file,
        session: { doneParts: new Set() },
        extra: design ? { category, internal } : {},
      });
    }
    setNotice(
      skipped.length
        ? `Skipped ${skipped.length} file${skipped.length > 1 ? "s" : ""} that ${skipped.length > 1 ? "are" : "is"} not an accepted type: ${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? "…" : ""}`
        : undefined,
    );
    commit();
    pump();
  }

  async function remove(entry: Entry) {
    entry.removed = true;
    entry.controller?.abort();
    if (entry.fileId) {
      try {
        await removeFile(entry.fileId);
      } catch (error) {
        entry.removed = false;
        entry.error = error instanceof UploadError ? error.message : "Could not remove the file.";
        commit();
        return;
      }
    }
    store.current = store.current.filter((e) => e !== entry);
    commit();
    pump();
  }

  function retry(entry: Entry) {
    entry.status = "queued";
    entry.error = undefined;
    commit();
    pump();
  }

  async function relabel(entry: Entry, label: string) {
    entry.label = label;
    commit();
    if (!entry.fileId) return;
    try {
      await updateLabel(entry.fileId, label);
    } catch (error) {
      entry.error = error instanceof UploadError ? error.message : "Could not save the label.";
      commit();
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void filesFromDrop(event).then(addFiles);
  }

  return (
    <div className="space-y-4">
      {design && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">File type</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="block w-full rounded-lg bg-white px-3 py-2 text-[15px] text-slate-900 ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {design.categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
              className="size-4 accent-teal-700"
            />
            Internal only (never shown to the client)
          </label>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-slate-50/60",
        )}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="mx-auto size-8 text-slate-400" fill="none">
          <path
            d="M12 16V4m0 0-4 4m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="mt-2 text-[15px] font-medium text-slate-900">
          Drag scans, photos or a whole export folder here
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {describeAccepted(limits)} · up to {formatBytes(limits.maxFileBytes)} per file
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => filesInput.current?.click()}>
            Choose files
          </button>
          <button type="button" className={buttonClass("ghost", "sm")} onClick={() => folderInput.current?.click()}>
            Choose folder
          </button>
        </div>
        <input
          ref={filesInput}
          type="file"
          multiple
          accept={acceptAttribute(limits)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {notice && <p className="text-sm text-slate-600">{notice}</p>}

      {entries.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {entries.map((entry) => (
            <FileRow
              key={entry.key}
              entry={entry}
              showLabel={!design}
              onRemove={() => void remove(entry)}
              onRetry={() => retry(entry)}
              onLabel={(label) => void relabel(entry, label)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FileRow({
  entry,
  showLabel,
  onRemove,
  onRetry,
  onLabel,
}: {
  entry: Entry;
  showLabel: boolean;
  onRemove: () => void;
  onRetry: () => void;
  onLabel: (label: string) => void;
}) {
  const percent = Math.round(entry.progress * 100);
  const failed = entry.status === "error" || entry.status === "rejected" || entry.status === "interrupted";
  const statusText = {
    queued: "Waiting…",
    uploading: `Uploading · ${percent}%`,
    verifying: "Checking file…",
    done: "Uploaded",
    error: "Upload failed",
    rejected: "Not accepted",
    interrupted: "Interrupted",
  }[entry.status];

  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900" title={entry.name}>
            {entry.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatBytes(entry.size)} ·{" "}
            <span
              className={cn(
                entry.status === "done" && "text-emerald-700",
                failed && "text-rose-700",
              )}
            >
              {statusText}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showLabel && entry.status !== "rejected" && (
            <select
              aria-label={`Label for ${entry.name}`}
              value={entry.label}
              onChange={(e) => onLabel(e.target.value)}
              className="rounded-lg bg-white py-1.5 pl-2.5 pr-8 text-sm text-slate-800 ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {fileLabels.map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          )}
          {entry.status === "error" && entry.file && (
            <button type="button" onClick={onRetry} className={buttonClass("secondary", "sm")}>
              Retry
            </button>
          )}
          {(entry.status !== "done" || entry.removable) && (
            <button
              type="button"
              onClick={onRemove}
              className={buttonClass("ghost", "sm")}
              aria-label={`${entry.status === "uploading" ? "Cancel" : "Remove"} ${entry.name}`}
            >
              {entry.status === "uploading" || entry.status === "queued" ? "Cancel" : "Remove"}
            </button>
          )}
        </div>
      </div>
      {(entry.status === "uploading" || entry.status === "verifying" || entry.status === "queued") && (
        <div
          role="progressbar"
          aria-label={`Upload progress for ${entry.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className={cn(
              "h-full rounded-full bg-teal-600 transition-[width] duration-300",
              entry.status === "verifying" && "animate-pulse",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {entry.error && <p className="mt-2 text-sm text-rose-700">{entry.error}</p>}
    </li>
  );
}
