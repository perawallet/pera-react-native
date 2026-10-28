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

// An ether send from a Ledger account signs the EIP-1559 payload on the
// device's Ethereum app and broadcasts what it signed.

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
import { Decimal } from 'decimal.js'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { keccak_256 } from '@noble/hashes/sha3.js'

import {
    upsertAccountChainState,
    useAccountChainStateStore,
    useAccountsStore,
    type HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { nativeAssetFor, upsertAssets } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    DEFAULT_EVM_RPC_RESPONSES,
    evmRpcHandlers,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { findEnabledByTestId } from '@test-utils/rnw'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { useSendFundsStore } from '@modules/transactions'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/routes'
import { useLedgerSigningDriver } from '@modules/signing/components/SigningOverlays/useLedgerSigningDriver'
import { registerFakeLedgerProvider } from './__fixtures__/ledger'

const RPC_URL = 'https://mainnet.rpc.test/'

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
                ? { mainnet: RPC_URL, sepolia: RPC_URL }
                : actual.chainEndpointsFor(chainId),
    }
})

const ETH_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

// Hardhat accounts #0 and #1, from the public test mnemonic.
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const RECEIVER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

// What Hardhat #0 signs over the 0.5 ETH transfer's digest, as r‖s‖recovery;
// the RPC fixture defaults make the build deterministic, so a digest missing
// here means the build changed and the signature must be regenerated.
const DEVICE_SIGNATURES: Record<string, string> = {
    '4c7de634dc88b13890e379a0156d0c4f1e4dd515384bf403285c40e2e3191177':
        '923c0f4c3ec362322e052c7d1f1d6ea2a364621802f4428c6508a4fe71a655ef332789ab7ace0f5c627bcda10589e4e437c568bfb39cd09f4dc40da8789c05ac01',
}

// The test releases the device's answer after asserting the approval UI.
let pendingApproval: PromiseWithResolvers<void> | null = null
const signedPayloads: Uint8Array[] = []

const signOnDevice = async (
    _accountIndex: number,
    payload: Uint8Array,
): Promise<Uint8Array> => {
    signedPayloads.push(payload)
    pendingApproval = Promise.withResolvers<void>()
    await pendingApproval.promise
    const digest = Buffer.from(keccak_256(payload)).toString('hex')
    const signature = DEVICE_SIGNATURES[digest]
    if (!signature) throw new Error(`No fixture signature for digest ${digest}`)
    return Uint8Array.from(Buffer.from(signature, 'hex'))
}

const LEDGER_SENDER: HardwareWalletAccount = {
    id: 'hw-ledger-sender',
    name: 'Ledger 1',
    custody: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'test-device-id',
            deviceName: 'Ledger Nano X',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    chains: { ethereum: { address: SENDER.toLowerCase() } },
}

const LedgerDriverHost = () => {
    useLedgerSigningDriver()
    return null
}

// The driver runs only while its host is mounted, and screens unmount on
// navigation in the test stack.
const wrapWithLedgerDriver = <P extends object>(
    Component: React.ComponentType<P>,
): React.ComponentType<P> => {
    const Wrapped = (props: P) => (
        <>
            <LedgerDriverHost />
            <Component {...props} />
        </>
    )
    Wrapped.displayName = `WithLedgerDriver(${Component.displayName ?? Component.name})`
    return Wrapped
}

const renderSendConfirmationStack = () =>
    renderWithNavigation(
        wrapWithLedgerDriver(TransactionConfirmationScreen),
        'ConfirmTransaction',
        {
            additionalScreens: [
                {
                    name: 'TransactionProcessing',
                    component: wrapWithLedgerDriver(
                        TransactionProcessingScreen,
                    ),
                },
                {
                    name: 'TransactionSuccess',
                    component: TransactionSuccessScreen,
                },
            ],
        },
    )

describe('Flow: send ether from a Ledger account', () => {
    const sentRawTransactions: string[] = []

    beforeAll(async () => {
        await setupTestDatabase()
        registerFakeLedgerProvider({
            address: SENDER,
            chainIds: ['algorand', 'ethereum'],
            signTransaction: signOnDevice,
        })
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await upsertAssets({
            items: [nativeAssetFor('ethereum')],
            scope: ETH_SCOPE,
        })
        await upsertAccountChainState({
            accountAddress: SENDER.toLowerCase(),
            scope: ETH_SCOPE,
            nativeBalance: new Decimal('10000000000000000000'),
            chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
        })
        useAccountChainStateStore.getState().resetState()
        useSendFundsStore.getState().reset()
        useAccountsStore.getState().setAccounts([LEDGER_SENDER])
        useAccountsStore.getState().setSelectedAccountId(LEDGER_SENDER.id)
        sentRawTransactions.length = 0
        signedPayloads.length = 0
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    eth_sendRawTransaction: params => {
                        sentRawTransactions.push(params[0] as string)
                        const respond =
                            DEFAULT_EVM_RPC_RESPONSES.eth_sendRawTransaction
                        return typeof respond === 'function'
                            ? respond(params)
                            : respond
                    },
                },
            }),
        )
    })

    afterEach(() => {
        pendingApproval = null
    })

    it('Given a Ledger account on Ethereum, when the user confirms an ether send, then the device signs it behind the Ledger overlay and the signed transaction reaches the node', async () => {
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
        useSendFundsStore.getState().setAmount(new Decimal('0.5'))
        useSendFundsStore.getState().setDestination(RECEIVER)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack()

        fireEvent.click(
            await findEnabledByTestId('send_confirm_button', { timeout: 5000 }),
        )

        await waitFor(
            () =>
                expect(
                    screen.getByTestId('ledger-signing-overlay-lottie'),
                ).toBeTruthy(),
            { timeout: 10_000 },
        )
        await waitFor(() => expect(pendingApproval).not.toBeNull())
        expect(sentRawTransactions).toHaveLength(0)
        // An EIP-1559 payload: the device signs the typed transaction itself.
        expect(signedPayloads[0]?.[0]).toBe(0x02)
        pendingApproval!.resolve()

        await waitFor(
            () => expect(screen.getByTestId('send_success')).toBeTruthy(),
            { timeout: 10_000 },
        )
        expect(sentRawTransactions).toHaveLength(1)
    })
})
