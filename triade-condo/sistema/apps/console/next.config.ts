import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@triade/ui", "@triade/domain", "@triade/servidor"],
};

export default config;
