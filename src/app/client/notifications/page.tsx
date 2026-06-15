import { NotificationList } from "@/components/client/notification-list";
import { PageHeader } from "@/components/shared/page-header";
import { requireApprovedClient } from "@/server/auth";
import { loadClientNotifications } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function ClientNotificationsPage() {
  const profile = await requireApprovedClient();
  const notifications = await loadClientNotifications(profile);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Notifications"
        description="Email and SMS updates the shop has sent you."
      />
      <NotificationList notifications={notifications} title="All notifications" maxHeight="max-h-none" />
    </div>
  );
}
