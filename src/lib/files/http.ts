import "server-only";
import { z } from "zod";
import { getCaseActor, type CaseActor } from "@/lib/case-access";
import { FileError } from "./service";

// Wraps an upload/download route: resolves the signed-in actor and turns
// errors into JSON responses the uploader can show.
export async function handleFileRoute(
  run: (actor: CaseActor) => Promise<Response>,
): Promise<Response> {
  try {
    const actor = await getCaseActor();
    if (!actor) throw new FileError(401, "Your session has ended. Please sign in again.");
    return await run(actor);
  } catch (error) {
    if (error instanceof FileError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
    console.error(error);
    return Response.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 },
    );
  }
}
