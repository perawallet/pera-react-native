import { container } from "tsyringe";
import { useMemo } from "react";

export const NotificationServiceContainerKey = "NotificationService";

export type NotificationsInitResult = {
  token?: string;
  unsubscribe: () => void;
};

export interface NotificationService {
  initialize(): Promise<NotificationsInitResult>;
}

export const useNotificationService = () => {
  return useMemo(
    () =>
      container.resolve<NotificationService>(NotificationServiceContainerKey),
    [NotificationServiceContainerKey]
  );
};
