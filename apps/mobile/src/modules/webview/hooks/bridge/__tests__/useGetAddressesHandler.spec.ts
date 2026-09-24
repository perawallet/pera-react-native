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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    canSignWith,
    isRekeyedAccount,
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import { useGetAddressesHandler } from '../useGetAddressesHandler'
import {
    TRUSTED,
    bridgeMessage,
    createMockWebview,
    type MockWebview,
} from './fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    AccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
        quantum: 'quantum',
    },
    isRekeyedAccount: vi.fn(),
    canSignWith: vi.fn(),
    useSigningAccounts: vi.fn(),
    useAllAccounts: vi.fn(),
}))

type MockAccount = {
    address: string
    name?: string
    type: string
    rekeyAddress?: string
}

// useSigningAccounts owns the Watch/Unsignable filtering — the bridge just
// maps. These cases pin the mapping and assume the filter is covered by the
// package's own tests.
const setupAccounts = (accounts: MockAccount[], signers: Set<string>) => {
    vi.mocked(useSigningAccounts).mockReturnValue(
        accounts.filter(a => signers.has(a.address)) as never,
    )
    vi.mocked(useAllAccounts).mockReturnValue(accounts as never)
    vi.mocked(canSignWith).mockImplementation(account =>
        signers.has((account as MockAccount).address),
    )
}

const sentPayload = (
    webview: MockWebview,
): Array<{ name: string; address: string; type: string }> => {
    const last = String(webview.injectJavaScript.mock.calls.at(-1)?.[0])
    const match = last.match(/"result":(\[[^\]]*\])/)
    if (!match) {
        throw new Error(`No result payload in: ${last}`)
    }
    return JSON.parse(match[1])
}

const requestAddresses = (): MockWebview => {
    const webview = createMockWebview()
    const { result } = renderHook(() => useGetAddressesHandler(webview))
    result.current(bridgeMessage('10', 'getAddresses'), TRUSTED)
    return webview
}

describe('useGetAddressesHandler (Android parity)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(isRekeyedAccount).mockImplementation(
            account => !!(account as MockAccount).rekeyAddress,
        )
    })

    it('answers with the signing accounts only', () => {
        setupAccounts(
            [
                { address: 'signer', name: 'Signer', type: 'hdWallet' },
                { address: 'watch', name: 'Watch', type: 'watch' },
            ],
            new Set(['signer']),
        )

        const webview = requestAddresses()

        expect(String(webview.injectJavaScript.mock.calls[0][0])).toContain(
            '"id":"10"',
        )
        expect(sentPayload(webview)).toEqual([
            { name: 'Signer', address: 'signer', type: 'HDWallet' },
        ])
    })

    it('preserves store order — ordering is the consumer-side concern', () => {
        setupAccounts(
            [
                { address: 'first', name: 'First', type: 'hdWallet' },
                { address: 'second', name: 'Second', type: 'algo25' },
                { address: 'third', name: 'Third', type: 'hardware' },
            ],
            new Set(['first', 'second', 'third']),
        )

        const payload = sentPayload(requestAddresses())

        expect(payload.map(p => [p.address, p.type])).toEqual([
            ['first', 'HDWallet'],
            ['second', 'Algo25'],
            ['third', 'Hardware'],
        ])
    })

    it('reports quantum accounts as their own Quantum type', () => {
        // Not `Algo25`: a quantum account produces a ~1.2 KB Falcon signature
        // with no recoverable Ed25519 public key.
        setupAccounts(
            [{ address: 'quantum-addr', name: 'Quantum', type: 'quantum' }],
            new Set(['quantum-addr']),
        )

        expect(sentPayload(requestAddresses())[0].type).toBe('Quantum')
    })

    it('reports a rekeyed account by whether its auth key is in the wallet', () => {
        setupAccounts(
            [
                {
                    address: 'rekeyed',
                    name: 'Rekeyed',
                    type: 'hdWallet',
                    rekeyAddress: 'auth',
                },
            ],
            new Set(['rekeyed']),
        )

        expect(sentPayload(requestAddresses())[0].type).toBe('RekeyedSignable')
    })

    it('sends an empty name string when the account has no name', () => {
        setupAccounts(
            [{ address: 'nameless', type: 'hdWallet' }],
            new Set(['nameless']),
        )

        expect(sentPayload(requestAddresses())).toEqual([
            { name: '', address: 'nameless', type: 'HDWallet' },
        ])
    })
})
