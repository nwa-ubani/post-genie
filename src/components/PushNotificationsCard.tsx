import { Bell, BellOff, Send } from "lucide-react";
import { toast } from "sonner";
import { usePush } from "@/lib/use-push";

export function PushNotificationsCard() {
  const { status, enable, disable, sendTest } = usePush();

  if (status === "unsupported") {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Push notifications</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your browser doesn't support web push. On iPhone, install Auto-Post to your home screen first (iOS 16.4+).
        </p>
      </div>
    );
  }

  const enabled = status === "granted-on";
  const denied = status === "denied";

  const onToggle = async () => {
    try {
      if (enabled) await disable();
      else await enable();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update notifications");
    }
  };

  const onTest = async () => {
    try {
      const res = await sendTest();
      toast.success(`Sent ${res.sent} push${res.sent === 1 ? "" : "es"}. Check your notifications.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test push failed");
    }
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Push notifications</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Get a native notification when today's post publishes, when a run fails, or when your LinkedIn connection is
            about to expire.
          </p>
          {denied && (
            <p className="mt-2 text-xs text-destructive">
              Notifications are blocked in your browser settings. Re-enable them for this site, then try again.
            </p>
          )}
        </div>
        <button
          onClick={onToggle}
          disabled={denied || status === "loading"}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {enabled ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          {enabled ? "Turn off" : "Turn on"}
        </button>
      </div>
      {enabled && (
        <button
          onClick={onTest}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
        >
          <Send className="h-3.5 w-3.5" />
          Send test notification
        </button>
      )}
    </div>
  );
}
