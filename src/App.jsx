import { Routes, Route, Navigate } from 'react-router-dom';
import Ops from './Ops';
import UserHome from './UserHome';

function getStoredUser() {
  try {
    const raw = localStorage.getItem('btm_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function RequireAuth({ children }) {
  const user = getStoredUser();
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== 'admin' && user.role !== 'house') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function Home() {
  const user = getStoredUser();
  if (user && (user.role === 'admin' || user.role === 'house')) {
    return <Navigate to="/ops" replace />;
  }
  return <UserHome />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
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