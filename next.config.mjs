/** @type {import('next').NextConfig} */
const qaDistDir = process.env.BC_QA_NEXT_DIST_DIR;
if (qaDistDir && !/^\.[a-z0-9._-]+$/i.test(qaDistDir)) throw new Error("Invalid QA Next build directory");
const config = {
  ...(qaDistDir ? { distDir: qaDistDir } : {}),
  output: "standalone",
  // pdfjs-dist loads its own worker file at runtime; bundling it into a server vendor chunk breaks worker resolution.
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.prisma/client/**/*", "./node_modules/@prisma/client/**/*", "./node_modules/katex/dist/fonts/KaTeX_Main-Regular.ttf", "./node_modules/katex/dist/fonts/KaTeX_Main-Bold.ttf"],
  },
};
export default config;
