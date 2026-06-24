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

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    addNotificationIconMetaData,
    notificationIconDrawableTarget,
} from '../withAndroidNotificationIcon'

const FCM_ICON_META = 'com.google.firebase.messaging.default_notification_icon'

const emptyManifest = () => ({
    manifest: {
        application: [{ $: { 'android:name': '.MainApplication' } }],
    },
})

describe('addNotificationIconMetaData', () => {
    it('registers the FCM default notification icon as a drawable resource', () => {
        const result = addNotificationIconMetaData(emptyManifest())
        const meta = result.manifest.application[0]['meta-data'] ?? []
        const entry = meta.find(m => m.$['android:name'] === FCM_ICON_META)
        expect(entry).toBeDefined()
        expect(entry.$['android:resource']).toBe('@drawable/ic_notification_small')
    })

    it('is idempotent — does not add the meta-data twice', () => {
        const once = addNotificationIconMetaData(emptyManifest())
        const twice = addNotificationIconMetaData(once)
        const count = (twice.manifest.application[0]['meta-data'] ?? []).filter(
            m => m.$['android:name'] === FCM_ICON_META,
        ).length
        expect(count).toBe(1)
    })
})

describe('notificationIconDrawableTarget', () => {
    it('resolves into app/src/main/res/drawable', () => {
        expect(notificationIconDrawableTarget('/proj/android')).toBe(
            path.join(
                '/proj/android',
                'app',
                'src',
                'main',
                'res',
                'drawable',
                'ic_notification_small.xml',
            ),
        )
    })
})
