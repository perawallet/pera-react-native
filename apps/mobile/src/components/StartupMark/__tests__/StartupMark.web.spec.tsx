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

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@test-utils/render'
import { StartupMark } from '../StartupMark.web'

describe('StartupMark', () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('waits out the rest of the delay measured from page load', async () => {
        vi.useFakeTimers()
        vi.spyOn(performance, 'now').mockReturnValue(100)
        render(<StartupMark />)

        await act(async () => vi.advanceTimersByTimeAsync(199))
        expect(screen.queryByRole('status')).toBeNull()

        await act(async () => vi.advanceTimersByTimeAsync(1))
        expect(screen.getByRole('img', { name: 'Pera Wallet' })).toBeTruthy()
    })

    it('shows at once when the page has been loading past the delay', () => {
        vi.spyOn(performance, 'now').mockReturnValue(450)
        render(<StartupMark />)

        expect(screen.getByRole('img', { name: 'Pera Wallet' })).toBeTruthy()
    })
})
