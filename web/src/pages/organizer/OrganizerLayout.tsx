import { createContext, useContext, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { GlobalNav } from '../../components/ui/GlobalNav';
import { SubNavFrosted } from '../../components/ui/SubNavFrosted';
import { ButtonPrimary } from '../../components/ui/Buttons';
import { useProfile } from '../../hooks/useProfile';

interface OrganizerCleanupContextValue {
  showForm: boolean;
  setShowForm: (open: boolean) => void;
  toggleForm: () => void;
}

const OrganizerCleanupContext = createContext<OrganizerCleanupContextValue | null>(null);

export function useOrganizerCleanup() {
  const ctx = useContext(OrganizerCleanupContext);
  if (!ctx) {
    throw new Error('useOrganizerCleanup must be used within OrganizerLayout');
  }
  return ctx;
}

export function OrganizerLayout() {
  const { profile, ready } = useProfile();
  const [showForm, setShowForm] = useState(false);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-ink-muted-48">
        Loading…
      </div>
    );
  }

  if (!profile || profile.role !== 'organizer') {
    return <Navigate to="/login" replace />;
  }

  return (
    <OrganizerCleanupContext.Provider
      value={{
        showForm,
        setShowForm,
        toggleForm: () => setShowForm((v) => !v),
      }}
    >
      <GlobalNav />
      <SubNavFrosted
        title={profile.organization_name || profile.full_name}
        lead="Community leader · Cleanup drives"
        action={
          <ButtonPrimary type="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New cleanup drive'}
          </ButtonPrimary>
        }
      />
      <Outlet />
    </OrganizerCleanupContext.Provider>
  );
}
