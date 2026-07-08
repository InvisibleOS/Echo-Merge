"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Paperclip } from "lucide-react";
import clsx from "clsx";
import EvidencePhoto from "./EvidencePhoto";

/**
 * A single, consistent "View attachment" control shown on a complaint anywhere it
 * appears (citizen tracker, MP drill-down, delegation queue, map list) and at any
 * stage. It opens a lightbox with ALL images attached to that complaint. The
 * image bytes are only fetched when the lightbox is opened, so lists stay light.
 *
 * Images only, for now.
 */

export interface AttachmentSource {
  submissionId?: string;
  base64?: string | null;
}

interface Props {
  images: AttachmentSource[];
  /** Extra classes for the trigger button. */
  className?: string;
}

export default function EvidenceAttachments({ images, className }: Props) {
  const [open, setOpen] = useState(false);
  const count = images?.length ?? 0;
  if (count === 0) return null;

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-3 border-b border-surface-150">
                <h3 className="font-display font-bold text-base text-surface-900">
                  Attached photo{count > 1 ? `s (${count})` : ""}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                {images.map((img, i) => (
                  <EvidencePhoto
                    key={img.submissionId || `b64-${i}`}
                    submissionId={img.submissionId}
                    base64={img.base64 || undefined}
                    alt={`Attached photo ${i + 1}`}
                    className="w-full h-auto rounded-xl border border-surface-200 object-contain"
                  />
                ))}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        title="View attached image(s)"
        className={clsx(
          "inline-flex items-center gap-1.5 text-xs font-semibold text-civic-700 bg-civic-50 hover:bg-civic-100 border border-civic-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs",
          className
        )}
      >
        <Paperclip size={13} />
        View attachment{count > 1 ? `s (${count})` : ""}
      </button>
      {modal}
    </>
  );
}
