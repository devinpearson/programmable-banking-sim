import type { NextConfig } from "next";
import path from "path";

// web/ is its own app: pin its root so Next doesn't guess from lockfiles in
// parent folders (the API's, or a stray one in the home directory).
const root = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: root,
  turbopack: {
    root,
  },
};

export default nextConfig;
