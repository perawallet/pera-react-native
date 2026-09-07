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
import { scopeBlePermissions } from '../withAndroidBlePermissionScoping'

const perm = (name: string, extra: Record<string, string> = {}) => ({
    $: { 'android:name': name, ...extra },
})

const manifestWith = (names: string[]) => ({
    manifest: { 'uses-permission': names.map(name => perm(name)) },
})

describe('scopeBlePermissions', () => {
    it('caps the legacy BLE and location permissions at maxSdkVersion 30', () => {
        const result = scopeBlePermissions(
            manifestWith([
                'android.permission.BLUETOOTH',
                'android.permission.BLUETOOTH_ADMIN',
                'android.permission.ACCESS_FINE_LOCATION',
            ]),
        )
        const byName = (n: string) =>
            result.manifest['uses-permission']?.find(
                (p: { $: Record<string, string> }) => p.$['android:name'] === n,
            )?.$

        expect(
            byName('android.permission.BLUETOOTH')?.['android:maxSdkVersion'],
        ).toBe('30')
        expect(
            byName('android.permission.BLUETOOTH_ADMIN')?.[
                'android:maxSdkVersion'
            ],
        ).toBe('30')
        expect(
            byName('android.permission.ACCESS_FINE_LOCATION')?.[
                'android:maxSdkVersion'
            ],
        ).toBe('30')
    })

    it('flags BLUETOOTH_SCAN as neverForLocation', () => {
        const result = scopeBlePermissions(
            manifestWith(['android.permission.BLUETOOTH_SCAN']),
        )
        expect(
            result.manifest['uses-permission']?.[0].$[
                'android:usesPermissionFlags'
            ],
        ).toBe('neverForLocation')
    })

    it('leaves unrelated permissions untouched', () => {
        const result = scopeBlePermissions(
            manifestWith(['android.permission.CAMERA']),
        )
        expect(result.manifest['uses-permission']?.[0].$).toEqual({
            'android:name': 'android.permission.CAMERA',
        })
    })

    it('emits tools:node="remove" markers for the library uses-permission-sdk-23 fine + coarse location', () => {
        const result = scopeBlePermissions(
            manifestWith(['android.permission.ACCESS_FINE_LOCATION']),
        ) as {
            manifest: {
                $: Record<string, string>
                'uses-permission-sdk-23': { $: Record<string, string> }[]
            }
        }

        expect(result.manifest.$['xmlns:tools']).toBe(
            'http://schemas.android.com/tools',
        )
        expect(result.manifest['uses-permission-sdk-23']).toEqual([
            {
                $: {
                    'android:name': 'android.permission.ACCESS_FINE_LOCATION',
                    'tools:node': 'remove',
                },
            },
            {
                $: {
                    'android:name': 'android.permission.ACCESS_COARSE_LOCATION',
                    'tools:node': 'remove',
                },
            },
        ])
    })

    it('does not add duplicate remove markers when run twice', () => {
        const once = scopeBlePermissions(
            manifestWith(['android.permission.ACCESS_FINE_LOCATION']),
        )
        const twice = scopeBlePermissions(once) as {
            manifest: { 'uses-permission-sdk-23': unknown[] }
        }

        expect(twice.manifest['uses-permission-sdk-23']).toHaveLength(2)
    })
})
