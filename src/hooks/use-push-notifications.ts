// Browser Push API subscription management -- separate from use-crm-data.ts
// since this is entirely browser-API-driven (ServiceWorker/Notification/
// PushManager), not a Supabase data hook like everything else in there.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export type PushSubscriptionStatus = "unsupported" | "unsubscribed" | "subscribed" | "loading";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export function usePushSubscription() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["push_subscription_status"],
    queryFn: async (): Promise<PushSubscriptionStatus> => {
      if (!pushSupported()) return "unsupported";
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      return sub ? "subscribed" : "unsubscribed";
    },
  });

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!pushSupported()) throw new Error("Bu brauzer push-bildirishnomalarni qo'llamaydi.");
      const vapidPublicKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;
      if (!vapidPublicKey) {
        throw new Error(
          "VITE_VAPID_PUBLIC_KEY sozlanmagan. Sozlamalar -> Secrets bo'limiga qo'shing.",
        );
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Bildirishnoma ruxsati berilmadi.");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const json = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").insert({
        profile_id: user!.id,
        organization_id: user!.organizationId!,
        endpoint: sub.endpoint,
        p256dh: json.keys?.["p256dh"] ?? "",
        auth: json.keys?.["auth"] ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["push_subscription_status"] }),
  });

  const unsubscribe = useMutation({
    mutationFn: async () => {
      if (!pushSupported()) return;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return;
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["push_subscription_status"] }),
  });

  return { status: statusQuery.data ?? "loading", subscribe, unsubscribe };
}
