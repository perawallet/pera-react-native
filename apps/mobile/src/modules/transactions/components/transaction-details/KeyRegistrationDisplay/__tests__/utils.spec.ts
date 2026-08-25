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

import { describe, expect, it } from 'vitest'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { getKeyRegType } from '../utils'

const tx = (
    keyregTransaction?: PeraDisplayableTransaction['keyregTransaction'],
): PeraDisplayableTransaction =>
    ({ keyregTransaction }) as PeraDisplayableTransaction

describe('getKeyRegType', () => {
    it('reports online when a participation key is registered', () => {
        expect(
            getKeyRegType(
                tx({
                    voteParticipationKey: new Uint8Array(32),
                    nonParticipation: false,
                }),
            ),
        ).toBe('online')
    })

    // A de-registration carries no keys and leaves `nonParticipation` false —
    // reading that flag alone reported every offline keyreg as "Online".
    it('reports offline when no participation key is registered', () => {
        expect(getKeyRegType(tx({ nonParticipation: false }))).toBe('offline')
    })

    // `nonParticipation` means "never participate again", which is still
    // offline — not a third status the UI has copy for.
    it('reports offline for a non-participation keyreg', () => {
        expect(getKeyRegType(tx({ nonParticipation: true }))).toBe('offline')
    })

    it('reports offline when the keyreg payload is absent', () => {
        expect(getKeyRegType(tx(undefined))).toBe('offline')
    })
})
