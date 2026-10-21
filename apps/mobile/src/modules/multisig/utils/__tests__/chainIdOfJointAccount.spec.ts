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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    withMultisigParameters,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'
import { ETHEREUM_CHAIN_ID } from '@test-utils/chain-fixtures'

vi.mock(import('@perawallet/wallet-core-accounts'), async importOriginal => {
    const actual = await importOriginal()
    return { ...actual }
})

import {
    chainIdOfJointAccount,
    chainIdOfMultisigSignRequest,
} from '../chainIdOfJointAccount'

const jointAccount = (address: string): WalletAccount =>
    withMultisigParameters(
        {
            id: `joint-${address}`,
            custody: { kind: 'multisig' },
            chains: { algorand: { address } },
        },
        'algorand',
        { version: 1, threshold: 1, addresses: ['A', 'B'] },
    )

const localAccount = (chainId: string, address: string): WalletAccount => ({
    id: `local-${chainId}-${address}`,
    custody: { kind: 'local', seed: null },
    chains: { [chainId]: { address, keyPairId: `kp-${address}` } },
})

const signRequestFor = (
    address: string,
    participantAddresses: string[],
): MultisigSignRequest => ({
    id: 'sr-1',
    status: 'pending',
    type: 'async',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expectedExpireDatetime: new Date('2026-01-01T01:00:00Z'),
    failReasonDisplay: null,
    proposerAddress: null,
    multisigAccount: {
        customId: 'm-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        address,
        version: 1,
        threshold: 1,
        participantAddresses,
    },
    transactionLists: [],
})

describe('chainIdOfJointAccount', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
    })

    it('resolves the chain of the held joint account', () => {
        const accounts = [localAccount('algorand', 'A'), jointAccount('MSIG')]

        expect(chainIdOfJointAccount(accounts, 'MSIG')).toBe('algorand')
    })

    it('ignores a non-multisig account at the same address', () => {
        const accounts = [localAccount('algorand', 'MSIG')]

        expect(chainIdOfJointAccount(accounts, 'MSIG')).toBeUndefined()
    })
})

describe('chainIdOfMultisigSignRequest', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
    })

    it('prefers the held joint account', () => {
        const accounts = [
            localAccount(ETHEREUM_CHAIN_ID, 'A'),
            jointAccount('MSIG'),
        ]

        expect(
            chainIdOfMultisigSignRequest(
                signRequestFor('MSIG', ['A', 'B']),
                accounts,
            ),
        ).toBe('algorand')
    })

    it('falls back to the chain of a held participant on Algorand', () => {
        const accounts = [localAccount('algorand', 'B')]

        expect(
            chainIdOfMultisigSignRequest(
                signRequestFor('MSIG', ['A', 'B']),
                accounts,
            ),
        ).toBe('algorand')
    })

    it('falls back to the chain of a held participant on Ethereum', () => {
        const accounts = [localAccount(ETHEREUM_CHAIN_ID, 'A')]

        expect(
            chainIdOfMultisigSignRequest(
                signRequestFor('MSIG', ['A', 'B']),
                accounts,
            ),
        ).toBe(ETHEREUM_CHAIN_ID)
    })

    it('is undefined when nothing held is part of the request', () => {
        expect(
            chainIdOfMultisigSignRequest(signRequestFor('MSIG', ['A']), [
                localAccount('algorand', 'Z'),
            ]),
        ).toBeUndefined()
    })
})
