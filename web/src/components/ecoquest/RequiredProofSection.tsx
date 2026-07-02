export interface RequiredProofValues {
  requireGps: boolean;
  requireBefore: boolean;
  requireAfter: boolean;
  requireQr: boolean;
}

interface Props {
  values: RequiredProofValues;
  onChange: (values: RequiredProofValues) => void;
}

const PROOF_OPTIONS = [
  {
    key: 'requireGps' as const,
    title: 'GPS check-in',
    description: 'Volunteer must be within radius of task pin',
    icon: '📍',
  },
  {
    key: 'requireBefore' as const,
    title: 'Before photo',
    description: 'Photo proof before starting the task',
    icon: '📷',
  },
  {
    key: 'requireAfter' as const,
    title: 'After photo',
    description: 'Photo proof after completing the task',
    icon: '✅',
  },
  {
    key: 'requireQr' as const,
    title: 'QR validation',
    description: 'Volunteers scan a posted QR at the task site',
    icon: '▦',
  },
];

export function RequiredProofSection({ values, onChange }: Props) {
  function toggle(key: keyof RequiredProofValues) {
    onChange({ ...values, [key]: !values[key] });
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-ink">Required proof</h3>
      <p className="mt-1 text-xs text-ink-muted-48">
        Choose what volunteers must submit for LGU verification.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {PROOF_OPTIONS.map(({ key, title, description, icon }) => {
          const active = values[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`flex items-start gap-3 rounded-[16px] border p-4 text-left transition ${
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-hairline bg-canvas hover:border-ink-muted-48'
              }`}
            >
              <span className="text-xl leading-none" aria-hidden>
                {icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{title}</span>
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${
                      active ? 'bg-primary' : 'bg-ink-muted-48/30'
                    }`}
                    aria-hidden
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                        active ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </span>
                </span>
                <span className="mt-1 block text-xs text-ink-muted-48">{description}</span>
              </span>
            </button>
          );
        })}
      </div>
      {values.requireQr ? (
        <p className="mt-3 rounded-[12px] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-ink-muted-80">
          A task QR code will be generated when you publish. Post it at the task site for volunteers to scan.
        </p>
      ) : null}
    </div>
  );
}

export interface RequiredProof {
  gps?: boolean;
  before_photo?: boolean;
  after_photo?: boolean;
  qr?: boolean;
}

const PROOF_BADGE_ITEMS = [
  { key: 'gps' as const, label: 'GPS', activeClass: 'bg-blue-50 text-blue-700' },
  { key: 'before_photo' as const, label: 'Before photo', activeClass: 'bg-amber-50 text-amber-700' },
  { key: 'after_photo' as const, label: 'After photo', activeClass: 'bg-emerald-50 text-emerald-700' },
  { key: 'qr' as const, label: 'QR', activeClass: 'bg-violet-50 text-violet-700' },
];

export function ProofBadges({
  proof,
  showInactive = false,
}: {
  proof?: RequiredProof;
  showInactive?: boolean;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {PROOF_BADGE_ITEMS.map(({ key, label, activeClass }) => {
        const active = Boolean(proof?.[key]);
        if (!active && !showInactive) return null;
        return (
          <span
            key={key}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              active ? activeClass : 'bg-canvas-parchment text-ink-muted-48'
            }`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
