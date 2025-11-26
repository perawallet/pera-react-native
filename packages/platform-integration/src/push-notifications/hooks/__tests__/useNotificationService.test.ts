/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect } from 'vitest'
import { container } from 'tsyringe'
import {
    NotificationServiceContainerKey,
    useNotificationService,
} from '../index'
import { type NotificationService } from '../../models'

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
