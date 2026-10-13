import {NextResponse, type NextRequest} from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export default async function proxy(request: NextRequest) {
  // Machine endpoint has its own signed authentication and a closed default.
  if(['/api/integrations/solta/portal','/api/integrations/solta/files','/api/integrations/solta/notifications/retry'].includes(request.nextUrl.pathname))return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
