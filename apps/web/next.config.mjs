/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@diyaa/types'],
  experimental: {
    typedRoutes: false,
  },
};
export default nextConfig;
