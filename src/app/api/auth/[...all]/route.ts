import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/server/auth";

// Better Auth endpoints (Discord sign-in, callback, session, sign-out). Created lazily so a
// missing env var fails the request instead of the build.
export const GET = (req: Request) => toNextJsHandler(auth()).GET(req);
export const POST = (req: Request) => toNextJsHandler(auth()).POST(req);
