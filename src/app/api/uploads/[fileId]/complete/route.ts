import { z } from "zod";
import { handleFileRoute } from "@/lib/files/http";
import { completeUpload } from "@/lib/files/service";

// Assembles the uploaded parts, then checks the file's size and content type.
export async function POST(_: Request, ctx: RouteContext<"/api/uploads/[fileId]/complete">) {
  return handleFileRoute(async (actor) => {
    const { fileId } = await ctx.params;
    const file = await completeUpload(actor, z.uuid().parse(fileId));
    return Response.json({ id: file.id, uploadStatus: file.uploadStatus });
  });
}
