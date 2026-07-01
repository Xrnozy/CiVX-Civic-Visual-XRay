import { Routes, Route } from 'react-router-dom';
import { RegistrationGate } from './components/auth/RegistrationGate';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import EventsPage from './pages/EventsPage';
import GalleryPage from './pages/GalleryPage';
import TransparencyPage from './pages/TransparencyPage';
import ReportPage from './pages/ReportPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CompleteRegistrationPage from './pages/CompleteRegistrationPage';
import StreetSweeperWelcomePage from './pages/StreetSweeperWelcomePage';
import { LGULayout } from './pages/lgu/LGULayout';
import LGUDashboard from './pages/lgu/LGUDashboard';
import LGUQueuePage from './pages/lgu/LGUQueuePage';
import LGUMapPage from './pages/lgu/LGUMapPage';
import LGUCleanupPage from './pages/lgu/LGUCleanupPage';
import LGUAttendancePage from './pages/lgu/LGUAttendancePage';
import LGUEcoQuestPage from './pages/lgu/LGUEcoQuestPage';
import LGUAnalyticsPage from './pages/lgu/LGUAnalyticsPage';
import LGUWorkerInvitesPage from './pages/lgu/LGUWorkerInvitesPage';
import LGUStaffPage from './pages/lgu/LGUStaffPage';
import { OrganizerLayout } from './pages/organizer/OrganizerLayout';
import OrganizerCleanupPage from './pages/organizer/OrganizerCleanupPage';
import { WorkerLayout } from './pages/worker/WorkerLayout';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerShiftsPage from './pages/worker/WorkerShiftsPage';

export default function App() {
  return (
    <RegistrationGate>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/transparency" element={<TransparencyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/complete" element={<CompleteRegistrationPage />} />
        <Route path="/street-sweeper/welcome" element={<StreetSweeperWelcomePage />} />
        <Route path="/lgu" element={<LGULayout />}>
          <Route index element={<LGUDashboard />} />
          <Route path="queue" element={<LGUQueuePage />} />
          <Route path="map" element={<LGUMapPage />} />
          <Route path="cleanup" element={<LGUCleanupPage />} />
          <Route path="worker-invites" element={<LGUWorkerInvitesPage />} />
          <Route path="staff" element={<LGUStaffPage />} />
          <Route path="attendance" element={<LGUAttendancePage />} />
          <Route path="ecoquest" element={<LGUEcoQuestPage />} />
          <Route path="analytics" element={<LGUAnalyticsPage />} />
        </Route>
        <Route path="/organizer" element={<OrganizerLayout />}>
          <Route index element={<OrganizerCleanupPage />} />
        </Route>
        <Route path="/worker" element={<WorkerLayout />}>
          <Route index element={<WorkerDashboard />} />
          <Route path="shifts" element={<WorkerShiftsPage />} />
        </Route>
      </Routes>
    </RegistrationGate>
  );
}
