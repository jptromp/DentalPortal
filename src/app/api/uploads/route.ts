import { z } from "zod";
import { handleFileRoute } from "@/lib/files/http";
import { fileCategoryLabels, type FileCategory } from "@/lib/files/rules";
import { FileError, startUpload } from "@/lib/files/service";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  caseId: z.uuid(),
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().positive(),
  type: z.string().max(200),
  label: z.string().max(60).optional(),
  category: z.enum(Object.keys(fileCategoryLabels) as [FileCategory, ...FileCategory[]]).optional(),
  internal: z.boolean().optional(),
  replacesFileId: z.uuid().optional(),
});

// Starts a multipart upload directly to storage and records the pending file.
export async function POST(request: Request) {
  return handleFileRoute(async (actor) => {
    const input = schema.parse(await request.json());
    if (!(await rateLimit(`upload:${actor.user.id}`, 300, 60 * 60))) {
      throw new FileError(429, "Too many uploads in a short time. Please wait a few minutes.");
    }
    return Response.json(await startUpload(actor, input));
  });
}
