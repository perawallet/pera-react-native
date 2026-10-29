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
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'

import {
    chainAccountOf,
    hdIndexOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { mockIndexerSearchForAccounts } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { useKMS } from '@perawallet/wallet-core-kms'
import { mockAccountFastLookup } from '@perawallet/wallet-core-shared/test-handlers'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { SearchAccountsScreen } from '@modules/onboarding/screens/SearchAccountsScreen/SearchAccountsScreen'

import { ethereumAddressAt } from './__fixtures__/hd-addresses'
import {
    HD_TEST_ADDRESS,
    HD_TEST_MNEMONIC_24_INDICES,
} from './__fixtures__/onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? {
                      mainnet: 'https://ethereum.rpc.test/',
                      sepolia: 'https://ethereum.rpc.test/',
                  }
                : actual.chainEndpointsFor(chainId),
    }
})

const ETHEREUM_RPC_URL = 'https://ethereum.rpc.test/'

// `exitAccountFlow` resets to the tab bar once the scan ends.
const TabBarStub = () => null

const titlesShown = () =>
    vi.mocked(Notifier.showNotification).mock.calls.map(call => call[0].title)

const createPeraWalletWithAlgorandOnly = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let seedId = ''
    await act(async () => {
        const created = await kms.current.createHDWalletKey({
            mnemonicIndices: HD_TEST_MNEMONIC_24_INDICES,
        })
        expect(created).not.toBeNull()
        seedId = created!.seedKey.id
    })
    return useAccountsStore
        .getState()
        .addChainAccount(seedId, 'algorand', { account: 0, keyIndex: 0 }, 'HD')
}

const scanFor = (account: WalletAccount) =>
    renderWithNavigation(SearchAccountsScreen, 'SearchAccounts', {
        initialParams: { account },
        additionalScreens: [{ name: 'TabBar', component: TabBarStub }],
    })

describe('Flow: scan for new accounts on a wallet created in Pera', () => {
    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        vi.mocked(Notifier.showNotification).mockClear()
    })

    it('Given a wallet created in Pera whose seed was used at Ethereum key index 3 elsewhere, when the user scans for new accounts, then an account at 0/3 holding Ethereum is added as discovery and the scan says so', async () => {
        const usedElsewhere = await ethereumAddressAt(0, 3)
        server.use(
            mockAccountFastLookup({
                address: HD_TEST_ADDRESS,
                response: { account_exists: true },
            }),
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            mockIndexerSearchForAccounts(),
            ...evmRpcHandlers({
                rpcUrl: ETHEREUM_RPC_URL,
                responses: {
                    eth_getTransactionCount: params =>
                        String(params[0]).toLowerCase() ===
                        usedElsewhere.toLowerCase()
                            ? '0x1'
                            : '0x0',
                },
            }),
        )
        const account = await createPeraWalletWithAlgorandOnly()

        scanFor(account)

        await waitFor(
            () => expect(useAccountsStore.getState().accounts).toHaveLength(2),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        const added = useAccountsStore
            .getState()
            .accounts.find(
                held =>
                    hdIndexOf(held)?.keyIndex === 3 && held.id !== account.id,
            )
        expect(hdIndexOf(added!)).toEqual({ account: 0, keyIndex: 3 })
        expect(chainAccountOf(added!, 'ethereum')).toMatchObject({
            address: usedElsewhere,
            enabledBy: 'discovery',
        })
        await waitFor(() =>
            expect(titlesShown()).toContain(
                'onboarding.searching_accounts.rescan_found_title',
            ),
        )
    })

    it('Given that scan already ran, when the user scans again, then the accounts are unchanged, the scan says nothing new was found, and every derived key in secure storage belongs to an account', async () => {
        const usedElsewhere = await ethereumAddressAt(0, 3)
        server.use(
            mockAccountFastLookup({
                address: HD_TEST_ADDRESS,
                response: { account_exists: true },
            }),
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            mockIndexerSearchForAccounts(),
            ...evmRpcHandlers({
                rpcUrl: ETHEREUM_RPC_URL,
                responses: {
                    eth_getTransactionCount: params =>
                        String(params[0]).toLowerCase() ===
                        usedElsewhere.toLowerCase()
                            ? '0x1'
                            : '0x0',
                },
            }),
        )
        const account = await createPeraWalletWithAlgorandOnly()
        scanFor(account)
        await waitFor(
            () =>
                expect(titlesShown()).toContain(
                    'onboarding.searching_accounts.rescan_found_title',
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        const afterFirst = useAccountsStore.getState().accounts
        cleanup()
        vi.mocked(Notifier.showNotification).mockClear()

        scanFor(afterFirst.find(held => held.id === account.id)!)

        await waitFor(
            () =>
                expect(titlesShown()).toContain(
                    'onboarding.searching_accounts.no_new_addresses_title',
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(useAccountsStore.getState().accounts).toEqual(afterFirst)
        const referenced = new Set(
            afterFirst.flatMap(held =>
                Object.values(held.chains).flatMap(entry =>
                    entry?.keyPairId ? [entry.keyPairId] : [],
                ),
            ),
        )
        const orphans = getKeystoreStore()
            .state.keys.filter(
                key =>
                    key.type.startsWith('hd-derived') &&
                    !referenced.has(key.id),
            )
            .map(key => key.id)
        expect(orphans).toEqual([])
        expect(getKeystoreStore().state.keys.map(key => key.id)).toEqual(
            expect.arrayContaining([...referenced]),
        )
    })
})
