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

// The extension's connect window with real accounts, chains and account rows:
// each account shows by its address on the chain the dApp asked for.

import React from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { SENDER } from '@packages/chain-ethereum/src/__tests__/testing'
import {
    useAccountsStore,
    ownAddressOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { render } from '@test-utils/render'
import {
    EVM_CONNECT_ROW,
    selectEvmConnectAccount,
} from '@test-utils/connect-account'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { WcConnectScreen } from '@modules/dapp/screens/WcConnectScreen'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const dappRequest = vi.hoisted(() => ({
    approval: null as unknown,
    approve: vi.fn(),
    reject: vi.fn(),
}))
vi.mock('@modules/dapp/hooks/useDappRequest.web', () => ({
    useDappRequest: () => ({
        requestId: 'request-1',
        approval: dappRequest.approval,
        isLoading: false,
        approve: dappRequest.approve,
        reject: dappRequest.reject,
        deliveryError: false,
    }),
}))
vi.mock('@hooks/useApprovalArming.web', () => ({
    useApprovalArming: () => true,
}))

const STORED_ETH_ADDRESS = SENDER.toLowerCase()

const UNIVERSAL_ACCOUNT: WalletAccount = {
    id: 'ext-universal',
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 0 },
    },
    chains: {
        algorand: { address: HD_TEST_ADDRESS, keyPairId: 'universal-algo' },
        ethereum: { address: STORED_ETH_ADDRESS, keyPairId: 'universal-eth' },
    },
    name: 'Universal',
}
const ALGO25_ACCOUNT: WalletAccount = {
    id: 'ext-algo25',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'algo25-key' },
    },
    name: 'Trading',
}

const proposalApproval = (
    connectionKind: string,
    chainId: 'algorand' | 'ethereum',
) => ({
    kind: 'connection-proposal',
    requestId: 'request-1',
    proposalId: 'proposal-1',
    connectionKind,
    origin: 'https://dapp.example',
    peer: { name: 'Test dApp', url: 'https://dapp.example', icons: [] },
    requesterOrigin: 'https://dapp.example',
    requested: {
        networks: ['mainnet'],
        chains: [chainId],
        methods:
            chainId === 'ethereum' ? ['eth_accounts'] : ['signTransactions'],
    },
    expiresAt: Date.now() + 60_000,
})

const rowOf = (account: WalletAccount) =>
    screen.getByTestId(`wc_account_row_${account.id}`)

describe("Flow: the extension's connect window lists accounts on the dApp's chain", () => {
    setSuiteUnhandledRequestMode('bypass')

    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetTestKeystore()
        dappRequest.approval = null
        useAccountsStore
            .getState()
            .setAccounts([UNIVERSAL_ACCOUNT, ALGO25_ACCOUNT])
        server.use(http.get('*/v1/projects/', () => HttpResponse.json([])))
        vi.clearAllMocks()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    // A page opened the window, so nothing is preselected: the user picks.
    it('Given an EVM dApp, when the window opens, then no account is chosen and the picker shows the account by its 0x address with the Ethereum badge, without Algorand-only accounts', async () => {
        dappRequest.approval = proposalApproval('dapp-eip1193', 'ethereum')

        render(
            <>
                <WcConnectScreen />
                <BottomSheetManager />
            </>,
        )

        await waitFor(() => screen.getByTestId(EVM_CONNECT_ROW))
        expect(
            within(screen.getByTestId(EVM_CONNECT_ROW)).getByText(
                'walletconnect.request.choose_account',
            ),
        ).toBeTruthy()
        expect(screen.queryByTestId('dapp_connect_no_accounts')).toBeNull()
        fireEvent.click(screen.getByTestId(EVM_CONNECT_ROW))
        const option = `connect_account_picker-${ownAddressOf(UNIVERSAL_ACCOUNT)}`
        await waitFor(() => screen.getByTestId(option))
        const row = screen.getByTestId(option)
        expect(
            within(row).getByText(
                addressCodecs.get('ethereum').truncate(STORED_ETH_ADDRESS),
            ),
        ).toBeTruthy()
        expect(
            within(row).queryByText(
                addressCodecs.get('algorand').truncate(HD_TEST_ADDRESS),
            ),
        ).toBeNull()
        expect(
            screen.queryByTestId(
                `connect_account_picker-${ownAddressOf(ALGO25_ACCOUNT)}`,
            ),
        ).toBeNull()

        fireEvent.click(row)

        await waitFor(() =>
            within(screen.getByTestId(EVM_CONNECT_ROW)).getByTestId(
                'account_avatar_badge',
            ),
        )
        const avatarBadge = within(
            within(screen.getByTestId(EVM_CONNECT_ROW)).getByTestId(
                'account_avatar_badge',
            ),
        ).getByTestId('avatar_badge')
        expect(
            within(avatarBadge).getByTestId('chain_icon_ethereum'),
        ).toBeTruthy()
    })

    it('Given an EVM dApp, when the user picks the account and connects, then the dApp is granted its 0x address', async () => {
        dappRequest.approval = proposalApproval('dapp-eip1193', 'ethereum')
        render(
            <>
                <WcConnectScreen />
                <BottomSheetManager />
            </>,
        )

        await selectEvmConnectAccount(UNIVERSAL_ACCOUNT)
        fireEvent.click(screen.getByTestId('wc-connect-connect'))

        expect(dappRequest.approve).toHaveBeenCalledWith([STORED_ETH_ADDRESS])
    })

    it('Given an Algorand dApp, when the window opens, then both accounts show their Algorand addresses with the Algorand badge', async () => {
        dappRequest.approval = proposalApproval('pera-dapp', 'algorand')

        render(<WcConnectScreen />)

        await waitFor(() => rowOf(UNIVERSAL_ACCOUNT))
        for (const [account, address] of [
            [UNIVERSAL_ACCOUNT, HD_TEST_ADDRESS],
            [ALGO25_ACCOUNT, ALGO25_TEST_ADDRESS],
        ] as const) {
            const row = rowOf(account)
            expect(
                within(row).getByText(
                    addressCodecs.get('algorand').truncate(address),
                ),
            ).toBeTruthy()
            expect(within(row).getByTestId('chain_icon_algorand')).toBeTruthy()
        }
    })

    it('Given only an Algorand-only account and an EVM dApp, when the window opens, then it lists nothing to connect', async () => {
        useAccountsStore.getState().setAccounts([ALGO25_ACCOUNT])
        dappRequest.approval = proposalApproval('dapp-eip1193', 'ethereum')

        render(<WcConnectScreen />)

        await waitFor(() => screen.getByTestId('dapp_connect_no_accounts'))
        expect(
            screen.queryByTestId(`wc_account_row_${ALGO25_ACCOUNT.id}`),
        ).toBeNull()
    })
})
