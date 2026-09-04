import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

export function AppRouter({ shell }: { shell: ReactElement }) {
  return (
    <Routes>
      <Route path="/" element={shell} />
      <Route path="/chat" element={shell} />
      <Route path="/chat/:conversationId" element={shell} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
