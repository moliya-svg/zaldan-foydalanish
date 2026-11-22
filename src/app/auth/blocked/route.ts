import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Профили блокланган ёки топилмаган фойдаланувчини тизимдан чиқариш
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?blocked=1", request.nextUrl.origin));
}
