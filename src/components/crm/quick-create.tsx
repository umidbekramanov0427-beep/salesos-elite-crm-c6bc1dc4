import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  useCompaniesRaw,
  useLeadsRaw,
  usePipelineStagesRaw,
  useProfilesRaw,
} from "@/hooks/use-crm-data";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRIORITIES = ["Urgent", "High", "Normal", "Low"] as const;

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}

export function NewLeadDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [revenue, setRevenue] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("Normal");
  const [funnel, setFunnel] = useState("Direct Sales");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: stages } = usePipelineStagesRaw();
  const { data: existingLeads } = useLeadsRaw();
  const funnelOptions = useMemo(() => {
    const set = new Set<string>(["Direct Sales"]);
    for (const l of existingLeads ?? []) if (l.funnel) set.add(l.funnel);
    return Array.from(set);
  }, [existingLeads]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      let contactId: string | null = null;
      if (email.trim() || phone.trim()) {
        const { data: contact, error: contactErr } = await supabase
          .from("contacts")
          .insert({
            full_name: name.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            owner_id: user?.id ?? null,
          })
          .select()
          .single();
        if (contactErr) throw contactErr;
        contactId = contact.id;
      }
      const newStage = stages?.find((s) => s.key === "new");
      const { error: leadErr } = await supabase.from("leads").insert({
        name: name.trim(),
        company_name: company.trim(),
        contact_id: contactId,
        owner_id: user?.id ?? null,
        priority,
        expected_revenue: revenue ? Number(revenue) : 0,
        stage_id: newStage?.id ?? null,
        funnel: funnel.trim() || "Direct Sales",
      });
      if (leadErr) throw leadErr;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["leads"] }),
        qc.invalidateQueries({ queryKey: ["contacts"] }),
      ]);
      toast.success("Lead created");
      setOpen(false);
      setName("");
      setCompany("");
      setEmail("");
      setPhone("");
      setRevenue("");
      setPriority("Normal");
      setFunnel("Direct Sales");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create lead");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sanzhar Abenov"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Kazpost Digital"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Expected revenue ($)</Label>
              <Input
                type="number"
                min={0}
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as (typeof PRIORITIES)[number])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Funnel</Label>
            <Input
              value={funnel}
              onChange={(e) => setFunnel(e.target.value)}
              placeholder="Direct Sales"
              list="funnel-options"
            />
            <datalist id="funnel-options">
              {funnelOptions.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <DialogFooter>
            <SubmitButton busy={busy} label="Create lead" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewCompanyDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("companies").insert({
        name: name.trim(),
        industry: industry.trim() || null,
        website: website.trim() || null,
        city: city.trim() || null,
        owner_id: user?.id ?? null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company created");
      setOpen(false);
      setName("");
      setIndustry("");
      setWebsite("");
      setCity("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Company name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="example.com"
            />
          </div>
          <DialogFooter>
            <SubmitButton busy={busy} label="Create company" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewContactDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: companies } = useCompaniesRaw();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("contacts").insert({
        full_name: name.trim(),
        company_id: companyId || null,
        position: position.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        owner_id: user?.id ?? null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact created");
      setOpen(false);
      setName("");
      setCompanyId("");
      setPosition("");
      setEmail("");
      setPhone("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create contact");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Position</Label>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <SubmitButton busy={busy} label="Create contact" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewTaskDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("Normal");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profiles } = useProfilesRaw();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        title: title.trim(),
        assignee_id: assigneeId || user?.id || null,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created");
      setOpen(false);
      setTitle("");
      setAssigneeId("");
      setPriority("Normal");
      setDueDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Me" />
                </SelectTrigger>
                <SelectContent>
                  {(profiles ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as (typeof PRIORITIES)[number])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <SubmitButton busy={busy} label="Create task" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewDealDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: companies } = useCompaniesRaw();
  const { data: stages } = usePipelineStagesRaw();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const stage = stages?.find((s) => s.id === stageId) ?? stages?.find((s) => s.key === "new");
      const { error } = await supabase.from("deals").insert({
        name: name.trim(),
        company_id: companyId || null,
        value: value ? Number(value) : 0,
        stage_id: stage?.id ?? null,
        probability: stage?.probability ?? 10,
        owner_id: user?.id ?? null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal created");
      setOpen(false);
      setName("");
      setCompanyId("");
      setValue("");
      setStageId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create deal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Deal name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {(companies ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Value ($)</Label>
              <Input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="New Lead" />
                </SelectTrigger>
                <SelectContent>
                  {(stages ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <SubmitButton busy={busy} label="Create deal" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
