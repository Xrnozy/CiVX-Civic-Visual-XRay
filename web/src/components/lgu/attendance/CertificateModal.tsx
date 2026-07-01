import { useEffect, useRef } from 'react';
import type { ServiceCertificate } from '../../../types/attendance';
import { ButtonPrimary, ButtonSecondaryPill } from '../../ui/Buttons';

interface Props {
  certificate: ServiceCertificate | null;
  onClose: () => void;
}

export function CertificateModal({ certificate, onClose }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (certificate && frameRef.current) {
      const doc = frameRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(certificate.html);
        doc.close();
      }
    }
  }, [certificate]);

  if (!certificate) return null;

  const printCert = () => {
    frameRef.current?.contentWindow?.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-canvas shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="text-lg font-semibold">Service hour certificate</h2>
          <button type="button" className="text-sm text-ink-muted-48" onClick={onClose}>Close</button>
        </div>
        <iframe ref={frameRef} title="Certificate" className="min-h-[360px] flex-1 border-0 bg-white" />
        <div className="flex justify-end gap-2 border-t border-black/10 px-6 py-4">
          <ButtonSecondaryPill onClick={onClose}>Done</ButtonSecondaryPill>
          <ButtonPrimary onClick={printCert}>Print</ButtonPrimary>
        </div>
      </div>
    </div>
  );
}
