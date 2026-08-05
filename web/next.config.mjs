/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // /shared ships raw TypeScript — Next must compile it rather than expect a build step.
  transpilePackages: ['@priorbyte/shared'],
  eslint: {
    dirs: ['src'],
  },
  experimental: {
    // Default 1MB body limit is too small for a base64-encoded PDF upload
    // (the PDF Reader tool sends the file straight to Gemini as inline data).
    serverActionsBodySizeLimit: '10mb',
  },
};

export default nextConfig;
