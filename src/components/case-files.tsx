import type { ReactNode } from "react";
import { formatBytes, fileCategoryLabels, type FileCategory } from "@/lib/files/rules";
import { formatDateTime } from "@/lib/format";
import { Badge, buttonClass, cn } from "./ui";

export type FileView = {
  id: string;
  name: string;
  label: string | null;
  category: FileCategory;
  sizeBytes: number;
  version: number;
  uploaderName: string;
  uploadedAt: Date;
  scanLabel: string;
  downloadable: boolean;
  // Staff-only state shown as badges.
  flags?: { label: string; tone: "neutral" | "attention" | "success" | "muted" | "info" }[];
  actions?: ReactNode;
};

const order: FileCategory[] = [
  "client_upload",
  "additional_information",
  "design_preview",
  "revision_file",
  "final_deliverable",
  "report_instruction",
];

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.slice(0, 4).toUpperCase() ?? "";
  return (
    <span
      aria-hidden
      className="grid h-10 w-9 shrink-0 place-items-center rounded-md bg-slate-100 font-mono text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200"
    >
      {ext}
    </span>
  );
}

// Files grouped by purpose, as the spec asks, rather than one long list.
export function CaseFileGroups({ files, empty }: { files: FileView[]; empty: ReactNode }) {
  if (!files.length) return <>{empty}</>;
  return (
    <div className="divide-y divide-slate-100">
      {order
        .filter((category) => files.some((f) => f.category === category))
        .map((category) => (
          <section key={category} className="px-5 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {fileCategoryLabels[category]}
            </h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {files
                .filter((f) => f.category === category)
                .map((file) => (
                  <li key={file.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <FileIcon name={file.name} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-900">
                          <span className="truncate" title={file.name}>
                            {file.name}
                          </span>
                          {file.label && <Badge tone="info">{file.label}</Badge>}
                          {file.version > 1 && <Badge>v{file.version}</Badge>}
                          {file.flags?.map((flag) => (
                            <Badge key={flag.label} tone={flag.tone}>
                              {flag.label}
                            </Badge>
                          ))}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatBytes(file.sizeBytes)} · {file.uploaderName} ·{" "}
                          {formatDateTime(file.uploadedAt)} ·{" "}
                          <span className={cn(!file.downloadable && "text-amber-700")}>{file.scanLabel}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 pl-12 sm:pl-0">
                      {file.actions}
                      {file.downloadable && (
                        <a href={`/api/files/${file.id}`} className={buttonClass("secondary", "sm")} download>
                          Download
                        </a>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
