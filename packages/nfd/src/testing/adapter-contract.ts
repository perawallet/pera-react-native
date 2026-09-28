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
import type {
    NameServiceChainAdapter,
    VerifyForwardResolutionParams,
} from '../chain-adapter'

export interface NameServiceContractFixtures {
    valid: readonly string[]
    invalid: readonly string[]
    /** Required when the adapter implements `verifyForwardResolution`. */
    forwardResolution?: {
        params: Omit<VerifyForwardResolutionParams, 'signal'>
        /** Makes every chain read fail with an ordinary (non-abort) error. */
        arrangeUnreachable(): void
        /** Makes chain reads honour their abort signal. */
        arrangeAbortable(): void
    }
}

/** Every chain package runs this against its own name-service adapter. */
export const nameServiceContractTests = (
    makeAdapter: () => NameServiceChainAdapter,
    fixtures: NameServiceContractFixtures,
): void => {
    const adapter = makeAdapter()

    describe(`NameServiceChainAdapter contract: ${adapter.chainId}`, () => {
        it('accepts every valid address', () => {
            for (const address of fixtures.valid) {
                expect(makeAdapter().isValidAddress(address)).toBe(true)
            }
        })

        it('rejects the empty string and every invalid address', () => {
            for (const address of ['', ...fixtures.invalid]) {
                expect(makeAdapter().isValidAddress(address)).toBe(false)
            }
        })

        if (!adapter.verifyForwardResolution) return

        it('ships forward-resolution fixtures', () => {
            expect(fixtures.forwardResolution).toBeDefined()
        })

        const resolution = fixtures.forwardResolution
        if (!resolution) return

        it('reports an unreadable chain as unavailable, not as a verdict', async () => {
            resolution.arrangeUnreachable()

            await expect(
                makeAdapter().verifyForwardResolution!(resolution.params),
            ).resolves.toBe('unavailable')
        })

        it('throws when aborted rather than returning a verdict', async () => {
            resolution.arrangeAbortable()
            const controller = new AbortController()
            controller.abort()

            await expect(
                makeAdapter().verifyForwardResolution!({
                    ...resolution.params,
                    signal: controller.signal,
                }),
            ).rejects.toMatchObject({ name: 'AbortError' })
        })
    })
}
