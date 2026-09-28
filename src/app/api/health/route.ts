import { sql } from "drizzle-orm";

async function check(fn: () => Promise<unknown>) {
  try {
    await fn();
    return "ok";
  } catch (error) {
    console.error(error);
    return "error";
  }
}

export async function GET() {
  const [database, storage] = await Promise.all([
    check(async () => {
      const { db } = await import("@/db");
      await db.execute(sql`select 1`);
    }),
    check(async () => {
      const { checkStorage } = await import("@/lib/storage");
      await checkStorage();
    }),
  ]);

  const healthy = database === "ok" && storage === "ok";
  return Response.json({ database, storage }, { status: healthy ? 200 : 503 });
}
