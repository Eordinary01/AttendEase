// Returns the correct login page after logout / token expiry based on role.
// Super admins go to /login.
// All other users (tenant admin, teacher, student, parent) go to /login/:subdomain
// so they land on their institution's login page.
// If the subdomain is unknown (e.g. cleared storage), fall back to the landing page
// where the user can find their institution's unique login link.
export const getPostLogoutPath = (roleOverride) => {
  const role = roleOverride || localStorage.getItem("role");
  const subdomain = localStorage.getItem("tenantSubdomain");
  if (role === "super_admin") return "/login";
  if (subdomain && subdomain !== "demo") return `/login/${subdomain}`;
  return "/";
};
