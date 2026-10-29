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

// A fixture eip155 dApp asking an approved Ethereum session to sign messages,
// through the same provider, registry, handler, signing adapter and review
// sheet as `connections-flow.spec.tsx` with only `@reown/walletkit` stubbed.
// The key store signs from known-answer vectors, so what the dApp receives is
// checked with viem itself.

import React, { useEffect, useRef } from 'react'
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { walletKitStub, type FakeWalletKit } from '@test-utils/walletkit-stub'
import { getAllPressables, isElementDisabled } from '@test-utils/rnw'
import {
    makeProposal,
    makeRequest,
    TOPIC as V2_SESSION_TOPIC,
    V2_URI,
} from '@packages/walletconnect/src/v2/__tests__/fakeWalletKit'
import { useSigningStore } from '@packages/signing/src/store'
import { __resetSigningActorRegistryForTests } from '@packages/signing/src/hooks/useSigningActorLifecycle'
import {
    MAIL_TYPED_DATA,
    PERMIT2_SINGLE_TYPED_DATA,
    PERMIT2_SINGLE_UNLIMITED_TYPED_DATA,
    SENDER,
    SIGNER_KEY_PAIR_ID,
    VIEM_HELLO_WORLD,
    VIEM_MAIL,
    vectorSignature,
    verifyMessage,
    verifyTypedData,
} from '@packages/chain-ethereum/src/__tests__/testing'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    resetConnectionPairingStateForTesting,
    useConnectionRegistry,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import type { ConnectionOrigin } from '@perawallet/wallet-extension-connections'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ConnectionsProvider } from '@modules/connections/shell'
import { SigningOverlays } from '@modules/signing/shell'

// The integration setup registers whichever chains config enables, and v2
// builds no client without a Reown project id.
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
    }
})

const ETH_MAINNET = 'eip155:1'
const NOT_A_SESSION_ACCOUNT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const HELLO_WORLD_HEX = '0x68656c6c6f20776f726c64'
const CONFIRM_SLIDE = 'message-signing-confirm-slide'
const REJECT_BUTTON = 'message-signing-reject-button'
const TYPED_DATA_WARNING = 'message-signing-typed-data-warning'
const SPEND_APPROVAL_WARNING = 'message-signing-spend-approval-warning'
const SPEND_APPROVAL_SPENDER = 'message-signing-spend-approval-spender'
const SPEND_APPROVAL_AMOUNT = 'message-signing-spend-approval-amount-0'

const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'eth-msg-account',
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: SENDER, keyPairId: SIGNER_KEY_PAIR_ID } },
    name: 'Ether',
}

const IN_APP_ORIGIN: ConnectionOrigin = { source: 'in-app' }

const captured: { registry: Optional<ConnectionRegistryClient> } = {
    registry: undefined,
}
const RegistryProbe = () => {
    captured.registry = useConnectionRegistry()
    return null
}

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
            <RegistryProbe />
            <SigningOverlays />
        </ConnectionsProvider>
    )
}

const findButton = (label: string): Optional<HTMLButtonElement> =>
    getAllPressables().find(button =>
        (button.textContent ?? '').includes(label),
    ) as Optional<HTMLButtonElement>

const waitForWalletKit = (): Promise<FakeWalletKit> =>
    waitFor(
        () => {
            const client = walletKitStub.last()
            if (!client) throw new Error('WalletKit was never initialised')
            return client
        },
        { timeout: 15_000 },
    )

// Connects the Ethereum account over a session that lists the message methods.
const connectSession = async (): Promise<FakeWalletKit> => {
    renderWithNavigation(ConnectionsWithSigning, 'ConnectionsWithSigning')
    await waitFor(() => {
        expect(captured.registry).toBeTruthy()
    })
    await act(async () => {
        await captured.registry!.pair(V2_URI, { origin: IN_APP_ORIGIN })
    })
    const walletKit = await waitForWalletKit()
    act(() => {
        walletKit.emit(
            'session_proposal',
            makeProposal({
                requiredNamespaces: {
                    eip155: {
                        chains: [ETH_MAINNET],
                        methods: [
                            'personal_sign',
                            'eth_signTypedData_v4',
                            'eth_signTypedData',
                        ],
                        events: [],
                    },
                },
            }),
        )
    })
    await waitFor(() => {
        expect(findButton('common.connect.label')).toBeTruthy()
    })
    const row = `wc_account_row_${ETHEREUM_ACCOUNT.id}`
    await waitFor(() => expect(screen.getByTestId(row)).toBeTruthy(), {
        timeout: 5000,
    })
    fireEvent.click(screen.getByTestId(row))
    await waitFor(() => {
        expect(isElementDisabled(findButton('common.connect.label')!)).toBe(
            false,
        )
    })
    fireEvent.click(findButton('common.connect.label')!)
    await waitFor(() => {
        expect(walletKit.approveSession).toHaveBeenCalledTimes(1)
    })
    await waitFor(async () => {
        expect(
            await getProvider().connections.store.get(V2_SESSION_TOPIC),
        ).toBeTruthy()
    })
    return walletKit
}

const send = (
    walletKit: FakeWalletKit,
    method: string,
    params: unknown[],
    id = 1,
) =>
    act(() => {
        walletKit.emit(
            'session_request',
            makeRequest({ id, method, params, chainId: ETH_MAINNET }),
        )
    })

const answerOf = async (walletKit: FakeWalletKit) => {
    await waitFor(
        () => {
            expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1)
        },
        { timeout: 15_000 },
    )
    return (walletKit.respondSessionRequest as Mock).mock.calls[0][0].response
}

describe('Flow: an eip155 dApp asks for a message signature', () => {
    setSuiteUnhandledRequestMode('bypass')

    beforeEach(async () => {
        // Actors and the queue are module state, so one test's leftover would
        // hold every later review behind it.
        __resetSigningActorRegistryForTests()
        useSigningStore.getState().resetState()
        resetTestKeystore()
        walletKitStub.reset()
        captured.registry = undefined
        useAccountsStore.getState().setAccounts([ETHEREUM_ACCOUNT])
        await getProvider().connections.store.clear()
        resetConnectionPairingStateForTesting()
        vi.clearAllMocks()
        setCapabilityOverrides({ dappConnect: true }, 'ethereum')
        vi.spyOn(kmsCore, 'sign').mockImplementation(async (_id, payload) =>
            vectorSignature(payload),
        )
        // The review sheet looks the peer up in the projects API.
        server.use(http.get('*/v1/projects/', () => HttpResponse.json([])))
    })

    afterEach(async () => {
        vi.restoreAllMocks()
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    it('Given a connected session, when the dApp sends personal_sign and the user slides to confirm, then the dApp receives a signature viem verifies for the signer', async () => {
        const walletKit = await connectSession()

        send(walletKit, 'personal_sign', [HELLO_WORLD_HEX, SENDER])
        await waitFor(
            () => expect(screen.getByTestId(CONFIRM_SLIDE)).toBeTruthy(),
            { timeout: 15_000 },
        )
        expect(screen.queryByTestId(TYPED_DATA_WARNING)).toBeNull()
        fireEvent.click(screen.getByTestId(CONFIRM_SLIDE))

        const response = await answerOf(walletKit)
        expect(response.result).toBe(VIEM_HELLO_WORLD)
        await expect(
            verifyMessage({
                address: SENDER,
                message: 'hello world',
                signature: response.result,
            }),
        ).resolves.toBe(true)
    })

    it('Given a connected session, when the dApp sends eth_signTypedData_v4 as a JSON string and the user slides to confirm, then the dApp receives a signature viem verifies for the signer', async () => {
        const walletKit = await connectSession()

        send(walletKit, 'eth_signTypedData_v4', [
            SENDER,
            JSON.stringify(MAIL_TYPED_DATA),
        ])
        await waitFor(
            () => expect(screen.getByTestId(CONFIRM_SLIDE)).toBeTruthy(),
            { timeout: 15_000 },
        )
        expect(screen.getByTestId(TYPED_DATA_WARNING)).toBeTruthy()
        expect(screen.queryByTestId(SPEND_APPROVAL_WARNING)).toBeNull()
        fireEvent.click(screen.getByTestId(CONFIRM_SLIDE))

        const response = await answerOf(walletKit)
        expect(response.result).toBe(VIEM_MAIL)
        await expect(
            verifyTypedData({
                address: SENDER,
                signature: response.result,
                ...MAIL_TYPED_DATA,
            }),
        ).resolves.toBe(true)
    })

    it('Given a connected session, when the dApp sends unversioned eth_signTypedData with a v4 object and the user slides to confirm, then the review shows the typed-data warning and the dApp receives a signature viem verifies for the signer', async () => {
        const walletKit = await connectSession()

        send(walletKit, 'eth_signTypedData', [
            SENDER,
            JSON.stringify(MAIL_TYPED_DATA),
        ])
        await waitFor(
            () => expect(screen.getByTestId(CONFIRM_SLIDE)).toBeTruthy(),
            { timeout: 15_000 },
        )
        expect(screen.getByTestId(TYPED_DATA_WARNING)).toBeTruthy()
        fireEvent.click(screen.getByTestId(CONFIRM_SLIDE))

        const response = await answerOf(walletKit)
        expect(response.result).toBe(VIEM_MAIL)
        await expect(
            verifyTypedData({
                address: SENDER,
                signature: response.result,
                ...MAIL_TYPED_DATA,
            }),
        ).resolves.toBe(true)
    })

    it('Given a connected session, when the dApp sends eth_signTypedData with a v1 array, then it is answered 4200 and no review opens', async () => {
        const walletKit = await connectSession()

        send(walletKit, 'eth_signTypedData', [
            [{ type: 'string', name: 'Message', value: 'Hi, Alice!' }],
            SENDER,
        ])

        const response = await answerOf(walletKit)
        expect(response.error).toMatchObject({ code: 4200 })
        expect(screen.queryByTestId('sign-request-view')).toBeNull()
        expect(kmsCore.sign).not.toHaveBeenCalled()
    })

    it('Given a connected session, when the dApp sends a Permit2 PermitSingle for an unlimited amount, then the review shows the spend-approval warning with the spender and an unlimited amount, and cancelling answers 4001', async () => {
        const walletKit = await connectSession()

        send(walletKit, 'eth_signTypedData_v4', [
            SENDER,
            JSON.stringify(PERMIT2_SINGLE_UNLIMITED_TYPED_DATA),
        ])
        await waitFor(
            () =>
                expect(screen.getByTestId(SPEND_APPROVAL_WARNING)).toBeTruthy(),
            { timeout: 15_000 },
        )
        expect(screen.getByTestId(SPEND_APPROVAL_SPENDER)).toBeTruthy()
        expect(screen.queryByTestId(TYPED_DATA_WARNING)).toBeNull()
        expect(screen.getByTestId(SPEND_APPROVAL_AMOUNT).textContent).toContain(
            'signing.spend_approval.unlimited',
        )
        fireEvent.click(screen.getByTestId(REJECT_BUTTON))

        const response = await answerOf(walletKit)
        expect(response.error).toMatchObject({ code: 4001 })
        expect(kmsCore.sign).not.toHaveBeenCalled()
    })

    it('Given a connected session, when the dApp sends a Permit2 PermitSingle for a limited amount, then the review shows the spender and the base-unit amount instead of unlimited', async () => {
        const walletKit = await connectSession()

        send(walletKit, 'eth_signTypedData_v4', [
            SENDER,
            JSON.stringify(PERMIT2_SINGLE_TYPED_DATA),
        ])
        await waitFor(
            () =>
                expect(screen.getByTestId(SPEND_APPROVAL_WARNING)).toBeTruthy(),
            { timeout: 15_000 },
        )
        // Checksummed, truncated by AddressDisplay.
        expect(
            screen.getByTestId(SPEND_APPROVAL_SPENDER).textContent,
        ).toContain('0x709...c79C8')
        await waitFor(
            () =>
                expect(
                    screen.getByTestId(SPEND_APPROVAL_AMOUNT).textContent,
                ).toContain('1,000,000'),
            { timeout: 15_000 },
        )
        expect(
            screen.getByTestId(SPEND_APPROVAL_AMOUNT).textContent,
        ).not.toContain('signing.spend_approval.unlimited')
        fireEvent.click(screen.getByTestId(REJECT_BUTTON))
        await answerOf(walletKit)
    })

    it('Given a message awaiting review, when the user cancels, then the dApp is answered 4001 and nothing is signed', async () => {
        const walletKit = await connectSession()

        send(walletKit, 'personal_sign', [HELLO_WORLD_HEX, SENDER])
        await waitFor(
            () => expect(screen.getByTestId(REJECT_BUTTON)).toBeTruthy(),
            { timeout: 15_000 },
        )
        fireEvent.click(screen.getByTestId(REJECT_BUTTON))

        const response = await answerOf(walletKit)
        expect(response.error).toMatchObject({ code: 4001 })
        expect(kmsCore.sign).not.toHaveBeenCalled()
    })

    it('Given a signer that is not a session account, when the dApp sends personal_sign, then it is answered 4100 and no review opens', async () => {
        const walletKit = await connectSession()

        send(walletKit, 'personal_sign', [
            HELLO_WORLD_HEX,
            NOT_A_SESSION_ACCOUNT,
        ])

        const response = await answerOf(walletKit)
        expect(response.error).toMatchObject({ code: 4100 })
        expect(screen.queryByTestId('sign-request-view')).toBeNull()
        expect(kmsCore.sign).not.toHaveBeenCalled()
    })

    it('Given a connected session, when the dApp sends eth_sign, then it is answered 4200 and no review opens', async () => {
        const walletKit = await connectSession()

        send(walletKit, 'eth_sign', [SENDER, HELLO_WORLD_HEX])

        const response = await answerOf(walletKit)
        expect(response.error).toMatchObject({ code: 4200 })
        expect(screen.queryByTestId('sign-request-view')).toBeNull()
        expect(kmsCore.sign).not.toHaveBeenCalled()
    })
})
