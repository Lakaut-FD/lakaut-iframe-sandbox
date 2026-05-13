import { NextResponse } from "next/server";
import { createSession } from "@/lib/web2";
import { getServerSession } from "next-auth";
import { authOptions, isAllowedEmail } from "@/lib/auth";

interface PostBody {
  integratorId?: string;
  apiKey?: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAllowedEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const integratorId = body.integratorId || process.env.INTEGRATOR_ID || "";
  const apiKey = body.apiKey || process.env.INTEGRATOR_API_KEY || "";

  if (!integratorId || !apiKey) {
    return NextResponse.json(
      { error: "Faltan integratorId o apiKey (ni en body ni en env)" },
      { status: 400 }
    );
  }

  try {
    const data = await createSession({ integratorId, apiKey });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
