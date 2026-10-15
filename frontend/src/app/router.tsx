import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "../features/auth/components/LoginPage";

export function AppRouter({ shell }: { shell: ReactElement }) {
  return (
    <Routes>
      <Route path="/" element={shell} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/chat" element={shell} />
      <Route path="/chat/:conversationId" element={shell} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
