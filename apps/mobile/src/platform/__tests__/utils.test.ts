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

let mockPlatformOS = 'ios'

jest.mock('react-native', () => ({
    Platform: {
        get OS() {
            return mockPlatformOS
        },
    },
}))

import { isIOS } from '../utils'

describe('isIOS', () => {
    it('returns true when Platform.OS === ios', () => {
        mockPlatformOS = 'ios'
        expect(isIOS()).toBe(true)
    })

    it('returns false when Platform.OS !== ios', () => {
        mockPlatformOS = 'android'
        expect(isIOS()).toBe(false)
    })
})
