// File rules shared by the browser uploader and the server. The server is the
// authority; the browser only uses these to reject bad files early.

export type FileKind =
  | "stl"
  | "ply"
  | "obj"
  | "3mf"
  | "dicom"
  | "zip"
  | "jpeg"
  | "png"
  | "heic"
  | "pdf";

type KindInfo = {
  extensions: string[];
  // Stored content type; browsers report dental formats inconsistently, so we
  // never trust theirs.
  mimeType: string;
  // Browser-reported types we accept besides "" and application/octet-stream.
  acceptedMimeTypes: string[];
};

export const fileKinds: Record<FileKind, KindInfo> = {
  stl: {
    extensions: ["stl"],
    mimeType: "model/stl",
    acceptedMimeTypes: ["model/stl", "model/x.stl-binary", "model/x.stl-ascii", "application/sla", "application/vnd.ms-pki.stl"],
  },
  ply: { extensions: ["ply"], mimeType: "application/x-ply", acceptedMimeTypes: ["application/x-ply", "model/ply", "text/plain"] },
  obj: { extensions: ["obj"], mimeType: "model/obj", acceptedMimeTypes: ["model/obj", "text/plain", "application/x-tgif"] },
  "3mf": {
    extensions: ["3mf"],
    mimeType: "model/3mf",
    acceptedMimeTypes: ["model/3mf", "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"],
  },
  dicom: { extensions: ["dcm", "dicom"], mimeType: "application/dicom", acceptedMimeTypes: ["application/dicom"] },
  zip: {
    extensions: ["zip"],
    mimeType: "application/zip",
    acceptedMimeTypes: ["application/zip", "application/x-zip-compressed", "application/x-zip"],
  },
  jpeg: { extensions: ["jpg", "jpeg"], mimeType: "image/jpeg", acceptedMimeTypes: ["image/jpeg", "image/pjpeg"] },
  png: { extensions: ["png"], mimeType: "image/png", acceptedMimeTypes: ["image/png"] },
  heic: { extensions: ["heic", "heif"], mimeType: "image/heic", acceptedMimeTypes: ["image/heic", "image/heif"] },
  pdf: { extensions: ["pdf"], mimeType: "application/pdf", acceptedMimeTypes: ["application/pdf"] },
};

export type UploadLimits = {
  acceptedKinds: FileKind[];
  maxFileBytes: number;
  maxCaseBytes: number;
  maxFilesPerCase: number;
};

const GB = 1024 ** 3;

// Overridable per deployment through the "uploads" app setting.
export const defaultUploadLimits: UploadLimits = {
  acceptedKinds: Object.keys(fileKinds) as FileKind[],
  maxFileBytes: 2 * GB,
  maxCaseBytes: 5 * GB,
  maxFilesPerCase: 50,
};

// R2 needs every part except the last to be the same size and at least 5 MiB.
// 10,000 parts × 16 MiB covers files well beyond the size limit.
export const PART_SIZE = 16 * 1024 * 1024;

export function extensionOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function kindForFilename(filename: string): FileKind | null {
  const ext = extensionOf(filename);
  for (const [kind, info] of Object.entries(fileKinds)) {
    if (info.extensions.includes(ext)) return kind as FileKind;
  }
  return null;
}

export function acceptAttribute(limits: UploadLimits) {
  return limits.acceptedKinds
    .flatMap((kind) => fileKinds[kind].extensions.map((ext) => `.${ext}`))
    .join(",");
}

export function describeAccepted(limits: UploadLimits) {
  const names: Record<FileKind, string> = {
    stl: "STL", ply: "PLY", obj: "OBJ", "3mf": "3MF", dicom: "DICOM",
    zip: "ZIP", jpeg: "JPG", png: "PNG", heic: "HEIC", pdf: "PDF",
  };
  return limits.acceptedKinds.map((kind) => names[kind]).join(", ");
}

// Returns an error message, or null when the file may be uploaded.
export function checkFile(
  file: { name: string; size: number; type: string },
  limits: UploadLimits,
): string | null {
  const kind = kindForFilename(file.name);
  if (!kind || !limits.acceptedKinds.includes(kind)) {
    return `This file type is not accepted. Use ${describeAccepted(limits)}.`;
  }
  const type = file.type.toLowerCase();
  if (type && type !== "application/octet-stream" && !fileKinds[kind].acceptedMimeTypes.includes(type)) {
    return "The file contents do not match its extension.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > limits.maxFileBytes) {
    return `This file is larger than the ${formatBytes(limits.maxFileBytes)} limit.`;
  }
  return null;
}

export const fileLabels = [
  "Upper scan",
  "Lower scan",
  "Bite scan",
  "Old denture scan",
  "Photo",
  "Instructions",
  "Other",
] as const;

// Suggests a label from common exocad / 3Shape export names.
export function guessLabel(filename: string): string {
  const name = filename.toLowerCase();
  const kind = kindForFilename(filename);
  if (/bite|occlu|buccal|registration/.test(name)) return "Bite scan";
  if (/upper|maxill|oberkiefer|[_\- ]u\./.test(name)) return "Upper scan";
  if (/lower|mandib|unterkiefer|[_\- ]l\./.test(name)) return "Lower scan";
  if (kind === "jpeg" || kind === "png" || kind === "heic") return "Photo";
  if (kind === "pdf") return "Instructions";
  return "Other";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export const fileCategoryLabels = {
  client_upload: "Original uploads",
  additional_information: "Additional information",
  design_preview: "Design previews",
  revision_file: "Revision files",
  final_deliverable: "Final deliverables",
  report_instruction: "Reports & instructions",
} as const;

export type FileCategory = keyof typeof fileCategoryLabels;

export const fileCategorySingular: Record<FileCategory, string> = {
  client_upload: "Original upload",
  additional_information: "Additional file",
  design_preview: "Design preview",
  revision_file: "Revision file",
  final_deliverable: "Final deliverable",
  report_instruction: "Report or instructions",
};

export const clientUploadCategories: FileCategory[] = ["client_upload", "additional_information"];
