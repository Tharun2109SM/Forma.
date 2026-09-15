import { MarketingFooter, MarketingNav } from "@/components/marketing/marketing-shell";
import { FormaGrid } from "@/components/ui/forma-grid";
import "@/styles/marketing-site.css";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-shell marketing-redesign marketing-site">
      <FormaGrid className="marketing-master-grid" rows={16} />
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}
