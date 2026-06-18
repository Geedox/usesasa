/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Node-only libs that must not be bundled (loaded at runtime on the server).
  serverExternalPackages: ["pg-boss"],
}

export default nextConfig
