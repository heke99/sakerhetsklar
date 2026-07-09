import { NextResponse } from "next/server";

import { openApiDoc } from "@/lib/api/openapi";

export async function GET() {
  return NextResponse.json(openApiDoc);
}
