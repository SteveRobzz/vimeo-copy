import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

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
  // In a pnpm monorepo Next's tracer doesn't copy Prisma's query-engine .so
  // next to the serverless bundle, so the client can't find it at runtime
  // (500s on every DB call). This official plugin copies the engine in.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
};

export default nextConfig;
