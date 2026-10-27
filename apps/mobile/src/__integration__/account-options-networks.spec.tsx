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

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import * as Clipboard from 'expo-clipboard'

import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    EVM_CHAIN_NETWORKS,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { server } from '@test-utils/msw-server'
import { render } from '@test-utils/render'
import { longPress } from '@test-utils/rnw'
import { AccountOptionsContent } from '@modules/accounts/components/AccountOptionsContent'

import {
    hdSiblingOf,
    seedHdAccount,
    SheetHost,
} from './__fixtures__/accountOptions'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const ETHEREUM_RPC_URL = 'https://ethereum.rpc.test/'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    const { EVM_CHAIN_NETWORKS: networks } = await vi.importActual<
        typeof import('@perawallet/wallet-core-chain-contract')
    >('@perawallet/wallet-core-chain-contract')
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
                ? Object.fromEntries(
                      networks.ethereum.networks.map(({ id }) => [
                          id,
                          'https://ethereum.rpc.test/',
                      ]),
                  )
                : actual.chainEndpointsFor(chainId),
    }
})

const AccountOptionsHost = ({
    account,
    onShowAddress = () => {},
}: {
    account: WalletAccount
    onShowAddress?: (account: WalletAccount, chainId: ChainId) => void
}) => (
    <SheetHost
        contents={
            <AccountOptionsContent
                account={account}
                onShowAddress={onShowAddress}
            />
        }
    />
)

describe('Flow: the account options sheet lists the account on each network', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        vi.mocked(Clipboard.setStringAsync).mockClear()
        const [mainnet] = EVM_CHAIN_NETWORKS.ethereum.networks
        server.use(
            ...evmRpcHandlers({
                rpcUrl: ETHEREUM_RPC_URL,
                responses: {
                    eth_chainId: `0x${mainnet!.eip155ChainId.toString(16)}`,
                    eth_getTransactionCount: '0x0',
                },
            }),
        )
    })

    it('Given an HD account on Algorand alone, when the user adds Ethereum, then its row gains copy and QR in the open sheet, and copy writes the EIP-55 address', async () => {
        const account = await seedHdAccount()
        const onShowAddress = vi.fn()

        render(
            <AccountOptionsHost
                account={account}
                onShowAddress={onShowAddress}
            />,
        )

        await screen.findByTestId('account_option_rename-account')
        expect(
            screen.getByTestId('account_option_toggle-notifications'),
        ).toBeTruthy()
        expect(screen.getByTestId('account_option_remove-account')).toBeTruthy()
        expect(
            screen.getByTestId('account_option_view-passphrase'),
        ).toBeTruthy()
        expect(screen.getByTestId('account-type-info-button')).toBeTruthy()
        expect(screen.getByTestId('account_network_algorand_copy')).toBeTruthy()
        expect(screen.getByTestId('account_network_algorand_qr')).toBeTruthy()
        expect(
            screen.getByTestId('account_network_algorand_expand'),
        ).toBeTruthy()
        expect(screen.queryByTestId('account_network_ethereum_copy')).toBeNull()

        fireEvent.click(screen.getByTestId('account_network_ethereum_add'))

        await waitFor(
            () =>
                expect(
                    screen.getByTestId('account_network_ethereum_copy'),
                ).toBeTruthy(),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(screen.getByTestId('account_network_ethereum_qr')).toBeTruthy()
        expect(screen.queryByTestId('account_network_ethereum_add')).toBeNull()
        const [held] = useAccountsStore.getState().accounts
        const ethereumAddress = chainAccountOf(held!, 'ethereum')!.address
        expect(chainAccountOf(held!, 'ethereum')?.enabledBy).toBe('user')

        fireEvent.click(screen.getByTestId('account_network_ethereum_copy'))

        await waitFor(() =>
            expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
                addressCodecs.get('ethereum').normalize(ethereumAddress),
            ),
        )
    })

    it('Given Ethereum added in the open sheet, when the user taps its QR, then receive gets the account as it now is, on Ethereum', async () => {
        const account = await seedHdAccount()
        const onShowAddress = vi.fn()

        render(
            <AccountOptionsHost
                account={account}
                onShowAddress={onShowAddress}
            />,
        )

        fireEvent.click(
            await screen.findByTestId('account_network_ethereum_add'),
        )
        fireEvent.click(
            await screen.findByTestId(
                'account_network_ethereum_qr',
                {},
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            ),
        )

        expect(onShowAddress).toHaveBeenCalledTimes(1)
        const [shownAccount, chainId] = onShowAddress.mock.calls[0]!
        expect(chainId).toBe('ethereum')
        expect(shownAccount.id).toBe(account.id)
        expect(chainAccountOf(shownAccount, 'ethereum')).toBeDefined()
        expect(chainAccountOf(shownAccount, 'ethereum')?.address).toBe(
            chainAccountOf(useAccountsStore.getState().accounts[0]!, 'ethereum')
                ?.address,
        )
        expect(chainAccountOf(account, 'ethereum')).toBeUndefined()
    })

    it('Given an HD account, when the user expands the Algorand row, then the min balance shows, then the rekey actions', async () => {
        const account = await seedHdAccount()

        render(<AccountOptionsHost account={account} />)

        expect(screen.queryByTestId('account_option_rekey-account')).toBeNull()
        fireEvent.click(
            await screen.findByTestId('account_network_algorand_expand'),
        )

        const minBalance = await screen.findByTestId(
            'account_algorand_min_balance',
        )
        const rekey = screen.getByTestId('account_option_rekey-account')
        const scan = screen.getByTestId('account_option_scan-rekeyed')
        expect(
            minBalance.compareDocumentPosition(rekey) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
        expect(
            rekey.compareDocumentPosition(scan) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
    })

    it('Given an Algorand watch account, then it offers no passphrase, no rekey section and no Ethereum to add', async () => {
        const watch: WalletAccount = {
            id: 'watch',
            custody: { kind: 'watch' },
            chains: { algorand: { address: HD_TEST_ADDRESS } },
            name: 'Watched',
        }
        useAccountsStore.getState().setAccounts([watch])

        render(<AccountOptionsHost account={watch} />)

        await screen.findByTestId('account_network_algorand_copy')
        expect(
            screen.queryByTestId('account_option_view-passphrase'),
        ).toBeNull()
        expect(
            screen.queryByTestId('account_network_algorand_expand'),
        ).toBeNull()
        expect(screen.queryByTestId('account_option_rekey-account')).toBeNull()
        expect(screen.queryByTestId('account_network_ethereum')).toBeNull()
    })

    it('Given a multichain build, when the sheet opens, then the network rows are headed "Networks"', async () => {
        const account = await seedHdAccount()

        render(<AccountOptionsHost account={account} />)

        expect(
            (await screen.findByTestId('account_networks_title')).textContent,
        ).toBe('account_options.networks_title')
    })

    it('Given an HD account, when the user taps "See wallet structure", then the structure opens as before', async () => {
        const account = await seedHdAccount()

        render(<AccountOptionsHost account={account} />)

        fireEvent.click(
            await screen.findByText('account_info.see_wallet_structure'),
        )

        expect(
            await screen.findByText('account_info.hide_wallet_structure'),
        ).toBeTruthy()
    })

    it("Given two accounts in one Universal Wallet, when the user opens the wallet structure, then the sheet's account is marked Viewing and the other opens to its addresses", async () => {
        const account = await seedHdAccount()
        useAccountsStore
            .getState()
            .setAccounts([account, hdSiblingOf(account, ALGO25_TEST_ADDRESS)])

        render(<AccountOptionsHost account={account} />)
        fireEvent.click(
            await screen.findByText('account_info.see_wallet_structure'),
        )

        expect(await screen.findByText('account_info.viewing')).toBeTruthy()

        const siblingRow = screen.getByTestId(
            'account_structure_row_hd-sibling',
        )
        expect(siblingRow.getAttribute('aria-expanded')).toBe('false')

        fireEvent.click(siblingRow)
        await waitFor(() =>
            expect(siblingRow.getAttribute('aria-expanded')).toBe('true'),
        )
        await longPress(
            await screen.findByTestId('account_structure_address_algorand'),
        )

        await waitFor(() =>
            expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
                ALGO25_TEST_ADDRESS,
            ),
        )
    })
})
