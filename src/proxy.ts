import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed Middleware to Proxy; the file must be named proxy.ts and
// sit beside `app`. Clerk still ships the handler as `clerkMiddleware`.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next internals and static files, unless in a search param.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
