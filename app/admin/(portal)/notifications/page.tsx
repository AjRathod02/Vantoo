"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toast";

type Log = {
  id: string;
  channel: string;
  target_type: string;
  title: string;
  body: string;
  recipient_count: number;
  created_at: string;
};

const CHANNELS = [
  { id: "push", label: "Push" },
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "in_app", label: "In-App" },
];

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<string[]>(["push", "in_app"]);
  const [targetType, setTargetType] = useState("all");
  const [selectedUserIds, setSelectedUserIds] = useState("");
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const loadLogs = () => {
    setLoadingLogs(true);
    fetch("/api/admin/notifications")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .finally(() => setLoadingLogs(false));
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const toggleChannel = (id: string) => {
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channels.length) {
      toast.error("Select at least one channel");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          channels,
          targetType,
          selectedUserIds:
            targetType === "selected"
              ? selectedUserIds
                  .split(/[\s,]+/)
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send");
        return;
      }
      toast.success(data.message ?? "Notification sent");
      setTitle("");
      setBody("");
      loadLogs();
    } catch {
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminPageShell
      title="Notification Center"
      subtitle="Push, email, SMS, and in-app messages to customers, vendors, riders, or selected users"
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <form
          onSubmit={send}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-6"
        >
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Channels</p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleChannel(c.id)}
                  className={`min-h-11 rounded-xl px-3.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    channels.includes(c.id)
                      ? "bg-brand-primary text-white"
                      : "border border-gray-200 text-ink-muted"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Audience</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-300 px-4 text-sm"
            >
              <option value="all">All Users</option>
              <option value="customers">Customers</option>
              <option value="vendors">Vendors</option>
              <option value="riders">Riders</option>
              <option value="selected">Selected Users</option>
            </select>
          </div>

          {targetType === "selected" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                User IDs (comma-separated)
              </label>
              <textarea
                value={selectedUserIds}
                onChange={(e) => setSelectedUserIds(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                placeholder="uuid-1, uuid-2…"
              />
            </div>
          )}

          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
              required
            />
          </div>
          <Button type="submit" disabled={sending} className="min-h-11 w-full sm:w-auto">
            {sending ? "Sending..." : "Send Notification"}
          </Button>
        </form>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-6">
          <h2 className="mb-4 font-semibold text-ink">Recent sends</h2>
          {loadingLogs ? (
            <AdminTableSkeleton rows={4} cols={2} />
          ) : logs.length === 0 ? (
            <p className="text-sm text-ink-muted">No notifications yet.</p>
          ) : (
            <ul className="max-h-[520px] space-y-3 overflow-y-auto">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-xl border border-gray-100 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-ink">{log.title}</p>
                    <span className="shrink-0 text-xs text-ink-soft">
                      {new Date(log.created_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{log.body}</p>
                  <p className="mt-2 text-xs text-ink-soft">
                    {log.channel} · {log.target_type} · {log.recipient_count} recipients
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}
