import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="public-not-found">
      <Link className="wordmark" href="/" aria-label="Forma home">
        Forma<span>.</span>
      </Link>
      <section>
        <span className="page-kicker">ERROR / 404</span>
        <h1>There’s no signal here.</h1>
        <p>The page you requested does not exist or is no longer available.</p>
        <Link className="primary-action" href="/">
          <ArrowLeft size={15} /> Return home
        </Link>
      </section>
    </main>
  );
}
