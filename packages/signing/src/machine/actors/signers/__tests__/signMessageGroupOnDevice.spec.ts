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

import { describe, expect, it, vi } from 'vitest'
import type { HardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    MessageRequest,
    SignedMessage,
    SigningRequest,
} from '@perawallet/wallet-core-chain-contract'
import {
    createHardwareWalletRegistry,
    type HardwareWalletRegistry,
    type HardwareWalletTransport,
    type HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import { registerFakeMessageSignerAdapter } from '../../../../__tests__/fakeMessageSignerAdapter'
import { TEST_CHAIN_ID, ledgerAccount } from '../../../../__tests__/accounts'
import {
    CannotSignError,
    InvalidSignableDataError,
    SigningError,
} from '../../../../pipeline/errors'
import type { AnalyzedSignableGroup } from '../../../../pipeline/types'
import { signMessageGroupOnDevice } from '../signMessageGroupOnDevice'

const SIGNER = 'SIGNER_ADDRESS'
const SCOPE = { chainId: TEST_CHAIN_ID, networkId: 'mainnet' }
const DEVICE_PAYLOAD = new Uint8Array([7, 7, 7])
const DEVICE_SIGNATURE = new Uint8Array([1, 2, 3, 4])
const account = ledgerAccount(SIGNER, 2) as HardwareWalletAccount

const request: MessageRequest = {
    scope: SCOPE,
    method: 'plain',
    signer: SIGNER,
    payload: {},
}

const planned = (overrides: Partial<SigningRequest> = {}): SigningRequest[] => [
    {
        requestIndex: 0,
        signer: SIGNER,
        scheme: 'ed25519',
        payload: new Uint8Array([5, 5]),
        devicePayload: DEVICE_PAYLOAD,
        ...overrides,
    },
]

const signed: SignedMessage = {
    scope: SCOPE,
    signature: {
        requestIndex: 0,
        signer: SIGNER,
        scheme: 'ed25519',
        bytes: new Uint8Array([9, 9]),
    },
}

const groupOf = (data: AnalyzedSignableGroup['data']): AnalyzedSignableGroup =>
    ({
        data,
        source: { type: 'walletconnect' },
        signerAddress: SIGNER,
        originalIndices: [0],
        analysis: { signableAddresses: [SIGNER] },
    }) as unknown as AnalyzedSignableGroup

const AUTH_DATA = {
    data: 'ZGF0YQ==',
    signer: SIGNER,
    domain: 'example.io',
    authenticatorData: new Uint8Array(37),
}
const AUTH_METADATA = { scope: 1, encoding: 'base64' }

const makeTransport = (
    overrides: Partial<HardwareWalletTransport> = {},
): HardwareWalletTransport => ({
    getAddress: vi.fn().mockResolvedValue({
        address: SIGNER,
        publicKey: new Uint8Array(32),
        accountIndex: 2,
    }),
    signTransaction: vi.fn(),
    signMessage: vi.fn().mockResolvedValue(DEVICE_SIGNATURE),
    getAppVersion: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
})

const setup = (transport: HardwareWalletTransport = makeTransport()) => {
    const provider: HardwareWalletTransportProvider = {
        manufacturer: 'ledger',
        transportType: 'ble',
        scan: () => () => {},
        connect: vi.fn().mockResolvedValue(transport),
        isSupported: vi.fn().mockResolvedValue(true),
    }
    const registry: HardwareWalletRegistry = createHardwareWalletRegistry()
    registry.register(provider)
    return { transport, provider, registry }
}

const sign = (
    group: AnalyzedSignableGroup,
    registry: HardwareWalletRegistry,
    signal?: AbortSignal,
) =>
    signMessageGroupOnDevice({
        group,
        account,
        allAccounts: [account],
        scope: SCOPE,
        registry,
        callbacks: { signal },
    })

describe('signMessageGroupOnDevice', () => {
    it('signs the planned device payload on the device and returns what the chain assembles', async () => {
        const adapter = registerFakeMessageSignerAdapter({
            plan: vi.fn(() => planned()),
            assemble: vi.fn(() => signed),
        })
        const { transport, registry } = setup()

        const result = await sign(
            groupOf({ type: 'message', request }),
            registry,
        )

        expect(adapter.plan).toHaveBeenCalledWith(request, {
            account,
            accounts: [account],
        })
        expect(transport.signMessage).toHaveBeenCalledWith(2, DEVICE_PAYLOAD)
        expect(adapter.assemble).toHaveBeenCalledWith(request, [
            {
                requestIndex: 0,
                signer: SIGNER,
                scheme: 'ed25519',
                bytes: DEVICE_SIGNATURE,
            },
        ])
        expect(result).toEqual({
            signedData: { type: 'message', signed },
            signers: [{ address: SIGNER }],
            originalIndices: [0],
        })
    })

    it("signs auth-data through the chain's message signer and answers with the bare signature", async () => {
        const adapter = registerFakeMessageSignerAdapter({
            plan: vi.fn(() => planned()),
            assemble: vi.fn(() => signed),
        })
        const { registry } = setup()

        const result = await sign(
            groupOf({
                type: 'auth-data',
                authData: AUTH_DATA,
                metadata: AUTH_METADATA,
            }),
            registry,
        )

        expect(adapter.plan).toHaveBeenCalledWith(
            {
                scope: SCOPE,
                method: 'auth-data',
                signer: SIGNER,
                payload: { authData: AUTH_DATA, metadata: AUTH_METADATA },
            },
            expect.anything(),
        )
        expect(result.signedData).toEqual({
            type: 'auth-data',
            signature: signed.signature.bytes,
        })
    })

    it('refuses a request whose plan has no device payload without connecting', async () => {
        registerFakeMessageSignerAdapter({
            plan: vi.fn(() => planned({ devicePayload: undefined })),
        })
        const { provider, registry } = setup()

        const error = await sign(
            groupOf({ type: 'message', request }),
            registry,
        ).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(InvalidSignableDataError)
        expect((error as SigningError).metadata?.retryable).toBe(false)
        expect(provider.connect).not.toHaveBeenCalled()
    })

    it('refuses a plan whose signer is not the account without connecting', async () => {
        registerFakeMessageSignerAdapter({
            plan: vi.fn(() => planned({ signer: 'SOMEONE_ELSE' })),
        })
        const { provider, registry } = setup()

        await expect(
            sign(groupOf({ type: 'message', request }), registry),
        ).rejects.toBeInstanceOf(CannotSignError)
        expect(provider.connect).not.toHaveBeenCalled()
    })

    it("turns the chain's refusal into an invalid-payload error without connecting", async () => {
        registerFakeMessageSignerAdapter({
            plan: vi.fn(() => {
                throw new Error('the typed data is for another chain')
            }),
        })
        const { provider, registry } = setup()

        await expect(
            sign(groupOf({ type: 'message', request }), registry),
        ).rejects.toThrow(
            new InvalidSignableDataError('the typed data is for another chain'),
        )
        expect(provider.connect).not.toHaveBeenCalled()
    })

    it('refuses a method the chain does not sign without connecting', async () => {
        registerFakeMessageSignerAdapter({ supports: vi.fn(() => false) })
        const { provider, registry } = setup()

        await expect(
            sign(groupOf({ type: 'message', request }), registry),
        ).rejects.toBeInstanceOf(CannotSignError)
        expect(provider.connect).not.toHaveBeenCalled()
    })

    it('aborting while the device waits disconnects the transport', async () => {
        registerFakeMessageSignerAdapter({ plan: vi.fn(() => planned()) })
        const controller = new AbortController()
        let rejectExchange: (error: Error) => void = () => {}
        const transport = makeTransport({
            signMessage: vi.fn(
                () =>
                    new Promise<Uint8Array>((_, reject) => {
                        rejectExchange = reject
                    }),
            ),
            disconnect: vi.fn(async () => {
                rejectExchange(new Error('DisconnectedDeviceDuringOperation'))
            }),
        })
        const { registry } = setup(transport)

        const rejection = sign(
            groupOf({ type: 'message', request }),
            registry,
            controller.signal,
        ).catch((e: unknown) => e)
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(transport.signMessage).toHaveBeenCalledTimes(1)

        controller.abort()
        await rejection

        expect(transport.disconnect).toHaveBeenCalled()
    })
})
