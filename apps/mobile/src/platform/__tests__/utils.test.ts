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

import { describe, expect, it, vi } from 'vitest'

let platformOS = 'ios'

vi.mock('react-native', () => ({
    Platform: {
        get OS() {
            return platformOS
        },
    },
}))

import { isIOS } from '../utils'

describe('isIOS', () => {
    it('returns true when Platform.OS === ios', () => {
        platformOS = 'ios'
        expect(isIOS()).toBe(true)
    })

    it('returns false when Platform.OS !== ios', () => {
        platformOS = 'android'
        expect(isIOS()).toBe(false)
    })
})
