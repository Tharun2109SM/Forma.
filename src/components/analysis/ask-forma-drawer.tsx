"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUp,
  ChevronDown,
  FileText,
  LoaderCircle,
  MessageSquareText,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import "./ask-forma-workspace.css";

const STARTER_PROMPTS = [
  "Why is the top candidate ranked first?",
  "Who has the strongest backend experience?",
  "Which candidates match React but are missing PostgreSQL?",
  "Compare the top three candidates.",
] as const;

type ChatSource = {
  sourceId: string;
  candidateName: string | null;
  filename: string;
  documentType: "JOB_DESCRIPTION" | "RESUME";
  pageNumber: number | null;
  section: string | null;
  excerpt: string;
  similarity: number;
};

type ChatMessage =
  | { id: string; role: "recruiter"; content: string }
  | { id: string; role: "assistant"; content: string; sources: ChatSource[] };

type ErrorPayload = { error?: string; code?: string };

function userFacingError(status: number, payload: ErrorPayload) {
  if (status === 401) return "Your session has expired. Sign in again to ask Forma.";
  if (status === 404) return "This analysis is no longer available.";
  if (status === 429) return "Forma. is receiving too many questions. Wait a moment and try again.";
  if (payload.code === "ANALYSIS_NOT_READY") {
    return "Forma. is still indexing these documents.";
  }
  if (payload.code === "NO_INDEXED_CHUNKS") {
    return "No indexed document evidence is available for this analysis yet.";
  }
  if (payload.code === "NO_RELEVANT_EVIDENCE") {
    return "Forma. could not find enough relevant evidence for that question. Try being more specific.";
  }
  return payload.error ?? "Forma. could not answer that question right now.";
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>
      : part,
  );
}

function AssistantContent({ content }: { content: string }) {
  const blocks = content.trim().split(/\n{2,}/);

  return (
    <div className="ask-forma-response-copy">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter(Boolean);
        const isBulletList = lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));
        const isNumberedList =
          lines.length > 0 && lines.every((line) => /^\d+[.)]\s+/.test(line));

        if (isBulletList) {
          return (
            <ul key={`${index}-${block.slice(0, 20)}`}>
              {lines.map((line) => (
                <li key={line}>{renderInline(line.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (isNumberedList) {
          return (
            <ol key={`${index}-${block.slice(0, 20)}`}>
              {lines.map((line) => (
                <li key={line}>{renderInline(line.replace(/^\d+[.)]\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        return <p key={`${index}-${block.slice(0, 20)}`}>{renderInline(block)}</p>;
      })}
    </div>
  );
}

function SourceCards({ sources }: { sources: ChatSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="ask-forma-sources">
      <span>{sources.length} {sources.length === 1 ? "SOURCE" : "SOURCES"}</span>
      {sources.map((source) => (
        <details key={source.sourceId}>
          <summary>
            <span className="ask-source-id">{source.sourceId}</span>
            <span>
              <strong>{source.candidateName ?? "Job description"}</strong>
              <small>
                {source.filename}
                {source.pageNumber ? ` · Page ${source.pageNumber}` : ""}
              </small>
            </span>
            <ChevronDown aria-hidden="true" size={14} />
          </summary>
          <div className="ask-source-body">
            <div>
              <span>{source.documentType === "RESUME" ? "RESUME" : "JOB DESCRIPTION"}</span>
              {source.section ? <span>{source.section}</span> : null}
              {Number.isFinite(source.similarity) ? (
                <span>{Math.round(source.similarity * 100)}% relevance</span>
              ) : null}
            </div>
            <p><FileText aria-hidden="true" size={13} /> “{source.excerpt}”</p>
          </div>
        </details>
      ))}
    </div>
  );
}

function useAskFormaSession(analysisId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || submitting) return;

    const recruiterMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "recruiter",
      content: trimmed,
    };
    setMessages((current) => [...current, recruiterMessage]);
    setDraft("");
    setError(null);
    setSubmitting(true);

    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch(`/api/analysis/${analysisId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as ErrorPayload & {
        answer?: string;
        sources?: ChatSource[];
      };
      if (!response.ok || !payload.answer) {
        throw new Error(userFacingError(response.status, payload));
      }
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.answer!,
          sources: payload.sources ?? [],
        },
      ]);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Forma. could not answer right now.");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setSubmitting(false);
    }
  }

  return { messages, draft, setDraft, submitting, error, submitQuestion };
}

type AskFormaSession = ReturnType<typeof useAskFormaSession>;

function AskFormaContent({
  session,
  variant,
  visible,
  onClose,
}: {
  session: AskFormaSession;
  variant: "drawer" | "embedded";
  visible: boolean;
  onClose?: () => void;
}) {
  const { messages, draft, setDraft, submitting, error, submitQuestion } = session;
  const endRef = useRef<HTMLDivElement>(null);
  const questionId = useId();

  useEffect(() => {
    if (!visible || messages.length === 0) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "end" });
  }, [messages, visible, submitting]);

  return (
    <section className={`ask-forma-workspace ask-forma-workspace-${variant}`} aria-label="Ask Forma analysis intelligence">
      <header className="ask-forma-header">
        <div>
          <span className="page-kicker">ANALYSIS-WIDE INTELLIGENCE</span>
          <h2>Ask Forma.</h2>
          <p>Ask questions across this JD and all candidate documents.</p>
        </div>
        {onClose && (
          <button aria-label="Close Ask Forma" onClick={onClose} type="button"><X size={18} /></button>
        )}
      </header>

      <div className="ask-forma-conversation" aria-live="polite">
        {messages.length === 0 ? (
          <section className="ask-forma-empty">
            <span><MessageSquareText aria-hidden="true" size={18} /></span>
            <h2>Ask about this shortlist</h2>
            <p>Answers stay grounded in uploaded evidence and stored deterministic scores.</p>
            <div>
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  disabled={submitting}
                  key={prompt}
                  onClick={() => void submitQuestion(prompt)}
                  type="button"
                >
                  {prompt}<ArrowUp aria-hidden="true" size={13} />
                </button>
              ))}
            </div>
          </section>
        ) : (
          <ol className="ask-forma-messages">
            {messages.map((message) => (
              <li className={`ask-message ask-message-${message.role}`} key={message.id}>
                <span>{message.role === "recruiter" ? "YOU" : "FORMA."}</span>
                {message.role === "assistant" ? (
                  <>
                    <AssistantContent content={message.content} />
                    <SourceCards sources={message.sources} />
                  </>
                ) : <p>{message.content}</p>}
              </li>
            ))}
          </ol>
        )}
        {submitting ? (
          <div className="ask-forma-loading" role="status">
            <LoaderCircle className="spin" aria-hidden="true" size={15} />
            Retrieving evidence from this analysis…
          </div>
        ) : null}
        {error ? <p className="ask-forma-error" role="alert">{error}</p> : null}
        <div ref={endRef} />
      </div>

      <form
        className="ask-forma-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submitQuestion(draft);
        }}
      >
        <label htmlFor={questionId}>Ask about candidates, skills, evidence, or ranking</label>
        <div>
          <textarea
            disabled={submitting}
            id={questionId}
            maxLength={1_000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitQuestion(draft);
              }
            }}
            placeholder="Why is the first candidate ranked above the second?"
            rows={3}
            value={draft}
          />
          <button
            aria-label="Send question"
            disabled={submitting || draft.trim().length < 3}
            type="submit"
          >
            {submitting ? <LoaderCircle className="spin" size={16} /> : <ArrowUp size={16} />}
          </button>
        </div>
        <small>Enter to send · Shift + Enter for a new line</small>
      </form>
    </section>
  );
}

export function AskFormaWorkspace({ analysisId }: { analysisId: string }) {
  const session = useAskFormaSession(analysisId);
  return <AskFormaContent session={session} variant="embedded" visible />;
}

export function AskFormaDrawer({
  analysisId,
  open,
  onOpenChange,
  returnFocusRef,
}: {
  analysisId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const session = useAskFormaSession(analysisId);

  return (
    <Dialog.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          className="ask-forma-drawer"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
        >
          <Dialog.Title className="visually-hidden">Ask Forma.</Dialog.Title>
          <Dialog.Description className="visually-hidden">
            Ask questions across this JD and all candidate documents.
          </Dialog.Description>
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="ask-forma-motion-shell"
            initial={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <AskFormaContent
              onClose={() => onOpenChange(false)}
              session={session}
              variant="drawer"
              visible={open}
            />
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
