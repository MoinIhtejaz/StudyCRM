import { useCallback, useMemo, useState } from "react";

const hasNotificationApi = (): boolean => typeof window !== "undefined" && "Notification" in window;

export const useBrowserNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    hasNotificationApi() ? Notification.permission : "denied"
  );

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!hasNotificationApi()) {
      setPermission("denied");
      return "denied";
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    return nextPermission;
  }, []);

  const notify = useCallback((title: string, body: string) => {
    if (!hasNotificationApi() || permission !== "granted") {
      return;
    }

    new Notification(title, {
      body,
      icon: "/favicon.ico"
    });
  }, [permission]);

  return useMemo(
    () => ({
      permission,
      canUseNotifications: hasNotificationApi(),
      requestPermission,
      notify
    }),
    [permission, requestPermission, notify]
  );
};
