import { NextResponse } from "next/server";

// GET /api - sonde de sante de l'API (monitoring simple)
export async function GET() {
  return NextResponse.json({ status: "ok", app: "keyvault" });
}
