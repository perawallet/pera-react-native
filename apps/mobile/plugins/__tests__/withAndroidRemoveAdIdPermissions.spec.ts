/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, expect, it } from 'vitest'
import { removeAdIdPermissions } from '../withAndroidRemoveAdIdPermissions'

const perm = (name: string, extra: Record<string, string> = {}) => ({
    $: { 'android:name': name, ...extra },
})

const manifestWith = (names: string[]) => ({
    manifest: { 'uses-permission': names.map(name => perm(name)) },
})

const removeMarkers = (result: {
    manifest: { 'uses-permission': { $: Record<string, string> }[] }
}) =>
    result.manifest['uses-permission'].filter(
        p => p.$['tools:node'] === 'remove',
    )

describe('removeAdIdPermissions', () => {
    it('emits tools:node="remove" markers for the three advertising-ID permissions', () => {
        const result = removeAdIdPermissions(manifestWith([])) as {
            manifest: {
                $: Record<string, string>
                'uses-permission': { $: Record<string, string> }[]
            }
        }

        expect(result.manifest.$['xmlns:tools']).toBe(
            'http://schemas.android.com/tools',
        )
        expect(removeMarkers(result).map(p => p.$['android:name'])).toEqual([
            'com.google.android.gms.permission.AD_ID',
            'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
            'android.permission.ACCESS_ADSERVICES_AD_ID',
        ])
    })

    it('leaves unrelated permissions untouched', () => {
        const result = removeAdIdPermissions(
            manifestWith(['android.permission.CAMERA']),
        ) as {
            manifest: { 'uses-permission': { $: Record<string, string> }[] }
        }

        const camera = result.manifest['uses-permission'].find(
            p => p.$['android:name'] === 'android.permission.CAMERA',
        )
        expect(camera?.$).toEqual({
            'android:name': 'android.permission.CAMERA',
        })
    })

    it('does not add duplicate remove markers when run twice', () => {
        const once = removeAdIdPermissions(manifestWith([]))
        const twice = removeAdIdPermissions(once) as {
            manifest: { 'uses-permission': { $: Record<string, string> }[] }
        }

        expect(removeMarkers(twice)).toHaveLength(3)
    })
})
