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

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { createActor, waitFor } from 'xstate'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    transactionReviewers,
    type ChainScope,
    type MessageRequest,
    type SignedMessage,
} from '@perawallet/wallet-core-chain-contract'
import { bytesToHex } from '@perawallet/wallet-core-shared'
import {
    MAIL_TYPED_DATA,
    SENDER,
    SIGNER_KEY_PAIR_ID,
    VIEM_HELLO_WORLD,
    VIEM_MAIL,
    createVectorKeyStore,
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
import { ReviewRequiredError } from '../../pipeline/errors'
import { createCallbackTransport } from '../../pipeline/transports/createCallbackTransport'
import type { SigningMachineInput } from '../context'
import { signingMachine } from '../signingMachine'

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const account = {
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 0 },
    },
    address: 'ALGORAND_ADDRESS',
    chains: { ethereum: { address: SENDER, keyPairId: SIGNER_KEY_PAIR_ID } },
} as unknown as WalletAccount

const HELLO_WORLD_HEX = '0x68656c6c6f20776f726c64'

const inputFor = (request: MessageSignRequest) => {
    const { kms } = createVectorKeyStore()
    return {
        request,
        allAccounts: [account],
        signTransactions: vi.fn(),
        signArbitraryData: vi.fn(),
        signAuthData: vi.fn(),
        createTransport: () => createCallbackTransport(),
        scope: MAINNET,
        keyStore: kms,
    } as unknown as SigningMachineInput
}

const requestFor = (
    message: MessageRequest,
    overrides: Partial<MessageSignRequest> = {},
): MessageSignRequest => ({
    id: 'eth-message',
    type: 'message',
    transport: 'callback',
    sourceType: 'walletconnect',
    transportId: 'c1',
    message,
    ...overrides,
})

// Signs every approved request through the real machine and the real callback
// transport, so the answer is what the connection's `approve` receives.
const signThroughMachine = async (
    message: MessageRequest,
): Promise<SignedMessage> => {
    let answer: SignedMessage | undefined
    const request = requestFor(message, {
        approve: async signed => {
            answer = signed
        },
    })
    const actor = createActor(signingMachine, { input: inputFor(request) })
    actor.start()
    await waitFor(actor, s => s.matches('awaiting_user'))
    actor.send({ type: 'USER_APPROVED' })
    await waitFor(actor, s => s.matches('completed'))
    if (!answer) throw new Error('the request was never approved')
    return answer
}

describe('signing an Ethereum message through the machine', () => {
    beforeAll(() => {
        registerAlgorandRulesAs('ethereum', {
            descriptor: ethereumDescriptor,
            localKeyKinds: ethereumLocalKeyKinds,
        })
        transactionReviewers.register(ethereumReviewerAdapter)
    })

    // The package setup resets this registry before every test.
    beforeEach(() => {
        messageSignerChainAdapters.register(ethereumMessageSignerAdapter)
    })

    it("signs personal_sign exactly as viem's signMessage does, and viem verifies it for the signer", async () => {
        const signed = await signThroughMachine(
            personalSignMessageRequest(MAINNET, SENDER, HELLO_WORLD_HEX),
        )

        const signature = `0x${bytesToHex(signed.signature.bytes)}` as const
        expect(signature).toBe(VIEM_HELLO_WORLD)
        await expect(
            verifyMessage({
                address: SENDER,
                message: 'hello world',
                signature,
            }),
        ).resolves.toBe(true)
    })

    it("signs eth_signTypedData_v4 exactly as viem's signTypedData does, and viem verifies it for the signer", async () => {
        const signed = await signThroughMachine(
            typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA),
        )

        const signature = `0x${bytesToHex(signed.signature.bytes)}` as const
        expect(signature).toBe(VIEM_MAIL)
        await expect(
            verifyTypedData({
                address: SENDER,
                signature,
                ...MAIL_TYPED_DATA,
            }),
        ).resolves.toBe(true)
    })

    it('refuses a headless message request instead of signing it unreviewed', async () => {
        const request = requestFor(
            personalSignMessageRequest(MAINNET, SENDER, HELLO_WORLD_HEX),
            { sourceType: 'local' },
        )
        const actor = createActor(signingMachine, { input: inputFor(request) })
        actor.start()

        const state = await waitFor(actor, s => s.matches('failed'))

        expect(state.context.error).toBeInstanceOf(ReviewRequiredError)
        expect(state.context.signingResults).toBeNull()
    })
})
