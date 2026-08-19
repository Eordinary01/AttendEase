// Returns the correct login page after logout / expired session based on role.
// Super admins and tenant admins use the generic /login page.
// Students, teachers, and custom-role users must use their institution's
// unique subdomain login link.
export const getPostLogoutPath = (roleOverride) => {
  const role = roleOverride || localStorage.getItem("role");
  const subdomain = localStorage.getItem("tenantSubdomain");
  if (role === "super_admin" || role === "admin") return "/login";
  return subdomain ? `/login/${subdomain}` : "/login";
};
