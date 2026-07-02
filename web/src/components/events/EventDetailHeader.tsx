import {
  EVENT_BANNER_PLACEHOLDER,
  EVENT_CATEGORY_LABEL,
  organizationInitials,
} from '../../types/eventDetail';

interface Props {
  title: string;
  organizerName: string;
  organizerLogoUrl?: string | null;
  bannerUrl?: string | null;
}

type CommunityLogo =
  | { kind: 'image'; src: string; source: 'organization_logo' }
  | { kind: 'initials'; initials: string; source: 'initials_fallback' };

function resolveCommunityLogo(organizerLogoUrl?: string | null, organizerName?: string): CommunityLogo {
  const logo = organizerLogoUrl?.trim();
  if (logo) return { kind: 'image', src: logo, source: 'organization_logo' };
  return {
    kind: 'initials',
    initials: organizationInitials(organizerName || 'Organization'),
    source: 'initials_fallback',
  };
}

export function EventDetailHeader({
  title,
  organizerName,
  organizerLogoUrl,
  bannerUrl,
}: Props) {
  const bannerSrc = bannerUrl?.trim() || EVENT_BANNER_PLACEHOLDER;
  const avatar = resolveCommunityLogo(organizerLogoUrl, organizerName);

  // #region agent log
  fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'post-fix',location:'EventDetailHeader.tsx:render',message:'community logo resolved',data:{source:avatar.source,kind:avatar.kind,organizerLogoUrl:organizerLogoUrl?.trim()||null,organizerName,initials:avatar.kind==='initials'?avatar.initials:null},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  return (
    <header className="overflow-hidden rounded-[24px] border border-hairline bg-canvas shadow-sm">
      <div className="relative h-48 sm:h-64 md:h-72">
        <img src={bannerSrc} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 sm:p-6">
          <div className="relative shrink-0">
            {avatar.kind === 'image' ? (
              <img
                src={avatar.src}
                alt={`${organizerName} community logo`}
                className="h-16 w-16 rounded-full border-4 border-white bg-white object-cover shadow-lg sm:h-20 sm:w-20"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-primary text-base font-semibold text-white shadow-lg sm:h-20 sm:w-20 sm:text-lg"
                aria-label={`${organizerName} organization initials`}
              >
                {avatar.initials}
              </div>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
              {EVENT_CATEGORY_LABEL}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-white/85">Organized by {organizerName}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
