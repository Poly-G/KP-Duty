import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/setup-password", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};

export default nextConfig;
