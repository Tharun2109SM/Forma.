"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  filterAndSortCandidates,
  type CandidateLibrarySort,
} from "@/lib/candidate-search";
import type { AnalysisOption, LibraryCandidate } from "@/lib/data/app-library";

const PAGE_SIZE = 24;

type CandidateLibraryProps = {
  items: LibraryCandidate[];
  analyses: AnalysisOption[];
  totalAvailable: number;
  isSample: boolean;
  initialSearch: string;
  initialAnalysisId: string;
  initialSkill: string;
  initialSort: CandidateLibrarySort;
  initialPage: number;
};

function highlighted(value: string, query: string) {
  const term = query.trim();
  if (!term) return value;
  const index = value.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
  if (index < 0) return value;
  return (
    <Fragment>
      {value.slice(0, index)}
      <mark>{value.slice(index, index + term.length)}</mark>
      {value.slice(index + term.length)}
    </Fragment>
  );
}

export function CandidateLibrary({
  items,
  analyses,
  totalAvailable,
  isSample,
  initialSearch,
  initialAnalysisId,
  initialSkill,
  initialSort,
  initialPage,
}: CandidateLibraryProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialSearch);
  const [analysisId, setAnalysisId] = useState(initialAnalysisId);
  const [skill, setSkill] = useState(initialSkill);
  const [sort, setSort] = useState<CandidateLibrarySort>(initialSort);
  const [page, setPage] = useState(initialPage);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const skills = useMemo(
    () => [...new Set(items.flatMap((item) => item.matchedSkills))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const filtered = useMemo(
    () => filterAndSortCandidates(items, { query, analysisId, skill, sort }),
    [items, query, analysisId, skill, sort],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeFilterCount = Number(Boolean(analysisId)) + Number(Boolean(skill));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const values: Record<string, string> = {
        search: query.trim(),
        analysis: analysisId,
        skill,
        sort: sort === "newest" ? "" : sort,
        page: currentPage > 1 ? String(currentPage) : "",
      };
      Object.entries(values).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      });
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, analysisId, skill, sort, currentPage]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditable = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditable) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        if (query) setQuery("");
        else searchRef.current?.blur();
        setPage(1);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [query]);

  function clearAll() {
    setQuery("");
    setAnalysisId("");
    setSkill("");
    setPage(1);
    searchRef.current?.focus();
  }

  function openCandidate(candidate: LibraryCandidate) {
    router.push(`/app/analyses/${candidate.analysisId}?candidate=${encodeURIComponent(candidate.id)}`);
  }

  const resultLabel = `${filtered.length} ${filtered.length === 1 ? "candidate" : "candidates"}`;

  return (
    <section className="candidate-library" aria-label="Candidate library">
      {isSample && (
        <p className="saas-inline-note" role="note">
          Sample candidates from one illustrative analysis. No cross-analysis identity matching is implied.
        </p>
      )}

      <div className="candidate-toolbar">
        <label className="candidate-search">
          <span className="candidate-visually-hidden">Search candidates</span>
          <Search aria-hidden="true" size={18} strokeWidth={1.8} />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, filename, skill..."
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setPage(1);
                searchRef.current?.focus();
              }}
            >
              <X aria-hidden="true" size={16} />
            </button>
          ) : <kbd aria-label="Press slash to search">/</kbd>}
        </label>

        <button
          className="candidate-filter-toggle"
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="candidate-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden="true" size={16} />
          Filters
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>

        <div
          className={`candidate-secondary-filters${filtersOpen ? " is-open" : ""}`}
          id="candidate-filters"
        >
          <label>
            <span>Analysis</span>
            <select
              value={analysisId}
              onChange={(event) => {
                setAnalysisId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All analyses</option>
              {analyses.map((analysis) => <option key={analysis.id} value={analysis.id}>{analysis.title}</option>)}
            </select>
          </label>
          <label>
            <span>Skill</span>
            <select
              value={skill}
              onChange={(event) => {
                setSkill(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any skill</option>
              {skills.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as CandidateLibrarySort);
                setPage(1);
              }}
            >
              <option value="newest">Newest</option>
              <option value="score">Highest score</option>
            </select>
          </label>
        </div>

        <div className="candidate-result-count" aria-live="polite">
          <span>{resultLabel}</span>
          {totalAvailable > items.length && <small>Loaded {items.length} of {totalAvailable}</small>}
        </div>
      </div>

      {visibleItems.length ? (
        <div className="candidate-table-wrap">
          <table className="saas-table candidate-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Analysis / role</th>
                <th>Rank</th>
                <th>Score</th>
                <th>Matched signals</th>
                <th>Missing</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {visibleItems.map((item) => (
                  <motion.tr
                    layout="position"
                    key={item.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${item.name}`}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a, button")) return;
                      openCandidate(item);
                    }}
                    onKeyDown={(event) => {
                      if ((event.target as HTMLElement).closest("a, button")) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openCandidate(item);
                      }
                    }}
                  >
                    <td>
                      <Link href={`/app/analyses/${item.analysisId}?candidate=${encodeURIComponent(item.id)}`}>
                        {highlighted(item.name, query)}
                      </Link>
                      <small>{highlighted(item.resumeFilename, query)}</small>
                    </td>
                    <td>
                      <div className="candidate-analysis-copy">
                        <Link href={`/app/analyses/${item.analysisId}`}>{item.analysisTitle}</Link>
                        <small>{item.jobTitle ?? item.companyName ?? "Role not specified"}</small>
                      </div>
                    </td>
                    <td><span className="candidate-rank">{item.rank ?? "—"}</span></td>
                    <td><span className="candidate-library-score">{item.finalScore === null ? "Pending" : item.finalScore.toFixed(1)}</span></td>
                    <td className="candidate-signals">
                      {item.matchedSkills.slice(0, 3).map((value, index) => (
                        <Fragment key={value}>{index > 0 && <span aria-hidden="true"> · </span>}{highlighted(value, query)}</Fragment>
                      )) || "—"}
                      {!item.matchedSkills.length && "—"}
                    </td>
                    <td className="candidate-missing">
                      <span>{item.missingSkills.slice(0, 2).join(" · ") || "—"}</span>
                      <ArrowUpRight className="candidate-row-arrow" aria-hidden="true" size={16} />
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="candidate-no-results" role="status">
          <Search aria-hidden="true" size={20} strokeWidth={1.6} />
          <div>
            <strong>
              {!items.length && !query && !analysisId && !skill
                ? "Candidates appear after your first analysis."
                : query
                  ? <>No candidates match “{query.trim()}”.</>
                  : "No candidates match these filters."}
            </strong>
            <span>
              {!items.length && !query && !analysisId && !skill
                ? "Upload a role description and candidate resumes to build this library."
                : "Try another name, filename, skill, or analysis."}
            </span>
          </div>
          {!items.length && !query && !analysisId && !skill
            ? <Link href="/app/analyses/new">New analysis</Link>
            : <button type="button" onClick={clearAll}>Clear search &amp; filters</button>}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <nav className="candidate-pagination" aria-label="Candidate pages">
          <span>Page {currentPage} of {pageCount}</span>
          <div>
            <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft aria-hidden="true" size={15} /> Previous
            </button>
            <button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
              Next <ChevronRight aria-hidden="true" size={15} />
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
