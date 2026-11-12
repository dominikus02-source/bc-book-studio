/** @type {import('next').NextConfig} */
const qaDistDir = process.env.BC_QA_NEXT_DIST_DIR;
if (qaDistDir && !/^\.[a-z0-9._-]+$/i.test(qaDistDir)) throw new Error("Invalid QA Next build directory");
const config = {
  ...(qaDistDir ? { distDir: qaDistDir } : {}),
  output: "standalone",
  // Keep pdfjs-dist external. Bundling legacy/build/pdf.mjs into a server chunk
  // breaks its runtime worker import. On Node, PDF.js disables Worker threads and
  // then dynamically imports "./pdf.worker.mjs" (a variable specifier marked
  // webpackIgnore). File tracing therefore copies pdf.mjs and omits the sibling
  // worker, and the standalone server fails with:
  // Setting up fake worker failed: Cannot find module '.../pdf.worker.mjs'.
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/katex/dist/fonts/KaTeX_Main-Regular.ttf",
      "./node_modules/katex/dist/fonts/KaTeX_Main-Bold.ttf",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
};
export default config;
