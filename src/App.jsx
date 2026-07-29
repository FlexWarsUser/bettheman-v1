import { Routes, Route, Navigate } from 'react-router-dom';
import Ops from './Ops';
import UserHome from './UserHome';

function RequireAuth({ children }) {
  const raw = localStorage.getItem('btm_user');
  if (!raw) return <Navigate to="/" replace />;
  try {
    const user = JSON.parse(raw);
    if (user.role !== 'admin' && user.role !== 'house') {
      return <Navigate to="/" replace />;
    }
  } catch {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UserHome />} />
      <Route
        path="/ops"
        element={
          <RequireAuth>
            <Ops />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}