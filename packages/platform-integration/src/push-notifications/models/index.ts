export type NotificationsInitResult = {
    token?: string
    unsubscribe: () => void
}
export interface NotificationService {
    initializeNotifications(): Promise<NotificationsInitResult>
}

export interface NotificationStatus {
    hasNewNotification: boolean
}

export interface NotificationStatusResponse {
    has_new_notification: boolean
}

export interface PeraNotification {
    id: string
    title: string
    message: string
    createdAt: Date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any
}

export interface NotificationResponse {
    id: string
    title: string
    message: string
    creation_datetime: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any
}

export interface NotificationsListResponse {
    results: NotificationResponse[]
    next: string | null
    previous: string | null
}

