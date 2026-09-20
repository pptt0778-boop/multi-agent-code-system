/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  // Static HTML export for GitHub Pages (Phase: deployment).
  output: "export",
  // Project pages are served from /<repo>/ — only apply the prefix in prod
  // so local `next dev` keeps working at /.
  basePath: isProd ? "/multi-agent-code-system" : "",
  assetPrefix: isProd ? "/multi-agent-code-system/" : "",
  // GitHub Pages is static hosting: no Image Optimization server.
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;

