import "server-only";
import { demoMode } from "@/lib/site";

// No malware scanner is connected yet, so uploads keep scanStatus "pending".
// Pending files are quarantined (not downloadable or releasable), except in
// demo mode, where they are available and labelled as not scanned. Connecting
// a scanner means setting scanStatus to "clean" or "infected" after upload.
export function isScanCleared(scanStatus: string) {
  return scanStatus === "clean" || (demoMode && scanStatus === "pending");
}

export function scanLabel(scanStatus: string) {
  if (scanStatus === "pending") return demoMode ? "Not scanned (demo)" : "Scan pending";
  if (scanStatus === "clean") return "Scanned";
  if (scanStatus === "infected") return "Blocked: malware";
  return "Scan failed";
}
