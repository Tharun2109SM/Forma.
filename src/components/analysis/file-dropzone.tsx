"use client";

import { FileText, Plus, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import {
  DOCUMENT_ACCEPT,
  isSupportedDocument,
  MAX_DOCUMENT_SIZE,
  supportedFormatLabel,
} from "@/lib/documents/formats";

export type QueuedDocumentStatus =
  | "QUEUED"
  | "UPLOADING"
  | "UPLOADED"
  | "PROCESSING"
  | "READY"
  | "FAILED";

export type QueuedDocument = {
  id: string;
  file: File;
  status: QueuedDocumentStatus;
  error?: string;
  documentId?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropzone({
  description,
  files,
  id,
  label,
  multiple,
  maxFiles = 100,
  disabled = false,
  selectionLocked = false,
  onChange,
  onRetry,
}: {
  description: string;
  files: QueuedDocument[];
  id: string;
  label: string;
  multiple: boolean;
  maxFiles?: number;
  disabled?: boolean;
  selectionLocked?: boolean;
  onChange: (files: QueuedDocument[]) => void;
  onRetry?: (file: QueuedDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(incoming: FileList | File[]) {
    if (disabled || selectionLocked) return;
    const candidates = Array.from(incoming);
    const invalid = candidates.filter((file) => !isSupportedDocument(file));
    const tooLarge = candidates.filter(
      (file) => isSupportedDocument(file) && file.size > MAX_DOCUMENT_SIZE,
    );
    const valid = candidates.filter(
      (file) => isSupportedDocument(file) && file.size <= MAX_DOCUMENT_SIZE,
    );
    const messages = [
      ...invalid.map((file) => `${file.name} is not a supported document.`),
      ...tooLarge.map((file) => `${file.name} is larger than 15 MB.`),
    ];
    setError(messages.length ? messages.join(" ") : null);
    const queued = valid.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "QUEUED" as const,
    }));
    if (!multiple) {
      if (queued[0]) onChange(queued.slice(0, 1));
      return;
    }
    const available = Math.max(0, maxFiles - files.length);
    if (queued.length > available) {
      setError(`This analysis supports up to ${maxFiles} resumes.`);
    }
    onChange([...files, ...queued.slice(0, available)]);
  }

  return (
    <section className="upload-group" aria-labelledby={`${id}-label`}>
      <div className="upload-group-heading">
        <div>
          <span className="upload-index">{multiple ? "02" : "01"}</span>
          <h2 id={`${id}-label`}>{label}</h2>
          <p>{description}</p>
        </div>
        <span className="file-count">
          {files.length} {files.length === 1 ? "FILE" : "FILES"}
        </span>
      </div>

      <div
        className={`dropzone ${dragging ? "is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <input
          accept={DOCUMENT_ACCEPT}
          aria-describedby={`${id}-hint`}
          className="visually-hidden"
          id={id}
          disabled={disabled || selectionLocked}
          multiple={multiple}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        <button
          disabled={disabled || selectionLocked}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <UploadCloud aria-hidden="true" size={22} strokeWidth={1.5} />
          <strong>{dragging ? "Drop documents here" : "Drop documents here or browse"}</strong>
          <span id={`${id}-hint`}>
            {supportedFormatLabel()} · Up to 15 MB {multiple ? "each" : ""}
          </span>
        </button>
      </div>

      <div aria-live="polite">
        {error && <p className="upload-error">{error}</p>}
      </div>

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((queued, index) => (
            <li key={queued.id}>
              <span className="file-icon" aria-hidden="true">
                <FileText size={16} strokeWidth={1.7} />
              </span>
              <span className="file-name">
                <strong>{queued.file.name}</strong>
                <small>
                  {multiple ? `CANDIDATE ${String(index + 1).padStart(2, "0")} · ` : ""}
                  {formatBytes(queued.file.size)}
                  {queued.error ? ` · ${queued.error}` : ""}
                </small>
              </span>
              <span className={`file-type file-status-${queued.status.toLowerCase()}`}>
                {queued.status}
              </span>
              {queued.status === "FAILED" && onRetry ? (
                <button
                  aria-label={`Retry ${queued.file.name}`}
                  disabled={disabled}
                  onClick={() => onRetry(queued)}
                  type="button"
                >
                  <RotateCcw size={15} strokeWidth={1.7} />
                </button>
              ) : (
                <button
                  aria-label={`Remove ${queued.file.name}`}
                  disabled={
                    disabled || selectionLocked || queued.status === "UPLOADING"
                  }
                  onClick={() => onChange(files.filter((item) => item.id !== queued.id))}
                  type="button"
                >
                  <Trash2 size={15} strokeWidth={1.7} />
                </button>
              )}
            </li>
          ))}
          {multiple && (
            <li className="add-more-row">
              <button
                disabled={disabled || selectionLocked}
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                <Plus size={15} /> Add more resumes
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
