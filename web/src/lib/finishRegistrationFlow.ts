import {
  completeRegistration,
  fetchProfileAfterAuth,
  isRegistrationComplete,
  redirectPathForRole,
  registrationErrorMessage,
} from './auth';
import {
  clearPendingRegistration,
  finishPendingRegistration,
  isPendingRegistrationComplete,
  loadPendingRegistration,
  type PendingRegistration,
} from './pendingRegistration';

export async function tryCompletePendingRegistration(
  pending: PendingRegistration,
): Promise<{ completed: boolean; role?: string; profile?: Awaited<ReturnType<typeof completeRegistration>>; error?: string }> {
  // #region agent log
  fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'finishRegistrationFlow.ts:tryComplete',message:'attempt',data:{accountType:pending.account_type,complete:isPendingRegistrationComplete(pending)},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  if (!isPendingRegistrationComplete(pending)) {
    return { completed: false, error: 'Please finish all required registration fields.' };
  }
  try {
    const payload = await finishPendingRegistration(pending);
    const profile = await completeRegistration(payload);
    clearPendingRegistration();
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'finishRegistrationFlow.ts:tryComplete',message:'success',data:{role:profile.role,registrationCompleted:profile.registration_completed},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    return { completed: true, role: profile.role, profile };
  } catch (err) {
    const error = registrationErrorMessage(err);
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'finishRegistrationFlow.ts:tryComplete',message:'failed',data:{error:error.slice(0,200)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    return { completed: false, error };
  }
}

export async function completeRegistrationFromSessionStorage(
  navigate: (path: string, options?: { replace?: boolean }) => void,
  nextPath?: string | null,
): Promise<boolean> {
  const pending = loadPendingRegistration();
  if (!pending) return false;

  const profile = await fetchProfileAfterAuth();
  if (isRegistrationComplete(profile)) {
    clearPendingRegistration();
    navigate(nextPath || redirectPathForRole(profile.role), { replace: true });
    return true;
  }

  const result = await tryCompletePendingRegistration(pending);
  if (result.completed && result.role) {
    navigate(nextPath || redirectPathForRole(result.role), { replace: true });
    return true;
  }
  return false;
}
