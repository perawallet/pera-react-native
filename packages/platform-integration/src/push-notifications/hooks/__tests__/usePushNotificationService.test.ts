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
    PushNotificationServiceContainerKey,
    usePushNotificationService,
} from '../index'
import { type PushNotificationService } from '../../models'

describe('services/push-notifications/hooks/usePushNotificationService', () => {
    test('usePushNotificationService resolves the registered PushNotificationService from the container', async () => {
        const dummy: PushNotificationService = {
            async initializeNotifications() {
                return { unsubscribe: () => {} }
            },
        }

        container.register(PushNotificationServiceContainerKey, {
            useValue: dummy,
        })

        const svc = usePushNotificationService()
        expect(svc).toBe(dummy)

        const init = await svc.initializeNotifications()
        expect(init).toStrictEqual({ unsubscribe: expect.any(Function) })
    })
})
