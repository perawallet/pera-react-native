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

import { describe, it, expect } from 'vitest'
import { createHardwareStrategy } from '../createHardwareStrategy'
import { algo25Account, ledgerAccount } from '../../../__tests__/accounts'
import { asUnsignedAlgorandTransaction } from '../../../__tests__/transactions'
import type { AnalyzedSignableGroup } from '../../types'

const SIGNER_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const groupOf = (data: AnalyzedSignableGroup['data']): AnalyzedSignableGroup =>
    ({
        data,
        source: { type: 'local' },
        signerAddress: SIGNER_ADDRESS,
        originalIndices: [0],
        analysis: {
            totalFees: 0n,
            warnings: [],
            signableAddresses: [],
            riskLevel: 'low',
        },
    }) as AnalyzedSignableGroup

const AUTH_DATA_GROUP = groupOf({
    type: 'auth-data',
    authData: {
        data: 'cGF5bG9hZA==',
        signer: SIGNER_ADDRESS,
        domain: 'example.io',
        authenticatorData: new Uint8Array(37),
    },
    metadata: { scope: 1, encoding: 'base64' },
})

const notRetryable = {
    metadata: expect.objectContaining({ retryable: false }),
}

describe('createHardwareStrategy', () => {
    const strategy = createHardwareStrategy({ chainId: 'algorand' })
    const ledger = ledgerAccount(SIGNER_ADDRESS)

    it('signs for hardware accounts only', () => {
        expect(strategy.canSign(ledger)).toBe(true)
        expect(
            strategy.canSign(
                algo25Account(SIGNER_ADDRESS, { keyPairId: 'key-1' }),
            ),
        ).toBe(false)
    })

    it.each([
        [
            'transactions',
            groupOf({
                type: 'transactions',
                transactions: [
                    asUnsignedAlgorandTransaction({
                        sender: { toString: () => SIGNER_ADDRESS },
                    } as never),
                ],
                chainData: { algorand: { indicesToSign: [0] } },
            }),
        ],
        ['auth data', AUTH_DATA_GROUP],
        ['a message', groupOf({ type: 'message', request: {} } as never)],
    ])(
        "refuses %s, which sign through their chain's planner or message signer",
        async (_name, group) => {
            await expect(strategy.sign(group, ledger)).rejects.toThrow(
                "Hardware wallets sign through their chain's planner or message signer",
            )
            await expect(strategy.sign(group, ledger)).rejects.toMatchObject(
                notRetryable,
            )
        },
    )

    it('refuses arbitrary data, which no device signs', async () => {
        const group = groupOf({ type: 'arbitrary-data', data: [] })

        await expect(strategy.sign(group, ledger)).rejects.toThrow(
            'Hardware wallet signing of arbitrary data is not supported',
        )
        // Retrying can never succeed — no Retry affordance should render.
        await expect(strategy.sign(group, ledger)).rejects.toMatchObject(
            notRetryable,
        )
    })

    it('throws CannotSignError for non-hardware wallet accounts', async () => {
        const algo25 = algo25Account(SIGNER_ADDRESS, { keyPairId: 'key-1' })

        await expect(strategy.sign(AUTH_DATA_GROUP, algo25)).rejects.toThrow(
            'not a hardware wallet',
        )
    })
})
