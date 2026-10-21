import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@triade/ui", "@triade/domain", "@triade/servidor", "@triade/configuracoes"],
};

export default config;
