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
import { testChainContext } from '../../__tests__/context'
import {
    DISCOVERY_LOOKUP_BOUNDS,
    withDiscoveryReadCeiling,
} from '../discovery-bounds'

describe('withDiscoveryReadCeiling', () => {
    it('caps the read ceiling at the lookup timeout and keeps the submit ceiling', () => {
        const ctx = {
            ...testChainContext(),
            timeouts: { readMs: 15_000, submitMs: 30_000 },
        }

        expect(withDiscoveryReadCeiling(ctx).timeouts).toEqual({
            readMs: DISCOVERY_LOOKUP_BOUNDS.timeout,
            submitMs: 30_000,
        })
    })

    it('keeps a read ceiling that is already lower', () => {
        const ctx = testChainContext()

        expect(withDiscoveryReadCeiling(ctx).timeouts.readMs).toBe(
            ctx.timeouts.readMs,
        )
    })

    it("returns the context's endpoints", () => {
        const ctx = testChainContext()

        expect(withDiscoveryReadCeiling(ctx).getEndpoints()).toEqual(
            ctx.getEndpoints(),
        )
    })
})
