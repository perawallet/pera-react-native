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
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { http, type RequestHandler } from 'msw'

import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    EVM_CHAIN_NETWORKS,
    type ChainId,
    type EvmChainId,
} from '@perawallet/wallet-core-chain-contract'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { useKMS, type HDWalletKeyResult } from '@perawallet/wallet-core-kms'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { isElementDisabled } from '@test-utils/rnw'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen/NameAccountScreen'
import { ImportPrivateKeyScreen } from '@modules/onboarding/screens/ImportPrivateKeyScreen/ImportPrivateKeyScreen'
import { useReceiveFundsStore } from '@modules/transactions/hooks/receive-funds/useReceiveFunds'
import { ChainSelectionScreen } from '@modules/transactions/screens/receive-funds/ChainSelectionScreen/ChainSelectionScreen'
import { QRViewScreen } from '@modules/transactions/screens/receive-funds/QRViewScreen/QRViewScreen'

import { HD_TEST_MNEMONIC_24_INDICES } from './__fixtures__/onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const EVM_CHAINS = Object.keys(EVM_CHAIN_NETWORKS) as EvmChainId[]
const rpcUrlOf = (chainId: string) => `https://${chainId}.rpc.test/`

// The integration setup registers whichever chains config enables, and hands
// each chain the endpoints config gives it: here every EVM chain gets its own.
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
            chains: {
                enabled: ['algorand', ...Object.keys(networks)],
                capabilities: {},
            },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId in networks
                ? Object.fromEntries(
                      networks[chainId as keyof typeof networks].networks.map(
                          ({ id }) => [id, `https://${chainId}.rpc.test/`],
                      ),
                  )
                : actual.chainEndpointsFor(chainId),
    }
})

// Hardhat's first development account: a published test key.
const TEST_PRIVATE_KEY =
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_PRIVATE_KEY_ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'

/** Every JSON-RPC method each chain's node received. */
const rpcCalls = new Map<string, string[]>()

const handlersFor = (activeChains: readonly ChainId[]): RequestHandler[] =>
    EVM_CHAINS.flatMap(chainId => {
        const url = rpcUrlOf(chainId)
        const [mainnet] = EVM_CHAIN_NETWORKS[chainId].networks
        return [
            http.post(url, async ({ request }) => {
                const body = (await request
                    .clone()
                    .json()
                    .catch(() => undefined)) as
                    | { method?: string }
                    | { method?: string }[]
                    | undefined
                const methods = (Array.isArray(body) ? body : [body]).flatMap(
                    entry => (entry?.method ? [entry.method] : []),
                )
                rpcCalls.set(chainId, [
                    ...(rpcCalls.get(chainId) ?? []),
                    ...methods,
                ])
                return undefined
            }),
            ...evmRpcHandlers({
                rpcUrl: url,
                responses: {
                    eth_chainId: `0x${mainnet!.eip155ChainId.toString(16)}`,
                    eth_getTransactionCount: activeChains.includes(chainId)
                        ? '0x1'
                        : '0x0',
                },
            }),
        ]
    })

const seedEthereumOnlyHdAccount = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let rootKey: HDWalletKeyResult | null = null
    await act(async () => {
        rootKey = await kms.current.createHDWalletKey({
            mnemonicIndices: HD_TEST_MNEMONIC_24_INDICES,
        })
        expect(rootKey).not.toBeNull()
    })
    return useAccountsStore
        .getState()
        .addChainAccount(
            rootKey!.seedKey.id,
            'ethereum',
            { account: 0, keyIndex: 0 },
            'HD',
        )
}

describe('Flow: an account enables chains as it is used on them', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetTestKeystore()
        rpcCalls.clear()
        useAccountsStore.getState().setAccounts([])
        useReceiveFundsStore.getState().reset()
    })

    it('Given an HD account on Ethereum alone, when the user adds Base on Choose Network, then Base joins it at the same address, the list stays open, and the Base row opens its QR', async () => {
        server.use(...handlersFor([]))
        const account = await seedEthereumOnlyHdAccount()
        const ethereumAddress = chainAccountOf(account, 'ethereum')!.address
        useReceiveFundsStore.getState().setSelectedAccount(account)
        useReceiveFundsStore.getState().setCanSelectAccount(false)

        renderWithNavigation(ChainSelectionScreen, 'ChainSelection', {
            additionalScreens: [{ name: 'QRView', component: QRViewScreen }],
        })

        for (const chainId of [
            'base',
            'bsc',
            'arbitrum',
            'avalanche',
            'polygon',
        ]) {
            expect(
                screen.getByTestId(`receive_chain_add_${chainId}`),
            ).toBeTruthy()
        }
        expect(screen.queryByTestId('receive_chain_add_ethereum')).toBeNull()
        // EVM chains share one address, so a chain not added yet shows it too.
        expect(
            screen.getAllByText(
                addressCodecs.get('ethereum').truncate(ethereumAddress),
            ),
        ).toHaveLength(6)
        // Algorand is another family: receive doesn't offer it.
        expect(screen.queryByTestId('receive_chain_row_algorand')).toBeNull()

        fireEvent.click(screen.getByTestId('receive_chain_add_base'))

        await waitFor(
            () =>
                expect(
                    screen.queryByTestId('receive_chain_add_base'),
                ).toBeNull(),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(screen.queryByTestId('QRCode')).toBeNull()

        fireEvent.click(screen.getByTestId('receive_chain_row_base'))

        const checksummed = addressCodecs.get('base').normalize(ethereumAddress)
        expect(screen.getByText(checksummed)).toBeTruthy()
        const [held] = useAccountsStore.getState().accounts
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        expect(chainAccountOf(held!, 'base')).toMatchObject({
            address: ethereumAddress,
            enabledBy: 'user',
        })
        await waitFor(
            () =>
                expect(rpcCalls.get('base')).toEqual(
                    expect.arrayContaining([
                        expect.stringMatching(/^eth_(call|getBalance)$/),
                    ]),
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
    })

    it('Given a key with activity on Ethereum and Polygon, when it is imported, then one account holds exactly those two chains, and importing it again adds nothing', async () => {
        server.use(...handlersFor(['ethereum', 'polygon']))
        const renderImport = () =>
            renderWithNavigation(ImportPrivateKeyScreen, 'ImportPrivateKey', {
                initialParams: { chainId: 'ethereum' },
                additionalScreens: [
                    { name: 'NameAccount', component: NameAccountScreen },
                ],
            })
        const submitKey = async () => {
            const input = await waitFor(() =>
                screen.getByTestId('import_private_key_input'),
            )
            fireEvent.change(input, { target: { value: TEST_PRIVATE_KEY } })
            await waitFor(() =>
                expect(
                    isElementDisabled(
                        screen.getByTestId('import_private_key_submit_button'),
                    ),
                ).toBe(false),
            )
            fireEvent.click(
                screen.getByTestId('import_private_key_submit_button'),
            )
        }

        const first = renderImport()
        await submitKey()

        await waitFor(
            () => expect(useAccountsStore.getState().accounts).toHaveLength(1),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        const [imported] = useAccountsStore.getState().accounts
        expect(Object.keys(imported!.chains).sort()).toEqual([
            'ethereum',
            'polygon',
        ])
        for (const chainId of ['ethereum', 'polygon'] as const) {
            expect(chainAccountOf(imported!, chainId)).toMatchObject({
                enabledBy: 'discovery',
            })
            expect(
                chainAccountOf(imported!, chainId)?.address.toLowerCase(),
            ).toBe(TEST_PRIVATE_KEY_ADDRESS)
        }
        first.unmount()

        renderImport()
        await submitKey()

        await waitFor(() =>
            expect(
                isElementDisabled(
                    screen.getByTestId('import_private_key_submit_button'),
                ),
            ).toBe(true),
        )
        expect(useAccountsStore.getState().accounts).toEqual([imported])
    })
})
