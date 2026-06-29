import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { ClaimDetailPage } from "./pages/ClaimDetailPage";
import { ClaimsPage } from "./pages/ClaimsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FlightsPage } from "./pages/FlightsPage";
import { LoginPage } from "./pages/LoginPage";
import { NewClaimPage } from "./pages/NewClaimPage";
import { NewFlightPage } from "./pages/NewFlightPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SearchFlightsPage } from "./pages/SearchFlightsPage";

/** Wrap a page in the authenticated app shell. */
function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/search" element={<Protected><SearchFlightsPage /></Protected>} />
      <Route path="/flights" element={<Protected><FlightsPage /></Protected>} />
      <Route path="/flights/new" element={<Protected><NewFlightPage /></Protected>} />
      <Route path="/claims" element={<Protected><ClaimsPage /></Protected>} />
      <Route path="/claims/new" element={<Protected><NewClaimPage /></Protected>} />
      <Route path="/claims/:id" element={<Protected><ClaimDetailPage /></Protected>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
