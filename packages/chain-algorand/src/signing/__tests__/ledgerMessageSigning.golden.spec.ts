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

import { beforeEach, describe, expect, it } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { HardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import {
    messageSignerChainAdapters,
    signMessageGroupOnDevice,
    type AnalyzedSignableGroup,
    type SigningResult,
} from '@perawallet/wallet-core-signing'
import { LedgerAppOutdatedError } from '@perawallet/wallet-extension-ledger-shared'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandMessageSignerAdapter } from '../adapter'
import { siwaAuthPayload } from '../message/__tests__/messageFixtures'
import {
    LEDGER_ADDRESS,
    createFakeAlgorandApp,
    ledger,
} from './ledgerGoldenFixtures'

const AUTH_DATA_CASE: AnalyzedSignableGroup = {
    source: { type: 'walletconnect' },
    signerAddress: LEDGER_ADDRESS,
    originalIndices: [0],
    analysis: {
        totalFees: 0n,
        warnings: [],
        signableAddresses: [LEDGER_ADDRESS],
        riskLevel: 'low',
    },
    data: (() => {
        const { authData, metadata } = siwaAuthPayload(LEDGER_ADDRESS)
        return {
            type: 'auth-data',
            authData: { ...authData, requestId: 'request-1' },
            metadata,
        }
    })(),
} as AnalyzedSignableGroup

const signThroughHardware = (
    registry: HardwareWalletRegistry,
): Promise<SigningResult> =>
    signMessageGroupOnDevice({
        group: AUTH_DATA_CASE,
        account: ledger as HardwareWalletAccount,
        allAccounts: [ledger],
        scope: { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' },
        registry,
    })

const serialise = (value: unknown): unknown => {
    if (value instanceof Uint8Array) return encodeToBase64(value)
    if (Array.isArray(value)) return value.map(serialise)
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, entry]) => entry !== undefined)
                .map(([key, entry]) => [key, serialise(entry)]),
        )
    }
    return value
}

// What the Algorand app received for a Ledger auth-data request before the
// route moved onto the hardware message leg. Never regenerate it from the
// current code: a drift here is a change in what the device signs.
const GOLDEN_AUTH_DATA_CALLS = [
    { method: 'getAddressAndPubKey', args: [0, false] },
    { method: 'getVersion', args: [] },
    {
        method: 'signData',
        args: [
            {
                authenticationData:
                    'KBGH+oRnF4z/jQ0Ayt3BbVSgYu6obkdWuS/kZGCaroQF',
                data: 'eyJhY2NvdW50X2FkZHJlc3MiOiI1SkZHWVk3Q1RSSkFWUFhWS0I1UkdMV0Y3R0tVTzVWT1gyN0hYRVNDRDNWR1NGQ0cySVdBS0RNNVlVIiwiY2hhaW5faWQiOiJhbGdvcmFuZDptYWlubmV0IiwiZG9tYWluIjoiYXJjNjAuaW8iLCJub25jZSI6ImFiYzEyMyIsInN0YXRlbWVudCI6IlNpZ24gaW4gdG8gYXJjNjAuaW8iLCJ0eXBlIjoiZWQyNTUxOSIsInVyaSI6Imh0dHBzOi8vYXJjNjAuaW8vbG9naW4iLCJ2ZXJzaW9uIjoiMSJ9',
                domain: 'arc60.io',
                hdPath: "m/44'/283'/0'/0/0",
                requestId: 'request-1',
                signer: '6kpsY+KcUgq+9VB7Ey7F+ZVHdq6+vnuSQh7qaRRG0iw=',
            },
            { encoding: 'base64', scope: 1 },
        ],
    },
]

describe('Algorand auth-data on a Ledger', () => {
    beforeEach(() => {
        messageSignerChainAdapters.register(algorandMessageSignerAdapter)
    })

    it('signs auth-data on a Ledger with the app calls and arguments it made before the hardware message leg', async () => {
        const { registry, calls } = createFakeAlgorandApp()

        const result = await signThroughHardware(registry)

        expect(serialise(calls)).toEqual(GOLDEN_AUTH_DATA_CALLS)
        expect(result.signedData.type).toBe('auth-data')
    })

    it('refuses an Algorand app older than 2.0.0 without calling signData', async () => {
        const { registry, calls } = createFakeAlgorandApp({
            major: 1,
            minor: 9,
            patch: 0,
        })

        await expect(signThroughHardware(registry)).rejects.toBeInstanceOf(
            LedgerAppOutdatedError,
        )
        expect(calls.map(({ method }) => method)).not.toContain('signData')
    })
})
