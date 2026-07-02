import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { RegistrationGate } from './components/auth/RegistrationGate';
import { PageLoader } from './components/ui/PageLoader';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';

const MapPage = lazy(() => import('./pages/MapPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const EventCheckInPage = lazy(() => import('./pages/EventCheckInPage'));
const LazyGalleryPage = lazy(() => import('./pages/GalleryPage'));
const TransparencyPage = lazy(() => import('./pages/TransparencyPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const CompleteRegistrationPage = lazy(() => import('./pages/CompleteRegistrationPage'));
const StreetSweeperWelcomePage = lazy(() => import('./pages/StreetSweeperWelcomePage'));
const AnalyzerTestPage = lazy(() => import('./pages/AnalyzerTestPage'));
const LGULayout = lazy(() => import('./pages/lgu/LGULayout').then((m) => ({ default: m.LGULayout })));
const LGUDashboard = lazy(() => import('./pages/lgu/LGUDashboard'));
const LGUQueuePage = lazy(() => import('./pages/lgu/LGUQueuePage'));
const LGUMapPage = lazy(() => import('./pages/lgu/LGUMapPage'));
const LGUCleanupPage = lazy(() => import('./pages/lgu/LGUCleanupPage'));
const LGUAttendancePage = lazy(() => import('./pages/lgu/LGUAttendancePage'));
const LGUEcoQuestPage = lazy(() => import('./pages/lgu/LGUEcoQuestPage'));
const LGUAnalyticsPage = lazy(() => import('./pages/lgu/LGUAnalyticsPage'));
const LGUWorkerInvitesPage = lazy(() => import('./pages/lgu/LGUWorkerInvitesPage'));
const LGUStaffPage = lazy(() => import('./pages/lgu/LGUStaffPage'));
const OrganizerLayout = lazy(() => import('./pages/organizer/OrganizerLayout').then((m) => ({ default: m.OrganizerLayout })));
const OrganizerCleanupPage = lazy(() => import('./pages/organizer/OrganizerCleanupPage'));
const WorkerLayout = lazy(() => import('./pages/worker/WorkerLayout').then((m) => ({ default: m.WorkerLayout })));
const WorkerDashboard = lazy(() => import('./pages/worker/WorkerDashboard'));
const WorkerShiftsPage = lazy(() => import('./pages/worker/WorkerShiftsPage'));
const MobileDemoLayout = lazy(() => import('./mobile/MobileDemoLayout').then((m) => ({ default: m.MobileDemoLayout })));
const MobileHome = lazy(() => import('./mobile/screens/MobileHome'));
const MobileMap = lazy(() => import('./mobile/screens/MobileMap'));
const MobileEvents = lazy(() => import('./mobile/screens/MobileEvents'));
const MobileCamera = lazy(() => import('./mobile/screens/MobileCamera'));
const MobileEcoQuest = lazy(() => import('./mobile/screens/MobileEcoQuest'));
const MobileReport = lazy(() => import('./mobile/screens/MobileReport'));
const MobileAccount = lazy(() => import('./mobile/screens/MobileAccount'));
const DispatchLayout = lazy(() => import('./pages/dispatch/DispatchLayout').then((m) => ({ default: m.DispatchLayout })));
const DispatchDashboard = lazy(() => import('./pages/dispatch/DispatchDashboard'));
const DispatchCasePage = lazy(() => import('./pages/dispatch/DispatchCasePage'));
const DispatchMapPage = lazy(() => import('./pages/dispatch/DispatchMapPage'));

export default function App() {
  return (
    <RegistrationGate>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/check-in/:eventId" element={<EventCheckInPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/analyzer" element={<AnalyzerTestPage />} />
          <Route path="/analyzer/test" element={<AnalyzerTestPage />} />
          <Route path="/gallery" element={<LazyGalleryPage />} />
          <Route path="/transparency" element={<TransparencyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/register/complete" element={<CompleteRegistrationPage />} />
          <Route path="/street-sweeper/welcome" element={<StreetSweeperWelcomePage />} />
          <Route path="/mobile" element={<MobileDemoLayout />}>
            <Route index element={<MobileHome />} />
            <Route path="map" element={<MobileMap />} />
            <Route path="events" element={<MobileEvents />} />
            <Route path="camera" element={<MobileCamera />} />
            <Route path="ecoquest" element={<MobileEcoQuest />} />
            <Route path="report" element={<MobileReport />} />
            <Route path="account" element={<MobileAccount />} />
          </Route>
          <Route path="/dispatch" element={<DispatchLayout />}>
            <Route index element={<DispatchDashboard />} />
            <Route path="map" element={<DispatchMapPage />} />
            <Route path="cases/:assignmentId" element={<DispatchCasePage />} />
          </Route>
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
      </Suspense>
    </RegistrationGate>
  );
}
