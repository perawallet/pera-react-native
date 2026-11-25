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

// An EVM dApp in the in-app browser: its page posts EIP-1193 requests to the
// WebView transport, which the registry's injected-provider handler answers
// through the real connection sheet, signing adapter and review sheet.

import React, { useEffect, useRef } from 'react'
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
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { getAllPressables, isElementDisabled } from '@test-utils/rnw'
import { useSigningStore } from '@packages/signing/src/store'
import { __resetSigningActorRegistryForTests } from '@packages/signing/src/hooks/useSigningActorLifecycle'
import {
    SENDER,
    SIGNER_KEY_PAIR_ID,
    VIEM_HELLO_WORLD,
    vectorSignature,
} from '@packages/chain-ethereum/src/__tests__/testing'
import {
    getAccountAddedTokens,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    erc20CallResponder,
    evmRpcHandlers,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import {
    resetConnectionPairingStateForTesting,
    useConnectionRegistry,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ConnectionsProvider } from '@modules/connections/shell'
import { SigningOverlays } from '@modules/signing/shell'
import { webViewDappTransport } from '@modules/webview'

const { RPC_URL } = vi.hoisted(() => ({
    RPC_URL: 'https://mainnet.rpc.test/',
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            reownProjectId: 'integration-project-id',
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : actual.chainEndpointsFor(chainId),
    }
})

const ORIGIN = 'https://app.uniswap.org'
const CONNECTION_ID = `dapp-eip1193:${ORIGIN}`
const HELLO_WORLD_HEX = '0x68656c6c6f20776f726c64'
const CONFIRM_SLIDE = 'message-signing-confirm-slide'

const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'inapp-eth-account',
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: SENDER, keyPairId: SIGNER_KEY_PAIR_ID } },
    name: 'Ether',
}

// A second account on the same key, so switching to it stays signable.
const SECOND_ADDRESS = '0x00000000000000000000000000000000000000a2'
const SECOND_ACCOUNT: WalletAccount = {
    id: 'inapp-eth-second',
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 1 },
    },
    chains: {
        ethereum: { address: SECOND_ADDRESS, keyPairId: SIGNER_KEY_PAIR_ID },
    },
    name: 'Second',
}

const captured: { registry?: ConnectionRegistryClient } = {}
const CaptureRegistry = () => {
    captured.registry = useConnectionRegistry()
    return null
}

const inject = vi.fn()
const page = { currentUrl: () => `${ORIGIN}/swap`, inject }

// The once-per-device request FAQ is pre-acknowledged so it cannot open a
// competing sheet.
const ConnectionsWithSigning = () => {
    const { setPreference } = usePreferences()
    const acknowledged = useRef(false)
    useEffect(() => {
        if (acknowledged.current) return
        acknowledged.current = true
        setPreference('hasSeenTransactionRequestFAQ', true)
    }, [setPreference])

    return (
        <ConnectionsProvider>
            <CaptureRegistry />
            <SigningOverlays />
        </ConnectionsProvider>
    )
}

const findButton = (label: string): Optional<HTMLButtonElement> =>
    getAllPressables().find(button =>
        (button.textContent ?? '').includes(label),
    ) as Optional<HTMLButtonElement>

type Answer = {
    id: string
    result?: unknown
    error?: { code: number; message: string }
}

const answers = (): Answer[] =>
    inject.mock.calls.flatMap(([script]) => {
        const match = /deliver\((\{.*\})\);/.exec(String(script))
        return match ? [JSON.parse(match[1]) as Answer] : []
    })

const notificationsOf = (method: string): unknown[] =>
    inject.mock.calls.flatMap(([script]) => {
        const match = /deliver\((\{.*\})\);/.exec(String(script))
        if (!match) return []
        const message = JSON.parse(match[1]) as {
            method?: string
            params?: unknown
        }
        return message.method === method ? [message.params] : []
    })

const answerOf = (id: string): Promise<Answer> =>
    waitFor(
        () => {
            const answer = answers().find(candidate => candidate.id === id)
            if (!answer) throw new Error(`no answer for ${id}`)
            return answer
        },
        { timeout: 15_000 },
    )

const request = (
    id: string,
    method: string,
    params: unknown[] = [],
    hasUserActivation = true,
) =>
    act(() => {
        webViewDappTransport.receive(
            page,
            {
                provider: 'eip1193',
                token: 'unused',
                hasUserActivation,
                request: { jsonrpc: '2.0', id, method, params },
            },
            `${ORIGIN}/swap`,
        )
    })

const connect = async () => {
    request('connect', 'eth_requestAccounts')
    await waitFor(() => {
        expect(findButton('common.connect.label')).toBeTruthy()
    })
    // The one EVM account is preselected in the row; nothing to tick.
    const row = 'wc_evm_account_row'
    await waitFor(() => expect(screen.getByTestId(row)).toBeTruthy(), {
        timeout: 5000,
    })
    await waitFor(() => {
        expect(isElementDisabled(findButton('common.connect.label')!)).toBe(
            false,
        )
    })
    fireEvent.click(findButton('common.connect.label')!)
    return answerOf('connect')
}

describe('Flow: an EVM dApp in the in-app browser', () => {
    setSuiteUnhandledRequestMode('bypass')
    let detach: () => void

    beforeAll(setupTestDatabase)
    afterAll(teardownTestDatabase)

    beforeEach(async () => {
        await resetTestDatabase()
        __resetSigningActorRegistryForTests()
        useSigningStore.getState().resetState()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([ETHEREUM_ACCOUNT])
        await getProvider().connections.store.clear()
        resetConnectionPairingStateForTesting()
        vi.clearAllMocks()
        setCapabilityOverrides({ dappConnect: true }, 'ethereum')
        vi.spyOn(kmsCore, 'sign').mockImplementation(async (_id, payload) =>
            vectorSignature(payload),
        )
        server.use(http.get('*/v1/projects/', () => HttpResponse.json([])))
        detach = webViewDappTransport.attach(page)
        renderWithNavigation(ConnectionsWithSigning, 'ConnectionsWithSigning')
    })

    afterEach(async () => {
        detach()
        vi.restoreAllMocks()
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    it('Given a tap on Connect, when the user picks the EVM account, then the page is told that account and the site is recorded', async () => {
        const answer = await connect()

        expect(answer.result).toEqual([SENDER])
        expect(
            await getProvider().connections.store.get(CONNECTION_ID),
        ).toMatchObject({
            kind: 'dapp-eip1193',
            accounts: [SENDER],
        })
    })

    it('Given a connected site, when the account is changed from Pera, then the page is told the new account and the site holds only it', async () => {
        useAccountsStore
            .getState()
            .setAccounts([ETHEREUM_ACCOUNT, SECOND_ACCOUNT])
        await connect()

        await act(async () => {
            await captured.registry!.changeAccount(
                CONNECTION_ID,
                'ethereum',
                SECOND_ADDRESS,
            )
        })

        await waitFor(() =>
            expect(notificationsOf('accountsChanged')).toContainEqual([
                SECOND_ADDRESS,
            ]),
        )
        expect(
            await getProvider().connections.store.get(CONNECTION_ID),
        ).toMatchObject({ accounts: [SECOND_ADDRESS] })
    })

    it('Given no user gesture, when the page asks for accounts, then it is answered 4100 and no sheet opens', async () => {
        request('quiet', 'eth_requestAccounts', [], false)

        const answer = await answerOf('quiet')

        expect(answer.error?.code).toBe(4100)
        expect(findButton('common.connect.label')).toBeUndefined()
    })

    it('Given a connected site, when it asks to switch to a chain Pera does not serve, then it is answered 4902 without a sheet', async () => {
        await connect()

        request('switch', 'wallet_switchEthereumChain', [{ chainId: '0x82' }])

        expect((await answerOf('switch')).error?.code).toBe(4902)
        expect(findButton('common.connect.label')).toBeUndefined()
    })

    it('Given a connected site, when it asks for personal_sign and the user slides to confirm, then the page receives the signature', async () => {
        await connect()

        request('sign', 'personal_sign', [HELLO_WORLD_HEX, SENDER])
        await waitFor(
            () => expect(screen.getByTestId(CONFIRM_SLIDE)).toBeTruthy(),
            { timeout: 15_000 },
        )
        fireEvent.click(screen.getByTestId(CONFIRM_SLIDE))

        expect((await answerOf('sign')).result).toBe(VIEM_HELLO_WORLD)
    })

    describe('wallet_watchAsset', () => {
        const WATCHED_TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

        const watch = async () => {
            server.use(
                ...evmRpcHandlers({
                    responses: {
                        eth_call: erc20CallResponder({
                            [WATCHED_TOKEN]: {
                                name: 'USD Coin',
                                symbol: 'USDC',
                                decimals: 6,
                                totalSupply: 1_000_000_000_000n,
                            },
                        }),
                    },
                }),
            )
            await connect()
            request('watch', 'wallet_watchAsset', [
                {
                    type: 'ERC20',
                    options: {
                        address: WATCHED_TOKEN,
                        symbol: 'FAKE',
                        decimals: 2,
                    },
                },
            ])
            await waitFor(
                () => {
                    expect(screen.getByText('USDC')).toBeTruthy()
                    expect(
                        isElementDisabled(
                            findButton('walletconnect.watch_asset.confirm')!,
                        ),
                    ).toBe(false)
                },
                { timeout: 15_000 },
            )
        }

        const addedTokens = () =>
            getAccountAddedTokens({
                sources: [{ address: SENDER, scope: ETH_SCOPE }],
            })

        it('Given a connected site, when it asks to watch an ERC-20 and the user adds it, then the page receives true and the token is on the account', async () => {
            await watch()
            expect(screen.queryByText('FAKE')).toBeNull()

            fireEvent.click(findButton('walletconnect.watch_asset.confirm')!)

            expect((await answerOf('watch')).result).toBe(true)
            expect(await addedTokens()).toEqual([
                {
                    scope: ETH_SCOPE,
                    assetId: WATCHED_TOKEN,
                    hasBalance: false,
                },
            ])
        })

        it('Given a connected site, when it asks to watch an ERC-20 and the user cancels, then the page receives 4001 and nothing is added', async () => {
            await watch()

            fireEvent.click(findButton('common.cancel.label')!)

            expect((await answerOf('watch')).error?.code).toBe(4001)
            expect(await addedTokens()).toEqual([])
        })
    })
})
