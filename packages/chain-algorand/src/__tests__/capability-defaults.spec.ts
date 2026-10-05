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
import { isRestrictedIn } from '@perawallet/wallet-core-chain-contract'
import { algorandCapabilityRestrictions } from '../capability-defaults'

const PERA_BACKED = [
    'priceHistory',
    'balanceHistory',
    'assetSearch',
    'assetFavorites',
    'priceAlerts',
    'csvExport',
    'notifications',
    'assetInbox',
] as const

describe('algorandCapabilityRestrictions', () => {
    it.each(PERA_BACKED)(
        'switches %s off only on a developer-mode override',
        capability => {
            expect(
                isRestrictedIn(
                    algorandCapabilityRestrictions,
                    capability,
                    'developer-override',
                ),
            ).toBe(true)
            expect(
                isRestrictedIn(
                    algorandCapabilityRestrictions,
                    capability,
                    'developer',
                ),
            ).toBe(false)
            expect(
                isRestrictedIn(
                    algorandCapabilityRestrictions,
                    capability,
                    'live',
                ),
            ).toBe(false)
        },
    )

    it('keeps onramp off in every developer mode', () => {
        expect(
            isRestrictedIn(
                algorandCapabilityRestrictions,
                'onramp',
                'developer',
            ),
        ).toBe(true)
        expect(
            isRestrictedIn(
                algorandCapabilityRestrictions,
                'onramp',
                'developer-override',
            ),
        ).toBe(true)
    })

    it('leaves a node-backed capability unrestricted', () => {
        expect(
            isRestrictedIn(
                algorandCapabilityRestrictions,
                'send',
                'developer-override',
            ),
        ).toBe(false)
    })
})
