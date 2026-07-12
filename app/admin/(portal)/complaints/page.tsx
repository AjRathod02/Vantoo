"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toast";

interface Ticket {
  id: string;
  ticket_number: string;
  user_id?: string;
  user_name: string;
  user_type: string;
  user_email?: string;
  category: string;
  priority: string;
  subject: string;
  description?: string;
  status: string;
  assigned_to?: string;
  resolution?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
}

interface Reply {
  id: string;
  author_type: string;
  author_name: string;
  body: string;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

function AdminComplaintsContent() {
  const searchParams = useSearchParams();
  const userFilter = searchParams.get("user") ?? "";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [userType, setUserType] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    fetch(`/api/admin/complaints?${params}`)
      .then((r) => r.json())
      .then((d) => {
        let list: Ticket[] = d.tickets ?? [];
        if (userType) list = list.filter((t) => t.user_type === userType);
        if (userFilter) list = list.filter((t) => t.user_id === userFilter);
        if (search) {
          const q = search.toLowerCase();
          list = list.filter(
            (t) =>
              t.subject.toLowerCase().includes(q) ||
              t.ticket_number.toLowerCase().includes(q) ||
              t.user_name.toLowerCase().includes(q)
          );
        }
        setTickets(list);
      })
      .finally(() => setLoading(false));
  }, [status, priority, userType, userFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const updateTicket = async (ticketId: string, patch: Record<string, unknown>) => {
    const res = await fetch("/api/admin/complaints", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, ...patch }),
    });
    if (res.ok) {
      toast.success("Ticket updated");
      load();
      if (selected?.id === ticketId) {
        setSelected((s) => (s ? { ...s, ...patch } as Ticket : s));
      }
    } else {
      toast.error("Update failed");
    }
  };

  const openTicket = async (ticket: Ticket) => {
    setSelected(ticket);
    setResolution(ticket.resolution ?? "");
    setNote("");
    const res = await fetch(`/api/admin/complaints?ticketId=${ticket.id}&replies=1`);
    const d = await res.json();
    setReplies(d.replies ?? []);
  };

  const addNote = async () => {
    if (!selected || !note.trim()) return;
    const res = await fetch("/api/admin/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reply",
        ticketId: selected.id,
        body: note,
        internal: true,
      }),
    });
    if (res.ok) {
      toast.success("Internal note added");
      setNote("");
      openTicket(selected);
    } else {
      // Fallback: store as resolution note field
      await updateTicket(selected.id, {
        resolution: `${selected.resolution ?? ""}\n[Internal] ${note}`.trim(),
      });
      setNote("");
    }
  };

  return (
    <AdminPageShell
      title="Support Center"
      subtitle="Customer, vendor, and rider tickets · assign, prioritize, resolve"
    >
      <div className="space-y-4">
        <AdminFilterBar
          search={search}
          onSearchChange={setSearch}
          onSearchSubmit={load}
          placeholder="Search ticket #, subject, user…"
          filters={[
            {
              key: "status",
              label: "Status",
              value: status,
              onChange: setStatus,
              options: [
                { value: "", label: "All" },
                { value: "open", label: "Open" },
                { value: "assigned", label: "Assigned" },
                { value: "in_progress", label: "In progress" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
                { value: "escalated", label: "Escalated" },
              ],
            },
            {
              key: "priority",
              label: "Priority",
              value: priority,
              onChange: setPriority,
              options: [
                { value: "", label: "All" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ],
            },
            {
              key: "userType",
              label: "From",
              value: userType,
              onChange: setUserType,
              options: [
                { value: "", label: "All" },
                { value: "customer", label: "Customers" },
                { value: "vendor", label: "Vendors" },
                { value: "rider", label: "Riders" },
              ],
            },
          ]}
        />

        {loading ? (
          <AdminTableSkeleton rows={5} cols={4} />
        ) : tickets.length === 0 ? (
          <p className="text-ink-muted">No support tickets.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicket(t)}
                  className={`min-h-11 w-full rounded-2xl border p-4 text-left shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary sm:p-5 ${
                    selected?.id === t.id
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-gray-100 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs text-ink-soft">{t.ticket_number}</span>
                      <h3 className="font-semibold text-ink">{t.subject}</h3>
                      <p className="text-sm text-ink-muted">
                        {t.user_name} · {t.user_type} · {t.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[t.priority] ?? ""}`}
                      >
                        {t.priority}
                      </span>
                      <AdminStatusBadge status={t.status} />
                    </div>
                  </div>
                  <p className="text-xs text-ink-soft">
                    {new Date(t.created_at).toLocaleString("en-IN")}
                  </p>
                </button>
              ))}
            </div>

            {selected && (
              <div className="h-fit space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5 xl:sticky xl:top-4">
                <div>
                  <p className="font-mono text-xs text-ink-soft">{selected.ticket_number}</p>
                  <h2 className="text-lg font-bold text-ink">{selected.subject}</h2>
                  <p className="mt-2 text-sm text-ink-muted whitespace-pre-wrap">
                    {selected.description || "No description"}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-ink-soft">Priority</p>
                    <select
                      value={selected.priority}
                      onChange={(e) =>
                        updateTicket(selected.id, { priority: e.target.value })
                      }
                      className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3"
                    >
                      {["low", "medium", "high", "critical"].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-ink-soft">Status</p>
                    <select
                      value={selected.status}
                      onChange={(e) =>
                        updateTicket(selected.id, { status: e.target.value })
                      }
                      className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3"
                    >
                      {[
                        "open",
                        "assigned",
                        "in_progress",
                        "resolved",
                        "closed",
                        "escalated",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-ink-soft">Resolution</p>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm"
                    placeholder="Resolution notes…"
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      updateTicket(selected.id, {
                        resolution,
                        status: "resolved",
                      })
                    }
                  >
                    Save & resolve
                  </Button>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">Timeline / notes</p>
                  <ul className="mb-3 max-h-40 space-y-2 overflow-y-auto">
                    {replies.length === 0 ? (
                      <li className="text-xs text-ink-muted">No replies yet</li>
                    ) : (
                      replies.map((r) => (
                        <li key={r.id} className="rounded-lg bg-gray-50 p-2 text-xs">
                          <span className="font-medium">{r.author_name}</span> ·{" "}
                          {new Date(r.created_at).toLocaleString("en-IN")}
                          <p className="mt-1 text-ink-muted">{r.body}</p>
                        </li>
                      ))
                    )}
                  </ul>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm"
                    placeholder="Add internal note…"
                  />
                  <Button size="sm" variant="outline" className="mt-2" onClick={addNote}>
                    Add note
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}

export default function AdminComplaintsPage() {
  return (
    <Suspense
      fallback={
        <AdminPageShell title="Support Center" subtitle="Loading…">
          <AdminTableSkeleton rows={5} cols={4} />
        </AdminPageShell>
      }
    >
      <AdminComplaintsContent />
    </Suspense>
  );
}
