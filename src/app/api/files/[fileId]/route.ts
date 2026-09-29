import { z } from "zod";
import { handleFileRoute } from "@/lib/files/http";
import { getDownloadUrl } from "@/lib/files/service";

// Checks access, logs the download, then redirects to a short-lived link.
export async function GET(_: Request, ctx: RouteContext<"/api/files/[fileId]">) {
  const response = await handleFileRoute(async (actor) => {
    const { fileId } = await ctx.params;
    const url = await getDownloadUrl(actor, z.uuid().parse(fileId));
    return Response.redirect(url, 303);
  });
  if (response.ok || response.status === 303) return response;
  // Opened as a link, so show a readable message rather than JSON.
  const { error } = (await response.json()) as { error: string };
  return new Response(error, {
    status: response.status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
