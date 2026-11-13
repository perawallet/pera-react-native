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

// An Ethereum account's standing approvals are listed from what the chain
// says is still live, and revoking one is reviewed as a revoke, sent as a
// zero allowance (or a withdrawn operator), and drops out once it confirms.

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
import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type {
    ChainId,
    ChainScope,
    TokenApproval,
} from '@perawallet/wallet-core-chain-contract'
import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'

type Hex = `0x${string}`

const RPC_URL = 'https://mainnet.rpc.test/'
const PERA_SERVICES = ['assets', 'prices', 'contracts', 'approvals'] as const

// The stand-in navigator can't hand route params across the module reset
// below, so the screen is given its route directly.
const route = vi.hoisted(() => ({ params: {} as Record<string, unknown> }))

vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<typeof import('@react-navigation/native')>()),
    useRoute: () => ({
        name: 'TokenApprovals',
        key: 'k',
        params: route.params,
    }),
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal, ['contracts', 'approvals'])
    return {
        ...withBackend,
        peraServicesFor: (scope: ChainScope) =>
            scope.chainId === 'ethereum'
                ? new Set(PERA_SERVICES)
                : withBackend.peraServicesFor(scope),
        chainEndpointsFor: (chainId: ChainId) =>
            chainId === 'ethereum'
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : withBackend.chainEndpointsFor(chainId),
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so every module under
// test is loaded afresh.
vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { useAssetsQuery } = await import('@perawallet/wallet-core-assets')
const { useSettingsStore } = await import('@perawallet/wallet-core-settings')
const { kmsCore, SeedScheme } = await import('@perawallet/wallet-core-kms')
const { useTokenApprovalsQuery, useRevokeTokenApprovalMutation } =
    await import('@perawallet/wallet-core-transactions')
const {
    contractMetadataResponse,
    DEFAULT_EVM_RPC_RESPONSES,
    evmAllowanceCandidate,
    erc20CallResponder,
    EvmRpcErrorFixture,
    evmApprovalCallResponder,
    evmOperatorCandidate,
    evmRpcHandlers,
    evmRpcTransaction,
    evmTransactionReceipt,
    peraEvmHandlers,
    unknownAssetItem,
} = await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { PERA_URL } =
    await import('@packages/chain-ethereum/src/__tests__/pera-backend')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const {
    drainPendingSignRequests,
    fireEvent,
    renderSignReview,
    screen,
    waitFor,
} = await import('@test-utils/signing-review')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { findEnabledByTestId } = await import('@test-utils/rnw')
const { TokenApprovalsScreen } =
    await import('@modules/accounts/screens/TokenApprovalsScreen')
const { SigningOverlays } = await import('@modules/signing/shell')

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const {
    APPROVAL_APES: APES,
    APPROVAL_DAI: DAI,
    APPROVAL_OWNER: OWNER,
    APPROVAL_ROUTER: ROUTER,
    APPROVAL_SEAPORT: SEAPORT,
    APPROVAL_USDC: USDC,
    MAX_UINT256,
    readSentRevoke,
    signWithOwnerKey,
} = await import('@packages/chain-ethereum/src/__tests__/approval-flow')

const ETHEREUM_OWNER = {
    id: 'eth-owner',
    custody: {
        kind: 'local' as const,
        seed: SeedScheme.Bip39,
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: OWNER, keyPairId: 'eth-key' } },
    name: 'Eth owner',
}

const USDC_ASSET_ID = `eip155:1/erc20:${USDC.toLowerCase()}`

// The approvals the chain holds now; a confirmed revoke removes its entry.
const chain = {
    allowances: {
        [USDC]: [{ owner: OWNER, spender: ROUTER, amount: MAX_UINT256 }],
        [DAI]: [] as { owner: string; spender: string; amount: bigint }[],
    },
    operators: {
        [APES]: [{ owner: OWNER, operator: SEAPORT }],
    },
}

// What the chain adapter reads of a token it lists.
const tokenReads = erc20CallResponder({
    [USDC]: {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        totalSupply: 10n ** 15n,
    },
})

const sentRawTransactions: string[] = []

const applyRevoke = (raw: string): void => {
    const { to, functionName } = readSentRevoke(raw)
    const contract = Object.keys(
        functionName === 'approve' ? chain.allowances : chain.operators,
    ).find(key => key.toLowerCase() === to)
    if (!contract) return
    if (functionName === 'approve') {
        chain.allowances[contract as typeof USDC] = []
    } else {
        chain.operators[contract as typeof APES] = []
    }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
        {children}
    </QueryClientProvider>
)

const renderApprovals = () =>
    renderHook(
        () => ({
            list: useTokenApprovalsQuery({ scope: SCOPE, account: OWNER }),
            revoker: useRevokeTokenApprovalMutation(),
            // What the screen does for its rows: it is the token's record that
            // lets review tell a zero allowance from a grant.
            assets: useAssetsQuery(SCOPE, [USDC], { fetchMissing: true }),
        }),
        { wrapper },
    ).result

describe('Flow: list and revoke an Ethereum account’s token approvals', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        drainPendingSignRequests()
        await resetTestDatabase()
        useAccountsStore.getState().setAccounts([ETHEREUM_OWNER])
        useAccountsStore.getState().setSelectedAccountId(ETHEREUM_OWNER.id)
        sentRawTransactions.length = 0
        chain.allowances = {
            [USDC]: [{ owner: OWNER, spender: ROUTER, amount: MAX_UINT256 }],
            [DAI]: [],
        }
        chain.operators = { [APES]: [{ owner: OWNER, operator: SEAPORT }] }
        vi.spyOn(kmsCore, 'sign').mockImplementation(signWithOwnerKey)
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    eth_call: params => {
                        const approval = evmApprovalCallResponder(chain)(params)
                        return approval instanceof EvmRpcErrorFixture
                            ? tokenReads(params)
                            : approval
                    },
                    eth_sendRawTransaction: params => {
                        sentRawTransactions.push(params[0] as string)
                        applyRevoke(params[0] as string)
                        const respond =
                            DEFAULT_EVM_RPC_RESPONSES.eth_sendRawTransaction
                        return typeof respond === 'function'
                            ? respond(params)
                            : respond
                    },
                    eth_getTransactionByHash: params =>
                        evmRpcTransaction({ hash: params[0] as Hex }),
                    eth_getTransactionReceipt: params =>
                        evmTransactionReceipt({
                            transactionHash: params[0] as Hex,
                        }),
                },
            }),
            ...peraEvmHandlers({
                baseUrl: PERA_URL,
                assets: {
                    [USDC_ASSET_ID]: {
                        ...unknownAssetItem(USDC_ASSET_ID),
                        name: 'USD Coin',
                        unit_name: 'USDC',
                        fraction_decimals: 6,
                        is_verified: true,
                        verification_tier: 'verified',
                    },
                },
                approvals: {
                    [OWNER.toLowerCase()]: [
                        [
                            evmAllowanceCandidate({
                                token: USDC,
                                spender: ROUTER,
                            }),
                            // Spent down since its log: the chain now reads zero.
                            evmAllowanceCandidate({
                                token: DAI,
                                spender: ROUTER,
                            }),
                            evmOperatorCandidate({
                                collection: APES,
                                operator: SEAPORT,
                            }),
                        ],
                    ],
                },
                contractMetadata: {
                    [ROUTER.toLowerCase()]: contractMetadataResponse(
                        'Uniswap V3 Router',
                        'Uniswap',
                        'https://uniswap.org',
                    ),
                    [SEAPORT.toLowerCase()]: contractMetadataResponse(
                        'OpenSea Seaport',
                        'OpenSea',
                        'https://opensea.io',
                    ),
                },
            }),
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
        useAccountsStore.getState().setAccounts([])
    })

    const revokeAndConfirm = async (
        result: ReturnType<typeof renderApprovals>,
        approval: TokenApproval,
    ) => {
        const { confirm } = renderSignReview()
        let revoking: Promise<void> = Promise.resolve()
        act(() => {
            revoking = result.current.revoker.revoke({
                scope: SCOPE,
                account: OWNER,
                approval,
            })
        })
        await waitFor(
            () =>
                expect(
                    screen.getByTestId('signing-confirm-slide'),
                ).toBeTruthy(),
            { timeout: 10_000 },
        )
        // Reviewed as a revoke, not as a new grant.
        await waitFor(
            () =>
                expect(
                    screen.getByTestId('ethereum_approval_revoke_note'),
                ).toBeTruthy(),
            { timeout: 10_000 },
        )
        confirm()
        await act(() => revoking)
        return readSentRevoke(sentRawTransactions[0])
    }

    it('Given an unlimited USDC allowance and an NFT operator approval, when the account is opened, then both are listed with their spender labels, the allowance unlimited, and a pair the chain reads as zero is left out', async () => {
        const result = renderApprovals()

        await waitFor(() => expect(result.current.list.data).toHaveLength(2), {
            timeout: 10_000,
        })

        expect(result.current.list.data).toEqual([
            {
                kind: 'allowance',
                assetRef: { chainId: 'ethereum', assetId: USDC },
                spender: ROUTER,
                knownSpender: { name: 'Uniswap V3 Router' },
            },
            {
                kind: 'collection',
                collection: APES,
                collectionName: 'Bored Ape Yacht Club',
                spender: SEAPORT,
                knownSpender: { name: 'OpenSea Seaport' },
            },
        ])
    })

    it('Given an unlimited allowance, when the user revokes it and confirms, then approve(spender, 0) reaches the token and the entry disappears once it confirms', async () => {
        const result = renderApprovals()
        await waitFor(() => expect(result.current.list.data).toHaveLength(2), {
            timeout: 10_000,
        })

        await waitFor(
            () => expect(result.current.assets.data.has(USDC)).toBe(true),
            { timeout: 10_000 },
        )
        const sent = await revokeAndConfirm(
            result,
            result.current.list.data[0]!,
        )

        expect(sent).toEqual({
            to: USDC.toLowerCase(),
            functionName: 'approve',
            args: [ROUTER, 0n],
        })
        await waitFor(
            () =>
                expect(
                    result.current.list.data.map(entry => entry.kind),
                ).toEqual(['collection']),
            { timeout: 10_000 },
        )
    })

    it('Given an operator approval, when the user revokes it and confirms, then setApprovalForAll(operator, false) reaches the collection and the entry disappears once it confirms', async () => {
        const result = renderApprovals()
        await waitFor(() => expect(result.current.list.data).toHaveLength(2), {
            timeout: 10_000,
        })

        const sent = await revokeAndConfirm(
            result,
            result.current.list.data[1]!,
        )

        expect(sent).toEqual({
            to: APES.toLowerCase(),
            functionName: 'setApprovalForAll',
            args: [SEAPORT, false],
        })
        await waitFor(
            () =>
                expect(
                    result.current.list.data.map(entry => entry.kind),
                ).toEqual(['allowance']),
            { timeout: 10_000 },
        )
    })

    describe('on the Token Approvals screen', () => {
        const USDC_ROW = `${USDC}:${ROUTER}`.toLowerCase()
        const APES_ROW = `${APES}:${SEAPORT}`.toLowerCase()

        // The review opens over the screen, in the one sheet manager.
        const ScreenWithReview = () => (
            <>
                <TokenApprovalsScreen />
                <SigningOverlays />
            </>
        )

        const renderScreen = (accountId: string = ETHEREUM_OWNER.id) => {
            route.params = { accountId, scope: SCOPE }
            return renderWithNavigation(ScreenWithReview, 'TokenApprovals')
        }

        it('Given an unlimited USDC allowance and an operator approval, when the screen opens, then both rows are labelled, the allowance reads Unlimited, and the pair the chain reads as zero is not shown', async () => {
            renderScreen()

            const usdcRevoke = await screen.findByTestId(
                `token_approval_revoke_${USDC_ROW}`,
                {},
                { timeout: 10_000 },
            )

            expect(usdcRevoke).toBeTruthy()
            expect(
                screen.getByTestId(`token_approval_revoke_${APES_ROW}`),
            ).toBeTruthy()
            expect(
                screen.getByTestId(`token_approval_unlimited_${USDC_ROW}`),
            ).toBeTruthy()
            expect(screen.getByText('token_approvals.unlimited')).toBeTruthy()
            expect(screen.getByText('Uniswap V3 Router')).toBeTruthy()
            expect(screen.getByText('OpenSea Seaport')).toBeTruthy()
            expect(screen.getByText('token_approvals.all_items')).toBeTruthy()
            expect(
                screen.queryByTestId(
                    `token_approval_revoke_${DAI}:${ROUTER}`.toLowerCase(),
                ),
            ).toBeNull()
        })

        it('Given the listed allowance, when the user taps Revoke and confirms the review, then approve(spender, 0) reaches the token and its row disappears once it confirms', async () => {
            renderScreen()
            // Offered only once the token's record is in: until then review
            // couldn't tell this revoke from a zero grant.
            const revoke = await findEnabledByTestId(
                `token_approval_revoke_${USDC_ROW}`,
                { timeout: 10_000 },
            )
            act(() => {
                useSettingsStore
                    .getState()
                    .setPreference('hasSeenTransactionRequestFAQ', true)
            })

            fireEvent.click(revoke)
            await waitFor(
                () =>
                    expect(
                        screen.getByTestId('ethereum_approval_revoke_note'),
                    ).toBeTruthy(),
                { timeout: 10_000 },
            )
            fireEvent.click(screen.getByTestId('signing-confirm-slide'))

            await waitFor(() => expect(sentRawTransactions).toHaveLength(1), {
                timeout: 10_000,
            })
            expect(readSentRevoke(sentRawTransactions[0])).toEqual({
                to: USDC.toLowerCase(),
                functionName: 'approve',
                args: [ROUTER, 0n],
            })
            await waitFor(
                () =>
                    expect(
                        screen.queryByTestId(
                            `token_approval_revoke_${USDC_ROW}`,
                        ),
                    ).toBeNull(),
                { timeout: 10_000 },
            )
            expect(
                screen.getByTestId(`token_approval_revoke_${APES_ROW}`),
            ).toBeTruthy()
        })

        it('Given a watch account, when the screen opens, then the approvals are listed with no Revoke button', async () => {
            useAccountsStore.getState().setAccounts([
                {
                    id: 'eth-watch',
                    custody: { kind: 'watch' as const },
                    chains: { ethereum: { address: OWNER } },
                    name: 'Watched',
                },
            ])
            renderScreen('eth-watch')

            await screen.findByTestId(
                `token_approval_unlimited_${USDC_ROW}`,
                {},
                { timeout: 10_000 },
            )

            expect(screen.getByText('Uniswap V3 Router')).toBeTruthy()
            expect(
                screen.queryByTestId(`token_approval_revoke_${USDC_ROW}`),
            ).toBeNull()
            expect(
                screen.queryByTestId(`token_approval_revoke_${APES_ROW}`),
            ).toBeNull()
        })

        it('Given the backend cannot be read, when the screen opens, then it offers a retry instead of an empty list', async () => {
            server.use(
                ...peraEvmHandlers({ baseUrl: PERA_URL, approvals: 503 }),
            )
            renderScreen()

            expect(
                await screen.findByTestId(
                    'token_approvals_retry',
                    {},
                    { timeout: 10_000 },
                ),
            ).toBeTruthy()
            expect(screen.getByText('token_approvals.error_title')).toBeTruthy()
        })
    })
})
