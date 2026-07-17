import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev runs on Turbopack: pdfjs-dist ships webpack-built .mjs whose internal
  // identifiers collide with webpack's eval devtool wrapping in `next dev`.
  webpack: (config) => {
    // pdfjs-dist optionally requires the "canvas" package in Node contexts;
    // it isn't needed in the browser build.
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
