import { describe, test, expect } from 'vitest'
import { container } from 'tsyringe'
import {
	NotificationServiceContainerKey,
	useNotificationService,
	type NotificationService,
} from '@services/notifications'

describe('services/notifications/platform-service', () => {
	test('useNotificationService resolves the registered NotificationService from the container', async () => {
		const dummy: NotificationService = {
			async initializeNotifications() {
				return { unsubscribe: () => {} }
			},
		}

		container.register(NotificationServiceContainerKey, { useValue: dummy })

		const svc = useNotificationService()
		expect(svc).toBe(dummy)

		const init = await svc.initializeNotifications()
		expect(init).toStrictEqual({ unsubscribe: expect.any(Function) })
	})
})
