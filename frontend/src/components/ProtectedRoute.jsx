import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children, roles, permission }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500" data-testid="loading">Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;
  const hasRole = !roles || roles.includes(user.role);
  const hasPerm = !permission || (user.permissions || []).includes(permission);
  if (!hasRole && !hasPerm) return <Navigate to="/dashboard" replace />;
  return children;
}
