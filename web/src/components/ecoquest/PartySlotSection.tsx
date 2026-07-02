import { useCallback, useEffect, useState } from 'react';
import { FORM_FIELD_INPUT } from '../map/LocationPickerSection';
import { api } from '../../lib/api';

export type PartyEntryType = 'user' | 'external' | 'manual';
export type DbSource = 'user' | 'external';
export type FillMode = 'manual' | 'database';

export interface PartyEntryPayload {
  type: PartyEntryType;
  ref_id?: string;
  name?: string;
}

export interface PartySlot {
  key: string;
  fillMode: FillMode;
  manualName: string;
  dbSource: DbSource;
  searchQuery: string;
  refId: string | null;
  displayLabel: string;
}

interface SearchUser {
  id: string;
  full_name: string;
  email?: string;
  organization_name?: string;
  role: string;
}

interface ExternalPartner {
  id: string;
  name: string;
}

export function createEmptyPartySlot(): PartySlot {
  return {
    key: crypto.randomUUID(),
    fillMode: 'manual',
    manualName: '',
    dbSource: 'user',
    searchQuery: '',
    refId: null,
    displayLabel: '',
  };
}

export function partySlotToEntry(slot: PartySlot): PartyEntryPayload | null {
  if (slot.fillMode === 'manual') {
    const name = slot.manualName.trim();
    if (!name) return null;
    return { type: 'manual', name };
  }
  if (slot.refId) {
    return { type: slot.dbSource, ref_id: slot.refId };
  }
  return null;
}

function userLabel(user: SearchUser): string {
  if (user.organization_name) {
    return `${user.organization_name} (${user.full_name})`;
  }
  return user.full_name;
}

interface PartySlotRowProps {
  slot: PartySlot;
  index: number;
  onChange: (slot: PartySlot) => void;
  onRemove: () => void;
}

function PartySlotRow({ slot, index, onChange, onRemove }: PartySlotRowProps) {
  const [results, setResults] = useState<(SearchUser | ExternalPartner)[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (slot.fillMode !== 'database') {
      setResults([]);
      return;
    }
    const term = slot.searchQuery.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        if (slot.dbSource === 'user') {
          const rows = await api<SearchUser[]>(
            `/api/users/ecoquest-selectables?q=${encodeURIComponent(term)}`,
          );
          setResults(rows);
        } else {
          const rows = await api<ExternalPartner[]>(
            `/api/external-partners?q=${encodeURIComponent(term)}`,
          );
          setResults(rows);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [slot.fillMode, slot.dbSource, slot.searchQuery]);

  function selectResult(result: SearchUser | ExternalPartner) {
    if (slot.dbSource === 'user') {
      const user = result as SearchUser;
      onChange({
        ...slot,
        refId: user.id,
        displayLabel: userLabel(user),
        searchQuery: userLabel(user),
      });
    } else {
      const partner = result as ExternalPartner;
      onChange({
        ...slot,
        refId: partner.id,
        displayLabel: partner.name,
        searchQuery: partner.name,
      });
    }
    setResults([]);
  }

  function switchFillMode(fillMode: FillMode) {
    onChange({
      ...slot,
      fillMode,
      manualName: fillMode === 'manual' ? slot.manualName : '',
      refId: fillMode === 'database' ? slot.refId : null,
      displayLabel: fillMode === 'database' ? slot.displayLabel : '',
      searchQuery: fillMode === 'database' ? slot.searchQuery : '',
    });
  }

  function switchDbSource(dbSource: DbSource) {
    onChange({
      ...slot,
      dbSource,
      refId: null,
      displayLabel: '',
      searchQuery: '',
    });
    setResults([]);
  }

  return (
    <div className="rounded-lg border border-hairline bg-canvas-parchment p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Entry {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-medium text-red-600 hover:text-red-700"
        >
          Remove
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => switchFillMode('manual')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            slot.fillMode === 'manual'
              ? 'bg-primary text-white'
              : 'bg-canvas text-ink-muted-48'
          }`}
        >
          Manual name
        </button>
        <button
          type="button"
          onClick={() => switchFillMode('database')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            slot.fillMode === 'database'
              ? 'bg-primary text-white'
              : 'bg-canvas text-ink-muted-48'
          }`}
        >
          Select from database
        </button>
      </div>

      {slot.fillMode === 'manual' ? (
        <label className="mt-3 block text-sm">
          <span className="text-ink-muted-48">Free-text name (not linked to a database record)</span>
          <input
            value={slot.manualName}
            onChange={(e) => onChange({ ...slot, manualName: e.target.value })}
            placeholder="e.g. Barangay Youth Council"
            className={`mt-1 ${FORM_FIELD_INPUT}`}
          />
        </label>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchDbSource('user')}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                slot.dbSource === 'user'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-canvas text-ink-muted-48'
              }`}
            >
              User
            </button>
            <button
              type="button"
              onClick={() => switchDbSource('external')}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                slot.dbSource === 'external'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-canvas text-ink-muted-48'
              }`}
            >
              External
            </button>
          </div>

          <label className="block text-sm">
            <span className="text-ink-muted-48">
              Search {slot.dbSource === 'user' ? 'registered users' : 'external partners'}
            </span>
            <input
              type="search"
              value={slot.searchQuery}
              onChange={(e) =>
                onChange({
                  ...slot,
                  searchQuery: e.target.value,
                  refId: null,
                  displayLabel: '',
                })
              }
              placeholder={slot.dbSource === 'user' ? 'Name, email, or organization…' : 'Partner name…'}
              className={`mt-1 ${FORM_FIELD_INPUT}`}
            />
          </label>

          {searching && (
            <p className="text-xs text-ink-muted-48">Searching…</p>
          )}

          {!searching && slot.searchQuery.trim().length >= 2 && results.length === 0 && !slot.refId && (
            <p className="text-xs text-ink-muted-48">No matches found.</p>
          )}

          {results.length > 0 && (
            <ul className="max-h-36 overflow-y-auto rounded-lg border border-hairline bg-canvas">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => selectResult(result)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-canvas-parchment"
                  >
                    {slot.dbSource === 'user'
                      ? userLabel(result as SearchUser)
                      : (result as ExternalPartner).name}
                    {slot.dbSource === 'user' && (result as SearchUser).email && (
                      <span className="mt-0.5 block text-xs text-ink-muted-48">
                        {(result as SearchUser).email}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {slot.refId && slot.displayLabel && (
            <p className="text-xs text-primary">
              Selected: {slot.displayLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface PartySlotSectionProps {
  label: string;
  hint?: string;
  addLabel: string;
  slots: PartySlot[];
  onChange: (slots: PartySlot[]) => void;
}

export function PartySlotSection({ label, hint, addLabel, slots, onChange }: PartySlotSectionProps) {
  const addSlot = useCallback(() => {
    onChange([...slots, createEmptyPartySlot()]);
  }, [slots, onChange]);

  const updateSlot = useCallback(
    (key: string, next: PartySlot) => {
      onChange(slots.map((slot) => (slot.key === key ? next : slot)));
    },
    [slots, onChange],
  );

  const removeSlot = useCallback(
    (key: string) => {
      onChange(slots.filter((slot) => slot.key !== key));
    },
    [slots, onChange],
  );

  return (
    <div className="block text-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div>
          <span className="font-medium">{label}</span>
          {hint && <p className="mt-0.5 text-xs text-ink-muted-48">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={addSlot}
          className="shrink-0 rounded-lg border border-hairline px-2.5 py-1 text-xs font-medium text-ink-muted-80 transition hover:border-primary/30 hover:bg-canvas-parchment hover:text-primary"
        >
          + {addLabel}
        </button>
      </div>

      {slots.length > 0 && (
        <div className="mt-3 space-y-3">
          {slots.map((slot, index) => (
            <PartySlotRow
              key={slot.key}
              slot={slot}
              index={index}
              onChange={(next) => updateSlot(slot.key, next)}
              onRemove={() => removeSlot(slot.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
