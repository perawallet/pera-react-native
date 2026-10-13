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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
    getCredentialsFileReadSources,
    getCredentialsFileSaveSources,
} from '../credentialsFileSources.web'

const { getSurface } = vi.hoisted(() => ({ getSurface: vi.fn() }))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({ getSurface }))

beforeEach(() => vi.clearAllMocks())

describe('credentials file sources on web', () => {
    test.each(['popup', 'expanded'])(
        'offers a local save on the %s surface, since a download survives it',
        surface => {
            getSurface.mockReturnValue(surface)

            expect(getCredentialsFileSaveSources()).toEqual(['device'])
        },
    )

    test('reads a local file on the expanded surface', () => {
        getSurface.mockReturnValue('expanded')

        expect(getCredentialsFileReadSources()).toEqual(['device'])
    })

    // An OS file dialog takes focus and Chrome closes the popup under it, so
    // the picker would open over a dead surface and never return.
    test('offers no read in the toolbar popup', () => {
        getSurface.mockReturnValue('popup')

        expect(getCredentialsFileReadSources()).toEqual([])
    })
})
