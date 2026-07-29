import { NextRequest, NextResponse } from "next/server";
import { registerGrokClient } from "@/lib/oauth";

const corsHeaders = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(registerGrokClient(await req.json()), {
      status: 201,
      headers: corsHeaders,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_client_metadata";
    return NextResponse.json({ error: code }, { status: 400, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
