import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import EventsPage from './pages/EventsPage';
import GalleryPage from './pages/GalleryPage';
import TransparencyPage from './pages/TransparencyPage';
import LoginPage from './pages/LoginPage';
import { LGULayout } from './pages/lgu/LGULayout';
import LGUDashboard from './pages/lgu/LGUDashboard';
import LGUQueuePage from './pages/lgu/LGUQueuePage';
import LGUMapPage from './pages/lgu/LGUMapPage';
import LGUCleanupPage from './pages/lgu/LGUCleanupPage';
import LGUAttendancePage from './pages/lgu/LGUAttendancePage';
import LGUEcoQuestPage from './pages/lgu/LGUEcoQuestPage';
import LGUAnalyticsPage from './pages/lgu/LGUAnalyticsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/transparency" element={<TransparencyPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/lgu" element={<LGULayout />}>
        <Route index element={<LGUDashboard />} />
        <Route path="queue" element={<LGUQueuePage />} />
        <Route path="map" element={<LGUMapPage />} />
        <Route path="cleanup" element={<LGUCleanupPage />} />
        <Route path="attendance" element={<LGUAttendancePage />} />
        <Route path="ecoquest" element={<LGUEcoQuestPage />} />
        <Route path="analytics" element={<LGUAnalyticsPage />} />
      </Route>
    </Routes>
  );
}
