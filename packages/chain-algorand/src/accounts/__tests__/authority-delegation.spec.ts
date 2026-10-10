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

import '../../__tests__/registerAlgorandAccounts'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { encodeAddress } from 'algosdk'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import {
    accountPresentationChainAdapters,
    authorityOf,
    authorityTransitionLabel,
    delegateTransitionFor,
    useAccountChainStateStore,
    useAccountsStore,
    useLedgerDelegatedScan,
    useRescanDelegatedAccounts,
    useAccountDiscovery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    scopeForLegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import { mockIndexerSearchForAccounts } from '../../test-handlers'
import {
    hardwareAccount,
    hdAccount,
    multisigAccount,
    quantumAccount,
    standaloneAccount,
    watchAccount,
} from '../../__tests__/algorandAccounts'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandAddressCodec } from '../address-codec'
import { algorandAccountPresentation } from '../presentation'

const SCOPE = scopeForLegacyNetwork('mainnet')
const addressOf = (n: number) => encodeAddress(new Uint8Array(32).fill(n))

const AUTHORITY = addressOf(1)
const PARTICIPANT = addressOf(2)
const DELEGATED = addressOf(3)
const HELD = addressOf(4)

type Row = {
    kind: string
    authority: () => WalletAccount
    /** Accounts held beside the authority. */
    others?: () => WalletAccount[]
    /** `null`: the delegated account has no signer to show. */
    transition: {
        signerKey: string
        descriptionKey: string
    } | null
}

const STANDARD = {
    signerKey: 'account_info.rekey_signer_standard',
    descriptionKey: 'account_type_info.rekeyed_standard_description',
}

const ROWS: Row[] = [
    {
        kind: 'standalone',
        authority: () => standaloneAccount(AUTHORITY),
        transition: STANDARD,
    },
    {
        kind: 'hdWallet',
        authority: () => hdAccount(AUTHORITY),
        transition: STANDARD,
    },
    {
        kind: 'quantum',
        authority: () => quantumAccount(AUTHORITY),
        transition: {
            signerKey: 'account_info.rekey_signer_quantum',
            descriptionKey: 'account_type_info.rekeyed_quantum_description',
        },
    },
    {
        kind: 'hardware',
        authority: () => hardwareAccount(AUTHORITY),
        transition: {
            signerKey: 'account_info.rekey_signer_ledger',
            descriptionKey: 'account_type_info.rekeyed_ledger_description',
        },
    },
    {
        kind: 'multisig with a local participant',
        authority: () =>
            multisigAccount(AUTHORITY, {
                version: 1,
                threshold: 1,
                addresses: [PARTICIPANT],
            }),
        others: () => [standaloneAccount(PARTICIPANT)],
        transition: {
            signerKey: 'account_info.rekey_signer_shared',
            descriptionKey: 'account_type_info.rekeyed_shared_description',
        },
    },
    {
        kind: 'watch',
        authority: () => watchAccount(AUTHORITY),
        transition: null,
    },
]

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
    addressCodecs.reset()
    addressCodecs.register(algorandAddressCodec)
    accountPresentationChainAdapters.reset()
    accountPresentationChainAdapters.register(algorandAccountPresentation)
    useAccountsStore.getState().resetState()
    useAccountChainStateStore.getState().resetState()
    server.use(
        mockIndexerSearchForAccounts({
            response: { accounts: [{ address: DELEGATED }, { address: HELD }] },
        }),
    )
})
afterEach(() => server.resetHandlers())

const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
        QueryClientProvider,
        {
            client: new QueryClient({
                defaultOptions: { queries: { retry: false } },
            }),
        },
        children,
    )

describe.each(ROWS)('accounts delegated to a $kind account', row => {
    const hold = (held: WalletAccount[]) =>
        useAccountsStore.getState().setAccounts(held)

    it('discovers each as a watch account recording its authority', async () => {
        hold([row.authority(), ...(row.others?.() ?? [])])
        const { result } = renderHook(() => useAccountDiscovery(SCOPE), {
            wrapper,
        })

        const found = await result.current.discoverDelegatedAccounts({
            accountAddresses: [AUTHORITY],
        })

        expect(found.map(a => a.chains[ALGORAND_CHAIN_ID]?.address)).toEqual([
            DELEGATED,
            HELD,
        ])
        expect(found.map(a => a.custody)).toEqual([
            { kind: 'watch' },
            { kind: 'watch' },
        ])
        expect(found.map(a => authorityOf(a, SCOPE))).toEqual([
            AUTHORITY,
            AUTHORITY,
        ])
    })

    it('splits a rescan into held and importable, then labels what it imports', async () => {
        hold([row.authority(), ...(row.others?.() ?? []), watchAccount(HELD)])
        const { result } = renderHook(() => useRescanDelegatedAccounts(SCOPE), {
            wrapper,
        })

        const sweep = await result.current.scanAll([AUTHORITY])
        expect(sweep).toEqual({
            importedAddresses: [HELD],
            candidates: [{ address: DELEGATED, sourceAddress: AUTHORITY }],
            failedSources: [],
        })

        let imported = 0
        await act(async () => {
            imported = await result.current.importFromSweep(sweep.candidates)
        })
        expect(imported).toBe(1)

        const { accounts } = useAccountsStore.getState()
        const delegated = accounts.find(
            a => a.chains[ALGORAND_CHAIN_ID]?.address === DELEGATED,
        )!
        const transition = delegateTransitionFor(
            delegated,
            accounts,
            ALGORAND_CHAIN_ID,
        )
        if (row.transition === null) {
            expect(transition).toBeNull()
            return
        }
        expect(transition).not.toBeNull()
        expect(
            authorityTransitionLabel(transition!, ALGORAND_CHAIN_ID),
        ).toEqual(
            expect.objectContaining({
                labelKey: 'account_info.type_rekeyed_signer',
                ...row.transition,
            }),
        )
    })
})

describe('Ledger scan', () => {
    it('lists the accounts delegated to a derived Ledger account', async () => {
        const derived = {
            address: AUTHORITY,
            publicKey: new Uint8Array([1]),
            accountIndex: 0,
        }
        useAccountsStore.getState().setAccounts([watchAccount(HELD)])

        const { result } = renderHook(
            () => useLedgerDelegatedScan([derived], SCOPE),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isScanning).toBe(false))
        expect(result.current.delegated).toEqual([
            { kind: 'delegated', address: DELEGATED, authAccount: derived },
        ])
    })
})
