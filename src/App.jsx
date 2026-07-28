import { Routes, Route, Navigate } from 'react-router-dom';
import Ops from './Ops';
import UserHome from './UserHome';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UserHome />} />
      <Route path="/ops" element={<Ops />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}