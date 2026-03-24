import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { getPostAuthPath } from "@/lib/auth";

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/auth/login" />;
  }

  return <Outlet />;
}

export function RedirectAuthenticated() {
  const auth = useAuth();

  if (auth.isAuthenticated) {
    return <Navigate replace to={getPostAuthPath(auth.user)} />;
  }

  return <Outlet />;
}
