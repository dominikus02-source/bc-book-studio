/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.prisma/client/**/*", "./node_modules/@prisma/client/**/*"],
  },
};
export default config;
