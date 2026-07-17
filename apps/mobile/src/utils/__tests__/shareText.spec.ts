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

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Share from 'react-native-share'
import { shareText } from '../shareText'

vi.mock('react-native-share', () => ({
    default: { open: vi.fn() },
}))

describe('shareText', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('forwards message, title and url to Share.open with failOnCancel disabled', async () => {
        await shareText({
            message: 'hello',
            title: 'Greeting',
            url: 'https://example.com',
        })

        expect(Share.open).toHaveBeenCalledWith({
            message: 'hello',
            title: 'Greeting',
            url: 'https://example.com',
            failOnCancel: false,
        })
    })

    it('works with only a message', async () => {
        await shareText({ message: 'just text' })

        expect(Share.open).toHaveBeenCalledWith({
            message: 'just text',
            title: undefined,
            url: undefined,
            failOnCancel: false,
        })
    })
})
