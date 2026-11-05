export type Role = "passenger" | "driver" | "admin";

/** Default home path for a role. */
export function homeForRole(role: string | undefined | null): string {
  if (role === "driver") return "/driver";
  if (role === "admin") return "/admin";
  return "/";
}

/** Whether `next` is allowed for this role. */
export function resolvePostLoginPath(role: string, next: string | null | undefined): string {
  const fallback = homeForRole(role);
  if (!next || next === "/") return fallback;
  if (next.startsWith("/driver")) return role === "driver" || role === "admin" ? "/driver" : fallback;
  if (next.startsWith("/admin")) return role === "admin" ? "/admin" : fallback;
  // passenger home or other
  if (role === "driver") return "/driver";
  if (role === "admin") return "/admin";
  return next.startsWith("/") ? next : fallback;
}
