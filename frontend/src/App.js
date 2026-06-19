import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Requests from "@/pages/Requests";
import RequestCreate from "@/pages/RequestCreate";
import RequestDetail from "@/pages/RequestDetail";
import Kanban from "@/pages/Kanban";
import AuditLog from "@/pages/AuditLog";
import Users from "@/pages/Users";
import Stores from "@/pages/Stores";
import Settings from "@/pages/Settings";
import Reports from "@/pages/Reports";
import Backup from "@/pages/Backup";
import "@/App.css";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/requests/new" element={<ProtectedRoute roles={["store_user","it_admin","manager"]}><RequestCreate /></ProtectedRoute>} />
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route path="/kanban" element={<ProtectedRoute roles={["approval_user","manager","it_admin"]}><Kanban /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute roles={["it_admin"]}><AuditLog /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={["it_admin"]}><Users /></ProtectedRoute>} />
            <Route path="/stores" element={<ProtectedRoute roles={["it_admin","manager"]}><Stores /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute roles={["it_admin","manager"]}><Settings /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={["it_admin","manager"]} permission="can_view_reports"><Reports /></ProtectedRoute>} />
            <Route path="/backup" element={<ProtectedRoute roles={["it_admin"]}><Backup /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
