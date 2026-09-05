import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  //   reactStrictMode: false,
  allowedDevOrigins: [
    "192.168.1.36",
    "localhost",
    "illegible-perpendicularly-shenika.ngrok-free.dev",
  ],
};

export default nextConfig;
