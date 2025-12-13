/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable SWC minify to avoid a Radix Progress minification bug that produces invalid JS
  swcMinify: false,
  images: { unoptimized: true },
};

module.exports = nextConfig;
