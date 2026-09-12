"use client";

import { FileText, Plus, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

const MAX_PDF_SIZE = 15 * 1024 * 1024;

export type QueuedPdfStatus =
  | "QUEUED"
  | "UPLOADING"
  | "UPLOADED"
  | "PROCESSING"
  | "READY"
  | "FAILED";

export type QueuedPdf = {
  id: string;
  file: File;
  status: QueuedPdfStatus;
  error?: string;
  documentId?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdfablePdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function FileDropzone({
  description,
  files,
  id,
  label,
  multiple,
  maxFiles = 100,
  disabled = false,
  onChange,
}: {
  description: string;
  files: QueuedPdf[];
  id: string;
  label: string;
  multiple: boolean;
  maxFiles?: number;
  disabled?: boolean;
  onChange: (files: QueuedPdf[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(incoming: FileList | File[]) {
    const candidates = Array.from(incoming);
    const invalid = candidates.filter((file) => !isPdfablePdf(file));
    const tooLarge = candidates.filter(
      (file) => isPdfablePdf(file) && file.size > MAX_PDF_SIZE,
    );
    const valid = candidates.filter(
      (file) => isPdfablePdf(file) && file.size <= MAX_PDF_SIZE,
    );
    const messages = [
      ...invalid.map((file) => `${file.name} is not a PDF.`),
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
          accept="application/pdf,.pdf"
          aria-describedby={`${id}-hint`}
          className="visually-hidden"
          id={id}
          disabled={disabled}
          multiple={multiple}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        <button disabled={disabled} onClick={() => inputRef.current?.click()} type="button">
          <UploadCloud aria-hidden="true" size={22} strokeWidth={1.5} />
          <strong>{dragging ? "Drop PDFs here" : "Drop PDFs here or browse"}</strong>
          <span id={`${id}-hint`}>
            PDF only · Up to 15 MB {multiple ? "each" : ""}
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
              <button
                aria-label={`Remove ${queued.file.name}`}
                disabled={disabled || queued.status === "UPLOADING"}
                onClick={() => onChange(files.filter((item) => item.id !== queued.id))}
                type="button"
              >
                <Trash2 size={15} strokeWidth={1.7} />
              </button>
            </li>
          ))}
          {multiple && (
            <li className="add-more-row">
              <button disabled={disabled} onClick={() => inputRef.current?.click()} type="button">
                <Plus size={15} /> Add more resumes
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
