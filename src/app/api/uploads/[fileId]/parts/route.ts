import { z } from "zod";
import { handleFileRoute } from "@/lib/files/http";
import { signUploadParts } from "@/lib/files/service";

const schema = z.object({ partNumbers: z.array(z.number().int()).min(1).max(20) });

// Short-lived URLs for uploading the requested parts straight to storage.
export async function POST(request: Request, ctx: RouteContext<"/api/uploads/[fileId]/parts">) {
  return handleFileRoute(async (actor) => {
    const { fileId } = await ctx.params;
    const { partNumbers } = schema.parse(await request.json());
    return Response.json(await signUploadParts(actor, z.uuid().parse(fileId), partNumbers));
  });
}
