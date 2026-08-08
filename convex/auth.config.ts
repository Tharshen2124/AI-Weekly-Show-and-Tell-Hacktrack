// Tells Convex which JWTs to trust. CLERK_JWT_ISSUER_DOMAIN is set on the
// Convex deployment (`npx convex env set`), not in .env.local, and must match
// the issuer of the Clerk JWT template named "convex".
const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
