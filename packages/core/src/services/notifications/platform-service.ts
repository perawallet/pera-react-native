import { container } from 'tsyringe'

export const NotificationServiceContainerKey = 'NotificationService'

export type NotificationsInitResult = {
    token?: string
    unsubscribe: () => void
}

export interface NotificationService {
    initializeNotifications(): Promise<NotificationsInitResult>
}

export const useNotificationService = () =>
    container.resolve<NotificationService>(NotificationServiceContainerKey)
