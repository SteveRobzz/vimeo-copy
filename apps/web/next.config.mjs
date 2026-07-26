/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS; let Next transpile them.
  transpilePackages: ["@vp/db", "@vp/core"],
  experimental: {
    // Keep these Node-only libs out of the bundler — bullmq loads Lua scripts
    // and ioredis has dynamic requires that webpack shouldn't touch.
    serverComponentsExternalPackages: ["bullmq", "ioredis", "@aws-sdk/client-s3"],
  },
};

export default nextConfig;
