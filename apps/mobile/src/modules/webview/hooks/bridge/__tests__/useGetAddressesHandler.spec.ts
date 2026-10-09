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
    type AccountCustody,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { algorandDappRequestAdapter } from '@packages/chain-algorand/src/connect/dappRequestAdapter'
import { useGetAddressesHandler } from '../useGetAddressesHandler'
import {
    TRUSTED,
    bridgeMessage,
    createMockWebview,
    type MockWebview,
} from './fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

// The real chain adapter names key kinds by seed scheme.
vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    isRekeyedAccount: vi.fn(),
    canSignWith: vi.fn(),
    useSigningAccounts: vi.fn(),
    useAllAccounts: vi.fn(),
}))

const HD_CUSTODY: AccountCustody = {
    kind: 'local',
    seed: 'bip39',
    hd: { account: 0, keyIndex: 0 },
}
const HARDWARE_CUSTODY: AccountCustody = {
    kind: 'hardware',
    device: {
        manufacturer: 'ledger',
        deviceId: 'device-1',
        deviceName: 'Nano X',
        transportType: 'ble',
    },
    accountIndex: 0,
}

const account = (
    address: string,
    custody: AccountCustody,
    extra: Partial<WalletAccount> = {},
): WalletAccount => ({
    id: `id-${address}`,
    custody,
    chains: { [LEGACY_CHAIN_ID]: { address } },
    ...extra,
})

const addressOf = (a: WalletAccount): string | undefined =>
    a.chains[LEGACY_CHAIN_ID]?.address

// Authority is observed chain state, never on the account record.
const REKEYED_ADDRESSES = new Set([
    'rekeyed',
    'rekeyed-signable',
    'rekeyed-unsignable',
])

// useSigningAccounts owns the Watch/Unsignable filtering — the bridge just
// maps. These cases pin the mapping and assume the filter is covered by the
// package's own tests.
const setupAccounts = (accounts: WalletAccount[], signers: Set<string>) => {
    vi.mocked(useSigningAccounts).mockReturnValue(
        accounts.filter(a => signers.has(addressOf(a) ?? '')),
    )
    vi.mocked(useAllAccounts).mockReturnValue(accounts)
    vi.mocked(canSignWith).mockImplementation(a =>
        signers.has(addressOf(a) ?? ''),
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
        dappRequestChainAdapters.reset()
        dappRequestChainAdapters.register(algorandDappRequestAdapter)
        vi.mocked(isRekeyedAccount).mockImplementation(
            a => !!a && REKEYED_ADDRESSES.has(addressOf(a) ?? ''),
        )
    })

    it('answers with the signing accounts only', () => {
        setupAccounts(
            [
                account('signer', HD_CUSTODY, { name: 'Signer' }),
                account('watch', { kind: 'watch' }, { name: 'Watch' }),
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
                account('first', HD_CUSTODY, { name: 'First' }),
                account(
                    'second',
                    { kind: 'local', seed: null },
                    { name: 'Second' },
                ),
                account('third', HARDWARE_CUSTODY, { name: 'Third' }),
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
            [
                account(
                    'quantum-addr',
                    { kind: 'local', seed: 'quantum' },
                    { name: 'Quantum' },
                ),
            ],
            new Set(['quantum-addr']),
        )

        expect(sentPayload(requestAddresses())[0].type).toBe('Quantum')
    })

    it('reports a rekeyed account by whether its auth key is in the wallet', () => {
        setupAccounts(
            [account('rekeyed', HD_CUSTODY, { name: 'Rekeyed' })],
            new Set(['rekeyed']),
        )

        expect(sentPayload(requestAddresses())[0].type).toBe('RekeyedSignable')
    })

    it('sends an empty name string when the account has no name', () => {
        setupAccounts([account('nameless', HD_CUSTODY)], new Set(['nameless']))

        expect(sentPayload(requestAddresses())).toEqual([
            { name: '', address: 'nameless', type: 'HDWallet' },
        ])
    })

    // The wire contract the webapp parses: one row per account kind, exactly
    // as the bridge emitted it before the kind mapping left the app.
    it('emits the golden payload for every account kind', () => {
        const accounts = [
            account('algo25', { kind: 'local', seed: null }, { name: 'A' }),
            account('hd', HD_CUSTODY, { name: 'B' }),
            account('quantum', { kind: 'local', seed: 'quantum' }),
            account('hardware', HARDWARE_CUSTODY, { name: 'D' }),
            account('multisig', { kind: 'multisig' }, { name: 'E' }),
            account('watch', { kind: 'watch' }, { name: 'F' }),
            account('rekeyed-signable', { kind: 'watch' }, { name: 'G' }),
            account('rekeyed-unsignable', HD_CUSTODY, { name: 'H' }),
        ]
        vi.mocked(useSigningAccounts).mockReturnValue(accounts)
        vi.mocked(useAllAccounts).mockReturnValue(accounts)
        vi.mocked(canSignWith).mockImplementation(
            a => addressOf(a) !== 'rekeyed-unsignable',
        )

        const webview = requestAddresses()

        expect(String(webview.injectJavaScript.mock.calls.at(-1)?.[0])).toBe(
            'window.postMessage(' +
                '{"id":"10","jsonrpc":"2.0","result":[{"name":"A","address":"algo25","type":"Algo25"},{"name":"B","address":"hd","type":"HDWallet"},{"name":"","address":"quantum","type":"Quantum"},{"name":"D","address":"hardware","type":"Hardware"},{"name":"E","address":"multisig","type":"Multisig"},{"name":"F","address":"watch","type":"Unsignable"},{"name":"G","address":"rekeyed-signable","type":"RekeyedSignable"},{"name":"H","address":"rekeyed-unsignable","type":"RekeyedUnsignable"}]}' +
                ');',
        )
    })
})
