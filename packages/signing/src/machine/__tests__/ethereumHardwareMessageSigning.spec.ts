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
import { createActor, waitFor } from 'xstate'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    transactionReviewers,
    type ChainScope,
    type MessageRequest,
    type SignedMessage,
} from '@perawallet/wallet-core-chain-contract'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import { bytesToHex } from '@perawallet/wallet-core-shared'
import {
    MAIL_TYPED_DATA,
    SENDER,
    VIEM_HELLO_WORLD,
    VIEM_MAIL,
    createVectorEthereumLedger,
    ethereumAddressCodec,
    ethereumDescriptor,
    ethereumLocalKeyKinds,
    ethereumMessageSignerAdapter,
    ethereumReviewerAdapter,
    personalSignMessageRequest,
    typedDataMessageRequest,
    verifyMessage,
    verifyTypedData,
} from '@perawallet/wallet-core-chain-ethereum/testing'
import { registerAlgorandRulesAs } from '../../__tests__/registerAlgorandAccounts'
import { messageSignerChainAdapters } from '../../message-signer'
import type { MessageSignRequest } from '../../models'
import { createCallbackTransport } from '../../pipeline/transports/createCallbackTransport'
import type { SigningMachineInput } from '../context'
import { signingMachine } from '../signingMachine'

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const HELLO_WORLD_HEX = '0x68656c6c6f20776f726c64'

const hardwareAccount = {
    id: 'eth-ledger',
    custody: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'device-1',
            deviceName: 'Nano X',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    chains: { ethereum: { address: SENDER } },
} as unknown as WalletAccount

const registryFor = (options: { fullEip712?: boolean } = {}) => {
    const { transport } = createVectorEthereumLedger(options)
    const connect = vi.fn(async () => transport)
    const registry = {
        getProvider: () => ({ connect }),
    } as unknown as HardwareWalletRegistry
    return { registry, connect }
}

// Signs through the real machine, the real callback transport and the real
// Ethereum Ledger driver, so the answer is what the connection's `approve` receives.
const signOnLedger = async (
    message: MessageRequest,
    registry: HardwareWalletRegistry,
): Promise<SignedMessage> => {
    let answer: SignedMessage | undefined
    const request: MessageSignRequest = {
        id: 'eth-ledger-message',
        type: 'message',
        transport: 'callback',
        sourceType: 'walletconnect',
        transportId: 'c1',
        message,
        approve: async signed => {
            answer = signed
        },
    }
    const keyStore = { sign: vi.fn() }
    const input = {
        request,
        allAccounts: [hardwareAccount],
        signTransactions: vi.fn(),
        signArbitraryData: vi.fn(),
        signAuthData: vi.fn(),
        createTransport: () => createCallbackTransport(),
        hardwareWalletRegistry: registry,
        scope: MAINNET,
        keyStore,
    } as unknown as SigningMachineInput
    const actor = createActor(signingMachine, { input })
    actor.start()
    await waitFor(actor, s => s.matches('awaiting_user'))
    actor.send({ type: 'USER_APPROVED' })
    await waitFor(actor, s => s.matches('completed'))
    expect(keyStore.sign).not.toHaveBeenCalled()
    if (!answer) throw new Error('the request was never approved')
    return answer
}

const hexOf = (signed: SignedMessage) =>
    `0x${bytesToHex(signed.signature.bytes)}` as const

describe('signing an Ethereum message on a Ledger through the machine', () => {
    beforeAll(() => {
        registerAlgorandRulesAs('ethereum', {
            descriptor: ethereumDescriptor,
            localKeyKinds: ethereumLocalKeyKinds,
        })
        addressCodecs.register(ethereumAddressCodec)
        transactionReviewers.register(ethereumReviewerAdapter)
    })

    afterAll(() => {
        addressCodecs.reset()
    })

    // The package setup resets this registry before every test.
    beforeEach(() => {
        messageSignerChainAdapters.register(ethereumMessageSignerAdapter)
    })

    it('signs personal_sign on a Ledger into what viem signs, and viem verifies it', async () => {
        const { registry, connect } = registryFor()

        const signature = hexOf(
            await signOnLedger(
                personalSignMessageRequest(MAINNET, SENDER, HELLO_WORLD_HEX),
                registry,
            ),
        )

        expect(connect).toHaveBeenCalledWith('device-1', 'ethereum')
        expect(signature).toBe(VIEM_HELLO_WORLD)
        await expect(
            verifyMessage({
                address: SENDER,
                message: 'hello world',
                signature,
            }),
        ).resolves.toBe(true)
    })

    it('signs eth_signTypedData_v4 on a Ledger into what viem signs, and viem verifies it', async () => {
        const { registry } = registryFor()

        const signature = hexOf(
            await signOnLedger(
                typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA),
                registry,
            ),
        )

        expect(signature).toBe(VIEM_MAIL)
        await expect(
            verifyTypedData({ address: SENDER, signature, ...MAIL_TYPED_DATA }),
        ).resolves.toBe(true)
    })

    it('signs typed data in hashed mode on an app without full EIP-712, and viem verifies it', async () => {
        const { registry } = registryFor({ fullEip712: false })

        const signature = hexOf(
            await signOnLedger(
                typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA),
                registry,
            ),
        )

        expect(signature).toBe(VIEM_MAIL)
        await expect(
            verifyTypedData({ address: SENDER, signature, ...MAIL_TYPED_DATA }),
        ).resolves.toBe(true)
    })

    it('refuses typed data for another chain before connecting the device', async () => {
        const { registry, connect } = registryFor()
        const request: MessageSignRequest = {
            id: 'eth-ledger-polygon',
            type: 'message',
            transport: 'callback',
            sourceType: 'walletconnect',
            transportId: 'c1',
            message: typedDataMessageRequest(MAINNET, SENDER, {
                ...MAIL_TYPED_DATA,
                domain: { ...MAIL_TYPED_DATA.domain, chainId: 137 },
            }),
            approve: vi.fn(),
        }
        const input = {
            request,
            allAccounts: [hardwareAccount],
            signTransactions: vi.fn(),
            signArbitraryData: vi.fn(),
            signAuthData: vi.fn(),
            createTransport: () => createCallbackTransport(),
            hardwareWalletRegistry: registry,
            scope: MAINNET,
            keyStore: { sign: vi.fn() },
        } as unknown as SigningMachineInput
        const actor = createActor(signingMachine, { input })
        actor.start()

        await waitFor(
            actor,
            s =>
                s.matches('awaiting_user') ||
                s.matches('failed') ||
                s.status === 'done',
        )
        if (actor.getSnapshot().matches('awaiting_user')) {
            actor.send({ type: 'USER_APPROVED' })
            await waitFor(
                actor,
                s => !s.matches('awaiting_user') && !s.matches('signing'),
            )
        }

        const snapshot = actor.getSnapshot()
        expect(snapshot.matches('failed')).toBe(true)
        expect(String(snapshot.context.error?.message)).toContain(
            'The typed data is for EIP-155 chain 137, not mainnet',
        )
        expect(connect).not.toHaveBeenCalled()
        expect(request.approve).not.toHaveBeenCalled()
    })
})
