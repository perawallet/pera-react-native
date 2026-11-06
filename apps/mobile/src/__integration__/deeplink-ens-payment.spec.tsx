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

// An ethereum: link that names an ENS name resolves it through Pera's backend
// and has ENS on Ethereum L1 confirm the address before send opens. Nothing is
// prefilled when it can't be confirmed. Copy is asserted by key: this project
// renders i18n keys.

import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { server } from '@test-utils/msw-server'
import {
    ALICE_BASE,
    ALICE_ETHEREUM,
    COIN_TYPE_ETHEREUM,
    L1_RPC,
    searchResult,
} from './__fixtures__/ens-send'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    const { L1_RPC } = await import('./__fixtures__/ens-send')
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: {
                enabled: ['algorand', 'ethereum'],
                capabilities: {},
            },
        },
        hasPeraBackend: (
            scope: Parameters<typeof withBackend.hasPeraBackend>[0],
        ) =>
            scope.chainId === 'algorand'
                ? withBackend.hasPeraBackend(scope)
                : true,
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) => {
            return chainId === 'ethereum'
                ? { mainnet: [L1_RPC], sepolia: [L1_RPC] }
                : withBackend.chainEndpointsFor(chainId)
        },
    }
})

// The Pera query client reads its deployments once, before this file's config
// mock exists, so everything under test is loaded afresh.
vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { waitFor } = await import('@testing-library/react')
const { Linking } = await import('react-native')
const { Notifier } = await import('react-native-notifier')
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { ensResolverCallResponder, evmRpcHandlers } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { mockNameSearch } =
    await import('@perawallet/wallet-core-nfd/test-handlers')
const { render } = await import('@test-utils/render')
const { useBottomSheetStore } = await import('@modules/bottom-sheet')
const { ConnectionsProvider } = await import('@modules/connections/shell')
const { resetDeeplinkListenerStateForTesting, useDeeplinkListener } =
    await import('@modules/deeplink/hooks/useDeeplinkListener')
const { useSendFundsStore } = await import('@modules/transactions')
const { SendFundsContent } = await import('@modules/transactions/routes')
const { registerAppBottomSheets } =
    await import('../bootstrap/bottom-sheet-registrations')
const { SLOW_WAIT_TIMEOUT_MS } = await import('./__fixtures__/timeouts')

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const ETHER_NAME_LINK = 'ethereum:alice.eth@1?value=1'
const TOKEN_NAME_LINK = `ethereum:${TOKEN}@1/transfer?address=alice.eth&uint256=1`

const SENDER: WalletAccount = {
    id: 'eth-sender',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: {
        ethereum: {
            address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            keyPairId: 'eth-key',
        },
    },
    name: 'Eth sender',
} as WalletAccount

type UrlListener = (event: { url: string }) => void
const captured: { urlListener: Optional<UrlListener> } = {
    urlListener: undefined,
}

const OsLinkListener = () => {
    useDeeplinkListener()
    return null
}

const openedSheets = () =>
    useBottomSheetStore
        .getState()
        .requests.map(request => (request.contents as { type: unknown }).type)

const expectToastTitled = (title: string) =>
    waitFor(
        () =>
            expect(Notifier.showNotification).toHaveBeenCalledWith(
                expect.objectContaining({ title }),
            ),
        { timeout: SLOW_WAIT_TIMEOUT_MS },
    )

const backendFinds = (...results: ReturnType<typeof searchResult>[]) =>
    mockNameSearch({ response: { count: results.length, results } })

const l1Holds = (address: `0x${string}`) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: L1_RPC,
            responses: {
                eth_call: ensResolverCallResponder([
                    {
                        name: 'alice.eth',
                        coinType: COIN_TYPE_ETHEREUM,
                        address,
                    },
                ]),
            },
        }),
    )

const receive = async (url: string) => {
    render(
        <ConnectionsProvider>
            <OsLinkListener />
        </ConnectionsProvider>,
    )
    await waitFor(() => expect(captured.urlListener).toBeTruthy())
    captured.urlListener!({ url })
}

describe('Flow: an ethereum: link that names an ENS name', () => {
    beforeAll(() => {
        registerAppBottomSheets()
    })

    beforeEach(() => {
        resetDeeplinkListenerStateForTesting()
        captured.urlListener = undefined
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        useSendFundsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
        vi.mocked(Linking.getInitialURL).mockResolvedValue(null)
        vi.mocked(Linking.canOpenURL).mockResolvedValue(false)
        vi.mocked(Linking.addEventListener).mockImplementation(((
            _type: string,
            listener: UrlListener,
        ) => {
            captured.urlListener = listener
            return { remove: vi.fn() }
        }) as unknown as typeof Linking.addEventListener)
        useAccountsStore.getState().setAccounts([SENDER])
        useAccountsStore.getState().setSelectedAccountId('eth-sender')
        server.use(...evmRpcHandlers({ rpcUrl: L1_RPC }))
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useSendFundsStore.getState().reset()
    })

    it("Given ENS confirms the backend's address, when the OS hands Pera the link, then send opens to that address", async () => {
        server.use(
            backendFinds(searchResult('alice.eth', ALICE_ETHEREUM, 'eip155:1')),
        )
        l1Holds(ALICE_ETHEREUM.toLowerCase() as `0x${string}`)

        await receive(ETHER_NAME_LINK)

        await waitFor(
            () =>
                expect(useSendFundsStore.getState().destination).toBe(
                    ALICE_ETHEREUM,
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(openedSheets()).toEqual([SendFundsContent])
    })

    it('Given a token transfer link whose recipient is an ENS name, then send opens to the resolved recipient', async () => {
        server.use(
            backendFinds(searchResult('alice.eth', ALICE_ETHEREUM, 'eip155:1')),
        )
        l1Holds(ALICE_ETHEREUM.toLowerCase() as `0x${string}`)

        await receive(TOKEN_NAME_LINK)

        await waitFor(
            () =>
                expect(useSendFundsStore.getState().destination).toBe(
                    ALICE_ETHEREUM,
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(useSendFundsStore.getState().selectedAsset).toEqual({
            chainId: 'ethereum',
            assetId: TOKEN,
        })
    })

    it("Given ENS holds another address than the backend's, then the user is told the name doesn't match and send does not open", async () => {
        server.use(
            backendFinds(searchResult('alice.eth', ALICE_ETHEREUM, 'eip155:1')),
        )
        l1Holds(ALICE_BASE.toLowerCase() as `0x${string}`)

        await receive(ETHER_NAME_LINK)

        await expectToastTitled('send_funds.destination.ens_mismatch_title')
        expect(useSendFundsStore.getState().destination).toBeUndefined()
        expect(openedSheets()).toEqual([])
    })

    it('Given the backend cannot be reached, then the user is told ENS could not verify the name and send does not open', async () => {
        server.use(
            mockNameSearch({
                response: { count: 0, results: [] },
                status: 503,
            }),
        )

        await receive(ETHER_NAME_LINK)

        await expectToastTitled('send_funds.destination.ens_unavailable_title')
        expect(useSendFundsStore.getState().destination).toBeUndefined()
        expect(openedSheets()).toEqual([])
    })

    it('Given the name has no record, then the user is told it was not found and send does not open', async () => {
        server.use(backendFinds())

        await receive(ETHER_NAME_LINK)

        await expectToastTitled('deeplink.error.title_name_not_found')
        expect(useSendFundsStore.getState().destination).toBeUndefined()
        expect(openedSheets()).toEqual([])
    })
})
