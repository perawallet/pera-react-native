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
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'
import {
    ABIType,
    decodeAddress,
    decodeSignedTransaction,
    encodeAddress,
    encodeJSON,
    modelsv2,
} from 'algosdk'

import { server } from '@test-utils/msw-server'
import { render } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import {
    CardWalletKind,
    useCardSessionStore,
    useCardStore,
} from '@perawallet/wallet-core-card'
import { mockGetWalletBalance } from '@perawallet/wallet-core-card/test-handlers'
import {
    mockAlgodAccountInformation,
    mockAlgodPendingTransaction,
    mockAlgodSimulate,
    mockAlgodStatus,
    mockAlgodStatusAfterBlock,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { PeraCardOverview } from '@modules/card/components/PeraCardOverview'
import { CardWithdrawScreen } from '@modules/card/screens/CardWithdrawScreen'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
} from './__fixtures__/onboarding'

// The card chain ids are empty in the test env and the escrow hooks fail
// closed without them.
vi.mock('@perawallet/wallet-core-config', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-config')
    >('@perawallet/wallet-core-config')
    return {
        ...actual,
        getNetworkConfig: (
            network: Parameters<typeof actual.getNetworkConfig>[0],
        ) => ({
            ...actual.getNetworkConfig(network),
            cardW3CardAppId: '111',
            cardKillswitchAppId: '222',
        }),
    }
})

const APP_ID = '111'
// The test network is mainnet, whose USDC id the config already carries.
const USDC_ASSET_ID = 31_566_704
const CARD_ADDRESS =
    'PWJLR77JXPCJDWUCGB7MXGH2AFXAFU6UE7FNZLRLSEXJNP6MKJMIXGWT4I'
const WAIT_TIME_SECONDS = 20
const SLOW_TEST_TIMEOUT_MS = 30_000

const SELECTORS = {
    withdrawalRequest: 'b7349158',
    withdraw: '13ff1ce9',
} as const

const WITHDRAWAL_REQUEST = ABIType.from(
    '(address,address,uint64,uint64,uint64,uint64)',
)

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex')
const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
const toBigInt = (bytes: Uint8Array) => BigInt(`0x${toHex(bytes)}`)

// The contract keys the pending request by the owner, not the card.
const ownerBoxName = (() => {
    const name = new Uint8Array(34)
    name.set(new TextEncoder().encode('wr'), 0)
    name.set(decodeAddress(ALGO25_TEST_ADDRESS).publicKey, 2)
    return name
})()

const activeCardStatus = http.get('*/v1/card/status', () =>
    HttpResponse.json(
        {
            id: 'card_1',
            panLast4: '4242',
            status: 'ACTIVE',
            type: 'VIRTUAL',
            orderedAt: '2026-09-01T00:00:00.000Z',
        },
        { status: 200 },
    ),
)

const emptyTransactions = http.get('*/v1/card/transactions', () =>
    HttpResponse.json([], { status: 200 }),
)

// Only the wait time is read from the app; the programs are the minimal
// `int 1` so the model decodes.
const appInfo = http.get(`*/v2/applications/${APP_ID}`, () =>
    HttpResponse.text(
        encodeJSON(
            new modelsv2.Application({
                id: BigInt(APP_ID),
                params: new modelsv2.ApplicationParams({
                    creator: ALGO25_TEST_ADDRESS,
                    approvalProgram: new Uint8Array([6, 129, 1]),
                    clearStateProgram: new Uint8Array([6, 129, 1]),
                    globalState: [
                        new modelsv2.TealKeyValue({
                            key: new TextEncoder().encode('wwt'),
                            value: new modelsv2.TealValue({
                                type: 2,
                                uint: BigInt(WAIT_TIME_SECONDS),
                                bytes: new Uint8Array(),
                            }),
                        }),
                    ],
                }),
            }),
        ),
        { headers: { 'Content-Type': 'application/json' } },
    ),
)

type BoxState = {
    /** Base units of the open request, null when none is open. */
    pendingAmount: bigint | null
    createdAt: number
    requestedNames: string[]
}

// The withdrawals box, keyed by the owner: 404 while nothing is pending,
// the encoded request otherwise. Tests flip `pendingAmount` from the
// submission spy to mirror what the chain would do.
const boxHandler = (state: BoxState) =>
    http.get(`*/v2/applications/${APP_ID}/box`, ({ request }) => {
        state.requestedNames.push(
            new URL(request.url).searchParams.get('name') ?? '',
        )
        if (state.pendingAmount === null) {
            return HttpResponse.json(
                { message: 'box not found' },
                { status: 404 },
            )
        }
        const value = WITHDRAWAL_REQUEST.encode([
            CARD_ADDRESS,
            ALGO25_TEST_ADDRESS,
            BigInt(USDC_ASSET_ID),
            state.pendingAmount,
            BigInt(state.createdAt),
            0n,
        ])
        return HttpResponse.json(
            {
                name: toBase64(ownerBoxName),
                round: 100,
                value: toBase64(value),
            },
            { status: 200 },
        )
    })

const decodeAppCall = (signed: Uint8Array) => {
    const { txn } = decodeSignedTransaction(signed)
    const call = txn.applicationCall
    expect(call).toBeDefined()
    const [selector, ...args] = call!.appArgs
    return {
        appIndex: call!.appIndex,
        selector: toHex(selector),
        args,
    }
}

// A real algo25 key in the in-memory keystore: the request and the claim
// are contract calls signed by the card owner.
const seedOwnerAccount = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: Algo25KeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createAlgo25Key({
            mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
        })
        expect(keyResult).not.toBeNull()
    })
    const account: WalletAccount = {
        id: 'card-owner',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: keyResult!.seedKey.id ?? '',
        name: 'Main Account',
    }
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountAddress(account.address)
    return account
}

// The contract calls go through the signing queue, which only the overlays
// host drains; production mounts it in the root, so mount it here in a
// sibling tree sharing the same stores. Plain `render` keeps it clear of a
// second bottom-sheet manager, which would show every sheet twice.
const renderOverviewWithWithdraw = () => {
    render(<SigningOverlays />)
    return renderWithNavigation(PeraCardOverview, 'Overview', {
        additionalScreens: [
            { name: 'CardWithdraw', component: CardWithdrawScreen },
        ],
    })
}

// Navigates overview → withdraw screen and types "25" on the number pad.
// Keys are tapped while the amount display shows a different value, so each
// digit's text node is unambiguous.
const goToWithdrawAndTypeAmount = async () => {
    fireEvent.click(await screen.findByTestId('pera_card_withdraw_button'))

    expect(await screen.findByTestId('card-withdraw-amount')).toBeTruthy()
    fireEvent.click(screen.getByText('2'))
    fireEvent.click(screen.getByText('5'))
    expect(screen.getByTestId('card-withdraw-amount').textContent).toBe('25')
}

describe('Flow: Card withdraw', () => {
    let box: BoxState

    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        vi.mocked(Notifier.showNotification).mockClear()
        resetTestKeystore()
        box = { pendingAmount: null, createdAt: 0, requestedNames: [] }
        // The status and credit queries are gated on the card session.
        useCardSessionStore.getState().setAuthenticated(true)
        useCardStore.getState().setEscrowCard({
            cardAddress: CARD_ADDRESS,
            ownerAddress: ALGO25_TEST_ADDRESS,
            network: 'mainnet',
            txId: 'CREATE_TX',
        })
        server.use(
            activeCardStatus,
            emptyTransactions,
            mockGetWalletBalance({ kind: CardWalletKind.Reward, status: 404 }),
            mockGetWalletBalance({ kind: CardWalletKind.Credit, status: 404 }),
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            // The card balance is the escrow account's own USDC holding.
            mockAlgodAccountInformation({
                address: CARD_ADDRESS,
                response: {
                    amount: 200_000,
                    assets: [
                        {
                            'asset-id': USDC_ASSET_ID,
                            amount: 150_000_000,
                            'is-frozen': false,
                        },
                    ],
                },
            }),
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: { amount: 5_000_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSimulate(),
            // The flows wait for the block before refreshing, so confirm at once.
            mockAlgodPendingTransaction({
                status: 200,
                response: { 'confirmed-round': 101 },
            }),
            mockAlgodStatusAfterBlock({ response: { 'last-round': 101 } }),
            appInfo,
            boxHandler(box),
        )
    })
    afterEach(() => {
        server.resetHandlers()
        useCardStore.getState().setEscrowCard(null)
        useAccountsStore.getState().setAccounts([])
    })
    afterAll(() => server.close())

    it(
        'requests a withdrawal through the confirmation sheet and shows it pending on the overview',
        async () => {
            await seedOwnerAccount()
            let submitted: Uint8Array | null = null
            server.use(
                http.post('*/v2/transactions', async ({ request }) => {
                    submitted = new Uint8Array(await request.arrayBuffer())
                    // The request lands: the box exists from here on, already
                    // past the wait so the claim is offered straight away.
                    box.pendingAmount = 25_000_000n
                    box.createdAt =
                        Math.floor(Date.now() / 1000) - WAIT_TIME_SECONDS * 3
                    return HttpResponse.json(
                        {
                            txId: 'REQUESTTXID000000000000000000000000000000000000000000',
                        },
                        { status: 200 },
                    )
                }),
            )

            renderOverviewWithWithdraw()
            await goToWithdrawAndTypeAmount()

            // Enabling the button proves the escrow account's 150 USDC flowed
            // through as the card balance.
            fireEvent.click(screen.getByTestId('card_withdraw_button'))
            fireEvent.click(
                await screen.findByTestId('card_withdraw_confirm_button'),
            )

            await waitFor(() => expect(submitted).not.toBeNull(), {
                timeout: 15_000,
            })
            const call = decodeAppCall(submitted!)
            expect(call.appIndex).toBe(BigInt(APP_ID))
            expect(call.selector).toBe(SELECTORS.withdrawalRequest)
            expect(encodeAddress(call.args[0])).toBe(CARD_ADDRESS)
            expect(toBigInt(call.args[1])).toBe(BigInt(USDC_ASSET_ID))
            expect(toBigInt(call.args[2])).toBe(25_000_000n)

            // Requested toast, back on the overview, and the open request is
            // read from the owner-keyed box with its claim ready.
            await waitFor(() =>
                expect(Notifier.showNotification).toHaveBeenCalled(),
            )
            expect(
                await screen.findByTestId(
                    'pera_card_pending_withdrawal',
                    {},
                    { timeout: 10_000 },
                ),
            ).toBeTruthy()
            expect(
                screen.getByTestId('pera_card_pending_withdrawal_complete'),
            ).toBeTruthy()
            expect(box.requestedNames).toContain(
                `b64:${toBase64(ownerBoxName)}`,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'claims a matured request from the overview and clears it once the block lands',
        async () => {
            await seedOwnerAccount()
            box.pendingAmount = 40_000_000n
            box.createdAt =
                Math.floor(Date.now() / 1000) - WAIT_TIME_SECONDS * 3
            let submitted: Uint8Array | null = null
            server.use(
                http.post('*/v2/transactions', async ({ request }) => {
                    submitted = new Uint8Array(await request.arrayBuffer())
                    box.pendingAmount = null
                    return HttpResponse.json(
                        {
                            txId: 'WITHDRAWTXID00000000000000000000000000000000000000000',
                        },
                        { status: 200 },
                    )
                }),
            )

            renderOverviewWithWithdraw()

            fireEvent.click(
                await screen.findByTestId(
                    'pera_card_pending_withdrawal_complete',
                    {},
                    { timeout: 10_000 },
                ),
            )

            await waitFor(() => expect(submitted).not.toBeNull(), {
                timeout: 15_000,
            })
            const call = decodeAppCall(submitted!)
            expect(call.selector).toBe(SELECTORS.withdraw)
            expect(encodeAddress(call.args[0])).toBe(CARD_ADDRESS)
            expect(toBigInt(call.args[1])).toBe(40_000_000n)

            await waitFor(
                () =>
                    expect(
                        screen.queryByTestId('pera_card_pending_withdrawal'),
                    ).toBeNull(),
                { timeout: 10_000 },
            )
            expect(Notifier.showNotification).toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'keeps the sheet open and surfaces an error toast when the node rejects the request',
        async () => {
            await seedOwnerAccount()
            let rejections = 0
            // algod's real wording: the pipeline only treats a verdict it can
            // parse as a rejection, anything else is probed as "maybe landed".
            server.use(
                http.post('*/v2/transactions', () => {
                    rejections += 1
                    return HttpResponse.json(
                        {
                            message: `TransactionPool.Remember: transaction REQTX: overspend (account ${ALGO25_TEST_ADDRESS}, data {_struct:{} Status:Offline MicroAlgos:{Raw:0}}, tried to spend {1000})`,
                        },
                        { status: 400 },
                    )
                }),
            )

            renderOverviewWithWithdraw()
            await goToWithdrawAndTypeAmount()

            fireEvent.click(screen.getByTestId('card_withdraw_button'))
            fireEvent.click(
                await screen.findByTestId('card_withdraw_confirm_button'),
            )

            await waitFor(() => expect(rejections).toBe(1), {
                timeout: 15_000,
            })
            await waitFor(
                () => expect(Notifier.showNotification).toHaveBeenCalled(),
                { timeout: 15_000 },
            )
            // The sheet stays open for a retry.
            expect(
                screen.getByTestId('card_withdraw_confirmation_sheet'),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
