/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Google Fonts stylesheet is linked directly in app/layout.tsx; Next's
  // build-time font inlining isn't needed and would fail on restricted networks.
  optimizeFonts: false,
};

export default nextConfig;
