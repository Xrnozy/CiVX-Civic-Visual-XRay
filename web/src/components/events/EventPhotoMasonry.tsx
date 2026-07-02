import { useRef, useState } from 'react';
import { ButtonPrimary } from '../ui/Buttons';
import { api } from '../../lib/api';
import { isLguPortalRole } from '../../lib/auth';
import { useProfile } from '../../hooks/useProfile';
import type { EventPhoto } from '../../types/eventDetail';

interface Props {
  eventId: string;
  photos: EventPhoto[];
  canUpload: boolean;
  canModerate: boolean;
  canUnhide: boolean;
  approvalStatus?: string;
  onPhotosChange: (photos: EventPhoto[]) => void;
}

const TILE_HEIGHTS = ['h-44', 'h-56', 'h-72', 'h-48', 'h-64'];

export function EventPhotoMasonry({
  eventId,
  photos,
  canUpload,
  canModerate,
  canUnhide,
  approvalStatus,
  onPhotosChange,
}: Props) {
  const { profile } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  async function handleUpload(file: File) {
    if (isLguPortalRole(profile?.role)) {
      setUploadError('LGU accounts cannot upload event photos.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const photo = await api<EventPhoto>(`/api/cleanup-events/${eventId}/photos`, {
        method: 'POST',
        body: form,
      });
      onPhotosChange([photo, ...photos]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function setPhotoHidden(photoId: string, hidden: boolean) {
    setActionId(photoId);
    setActionError('');
    try {
      const updated = hidden
        ? await api<EventPhoto>(`/api/cleanup-events/${eventId}/photos/${photoId}`, {
            method: 'PATCH',
            body: JSON.stringify({ hidden: true }),
          })
        : await api<EventPhoto>(`/api/cleanup-events/${eventId}/photos/${photoId}?hidden=false`, {
            method: 'PATCH',
            body: JSON.stringify({ hidden: false }),
          });
      onPhotosChange(
        canModerate
          ? photos.map((photo) => (photo.id === photoId ? updated : photo))
          : photos.filter((photo) => photo.id !== photoId),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update photo');
    } finally {
      setActionId(null);
    }
  }

  async function deletePhoto(photoId: string) {
    if (!window.confirm('Permanently delete this photo?')) return;
    setActionId(photoId);
    setActionError('');
    try {
      await api(`/api/cleanup-events/${eventId}/photos/${photoId}`, { method: 'DELETE' });
      onPhotosChange(photos.filter((photo) => photo.id !== photoId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete photo');
    } finally {
      setActionId(null);
    }
  }

  const visiblePhotos = canModerate ? photos : photos.filter((photo) => !photo.hidden);
  const isApproved = approvalStatus === 'approved';
  const uploadAllowed = canUpload && isApproved && !isLguPortalRole(profile?.role);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Event photos</h2>
          <p className="mt-1 text-sm text-ink-muted-48">
            {isLguPortalRole(profile?.role)
              ? 'LGU accounts can review and moderate photos but cannot upload to the gallery.'
              : isApproved
                ? 'Share moments from the cleanup drive after check-in, or as the event organizer.'
                : 'Photos unlock after the cleanup drive is approved.'}
          </p>
        </div>
        {uploadAllowed ? (
          <div className="flex flex-col items-end gap-1">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
                event.target.value = '';
              }}
            />
            <ButtonPrimary
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? 'Uploading…' : 'Upload photo'}
            </ButtonPrimary>
          </div>
        ) : null}
      </div>

      {uploadError ? <p className="mt-2 text-sm text-red-600">{uploadError}</p> : null}
      {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}

      {visiblePhotos.length === 0 ? (
        <div className="mt-4 rounded-[16px] border border-dashed border-hairline bg-canvas-parchment px-4 py-12 text-center text-sm text-ink-muted-48">
          {isApproved
            ? 'No photos yet. Checked-in volunteers and the organizer can upload here.'
            : 'No photos yet. Uploading is available after LGU approval.'}
        </div>
      ) : (
        <div className="mt-4 columns-2 gap-3 md:columns-3">
          {visiblePhotos.map((photo, index) => (
            <figure
              key={photo.id}
              className={`group relative mb-3 break-inside-avoid overflow-hidden rounded-[16px] border border-hairline bg-canvas-parchment ${TILE_HEIGHTS[index % TILE_HEIGHTS.length]}`}
            >
              <img
                src={photo.image_url}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                loading="lazy"
              />
              {photo.hidden && canModerate ? (
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Hidden
                </span>
              ) : null}
              {canModerate ? (
                <>
                  <div className="event-photo-vignette" aria-hidden />
                  <div className="event-photo-actions">
                    {!photo.hidden ? (
                      <button
                        type="button"
                        className="event-photo-action-btn event-photo-action-hide"
                        disabled={actionId === photo.id}
                        onClick={() => void setPhotoHidden(photo.id, true)}
                      >
                        Hide
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="event-photo-action-btn event-photo-action-hide"
                        disabled={actionId === photo.id}
                        onClick={() => void setPhotoHidden(photo.id, false)}
                      >
                        Unhide
                      </button>
                    )}
                    <button
                      type="button"
                      className="event-photo-action-btn event-photo-action-delete"
                      disabled={actionId === photo.id}
                      onClick={() => void deletePhoto(photo.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : null}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
