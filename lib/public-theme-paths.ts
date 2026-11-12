export const EDITORIAL_PUBLIC_PATHS = ["/", "/login", "/activate", "/forgot-password", "/reset-password", "/syarat-ketentuan"] as const;

export function isEditorialPublicPath(pathname: string) {
  return (EDITORIAL_PUBLIC_PATHS as readonly string[]).includes(pathname);
}
