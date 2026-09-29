import { z } from "zod";
import { handleFileRoute } from "@/lib/files/http";
import { removeUpload, updateFileLabel } from "@/lib/files/service";

export async function PATCH(request: Request, ctx: RouteContext<"/api/uploads/[fileId]">) {
  return handleFileRoute(async (actor) => {
    const { fileId } = await ctx.params;
    const { label } = z.object({ label: z.string().max(60) }).parse(await request.json());
    await updateFileLabel(actor, z.uuid().parse(fileId), label);
    return Response.json({ ok: true });
  });
}

export async function DELETE(_: Request, ctx: RouteContext<"/api/uploads/[fileId]">) {
  return handleFileRoute(async (actor) => {
    const { fileId } = await ctx.params;
    await removeUpload(actor, z.uuid().parse(fileId));
    return Response.json({ ok: true });
  });
}
