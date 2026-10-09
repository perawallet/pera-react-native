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
import { SeedScheme } from '@perawallet/wallet-core-kms'
import {
    standaloneAccount,
    hardwareAccount,
    hdAccount,
    multisigAccount,
    quantumAccount,
    watchAccount,
} from '../../__tests__/algorandAccounts'
import {
    algorandDuplicateRank,
    algorandLocalKeyKinds,
} from '../local-key-kinds'

describe('algorandLocalKeyKinds', () => {
    it('lists bip39, then standalone above quantum, so 25 words detect as standalone', () => {
        expect(algorandLocalKeyKinds.map(kind => kind.seed)).toEqual([
            SeedScheme.Bip39,
            null,
            SeedScheme.Quantum,
        ])
    })

    it("declares each kind's scheme, word counts and detection", () => {
        expect(algorandLocalKeyKinds).toEqual([
            {
                seed: SeedScheme.Bip39,
                signingScheme: 'ed25519',
                isHd: true,
                mnemonicWordCounts: [24],
                isAutoDetected: true,
            },
            {
                seed: null,
                signingScheme: 'ed25519',
                isHd: false,
                mnemonicWordCounts: [25],
                isAutoDetected: true,
            },
            {
                seed: SeedScheme.Quantum,
                signingScheme: 'falcon-1024',
                isHd: false,
                mnemonicWordCounts: [25],
                isAutoDetected: false,
            },
        ])
    })
})

describe('algorandDuplicateRank', () => {
    it('ranks quantum > hardware > hdWallet > standalone > multisig > watch', () => {
        expect(
            [
                quantumAccount('A'),
                hardwareAccount('A'),
                hdAccount('A'),
                standaloneAccount('A'),
                multisigAccount('A', null),
                watchAccount('A'),
            ].map(algorandDuplicateRank),
        ).toEqual([6, 5, 4, 3, 2, 1])
    })

    it('ignores rekey state', () => {
        expect(
            algorandDuplicateRank(watchAccount('A', { authorityAddress: 'B' })),
        ).toBe(1)
    })
})
