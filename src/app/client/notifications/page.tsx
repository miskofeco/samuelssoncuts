import { NotificationList } from "@/components/client/notification-list";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireApprovedClient } from "@/server/auth";
import { loadClientNotifications } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function ClientNotificationsPage() {
  const profile = await requireApprovedClient();
  const notifications = await loadClientNotifications(profile);
  const t = await getDict();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.client.notificationsEyebrow}
        title={t.client.notificationsTitle}
        description={t.client.notificationsDescription}
      />
      <NotificationList
        notifications={notifications}
        title={t.client.allNotifications}
        maxHeight="max-h-none"
      />
    </div>
  );
}
