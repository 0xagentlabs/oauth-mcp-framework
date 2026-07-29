import { NextRequest, NextResponse } from "next/server";
import { getPage, renderPage } from "@/lib/pages";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const page = await getPage((await context.params).id);
    if (!page) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(renderPage(page), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Service unavailable", { status: 503 });
  }
}
