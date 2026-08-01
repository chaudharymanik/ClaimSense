export async function register() {
  // Only the Node.js runtime touches Prisma/Gemini — this project has no
  // edge routes, but guard anyway since register() fires for both runtimes.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
