import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Every /admin/* sub-page replaces AdminPanel's own content via Outlet (see
// admin.tsx), so without this there's no way back to the admin index short
// of the browser back button or the sidebar link.
export function AdminBackLink() {
  const { t } = useI18n();
  return (
    <Link
      to="/admin"
      className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-500 shadow-soft transition-colors hover:border-amber-400/60 hover:bg-amber-400/20"
    >
      <ArrowLeft className="h-4 w-4" /> {t("admin.backToPanel")}
    </Link>
  );
}
