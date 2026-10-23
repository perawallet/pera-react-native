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

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

// A build that serves no EVM chain, as scripts/build.mjs bakes it.
vi.hoisted(() => {
    ;(globalThis as { __PERA_SERVES_EVM__?: boolean }).__PERA_SERVES_EVM__ =
        false
})

describe('inject-main in a build without EVM chains', () => {
    it('offers EVM dApps nothing, and still installs window.pera', async () => {
        const announced = vi.fn()
        window.addEventListener('eip6963:announceProvider', announced)

        await import('../inject-main')
        window.dispatchEvent(new Event('eip6963:requestProvider'))

        expect('ethereum' in window).toBe(false)
        expect(announced).not.toHaveBeenCalled()
        expect(typeof window.pera.connect).toBe('function')
    })
})
