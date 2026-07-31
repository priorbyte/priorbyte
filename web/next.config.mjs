/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // /shared ships raw TypeScript — Next must compile it rather than expect a build step.
  transpilePackages: ['@priorbyte/shared'],
  eslint: {
    dirs: ['src'],
  },
};

export default nextConfig;
