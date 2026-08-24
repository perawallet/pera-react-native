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
import { allowRotationAndResize } from '../withAndroidLargeScreenSupport'

type ActivityAttributes = Record<string, string>

describe('allowRotationAndResize', () => {
    it('replaces the portrait lock with the system default', () => {
        const result: ActivityAttributes = allowRotationAndResize({
            'android:name': '.MainActivity',
            'android:screenOrientation': 'portrait',
        })

        expect(result['android:screenOrientation']).toBe('unspecified')
    })

    it('marks the activity resizeable', () => {
        const result: ActivityAttributes = allowRotationAndResize({
            'android:name': '.MainActivity',
        })

        expect(result['android:resizeableActivity']).toBe('true')
    })

    it('keeps the other activity attributes', () => {
        const result: ActivityAttributes = allowRotationAndResize({
            'android:name': '.MainActivity',
            'android:launchMode': 'singleTask',
            'android:configChanges': 'orientation|screenSize|screenLayout',
        })

        expect(result['android:name']).toBe('.MainActivity')
        expect(result['android:launchMode']).toBe('singleTask')
        expect(result['android:configChanges']).toBe(
            'orientation|screenSize|screenLayout',
        )
    })
})
