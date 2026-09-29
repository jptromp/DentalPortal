"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { FileUploader } from "./file-uploader";

// Uploader for a submitted case: finished files move into the page's file
// list, which is refreshed from the server.
export function CaseUploader(
  props: Omit<ComponentProps<typeof FileUploader>, "onFileUploaded" | "hideFinished" | "removableAfterUpload">,
) {
  const router = useRouter();
  return (
    <FileUploader
      {...props}
      removableAfterUpload={false}
      hideFinished
      onFileUploaded={() => router.refresh()}
    />
  );
}
