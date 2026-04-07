/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi } from 'vitest'
import { createActor, toPromise } from 'xstate'
import { hardwareSignerActor } from '../hardwareSignerActor'
import type { HardwareSignerActorInput } from '../hardwareSignerActor'
import type { AnalyzedSignableGroup } from '../../../../pipeline/types'
import type {
    WalletAccount,
    HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    HardwareWalletTransportProvider,
    HardwareWalletTransport,
} from '@perawallet/wallet-core-hardware-wallet'
import { createHardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'

const ADDR_A = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const ADDR_B = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

const MOCK_SIGNATURE = new Uint8Array([1, 2, 3, 4])

const makeLedgerAccount = (
    address: string,
    accountIndex: number = 0,
): HardwareWalletAccount =>
    ({
        type: 'hardware',
        address,
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'device-1',
            deviceName: 'Nano X',
            accountIndex,
        },
    }) as HardwareWalletAccount

const mockTransaction = (sender: string) =>
    ({
        sender: { toString: () => sender },
    }) as never

const makeGroup = (
    signerAddress: string,
    txnCount: number = 1,
): AnalyzedSignableGroup => ({
    data: {
        type: 'transactions',
        transactions: Array.from({ length: txnCount }, () =>
            mockTransaction(signerAddress),
        ),
        indicesToSign: Array.from({ length: txnCount }, (_, i) => i),
    },
    source: { type: 'local' },
    signerAddress,
    analysis: {
        totalFees: 0n,
        transactionSummaries: [],
        warnings: [],
        signableAddresses: [],
        riskLevel: 'low',
    },
})

const makeMockTransport = (): HardwareWalletTransport => ({
    getAddress: vi.fn().mockResolvedValue({
        address: ADDR_A,
        publicKey: new Uint8Array(32),
        accountIndex: 0,
    }),
    signTransaction: vi.fn().mockResolvedValue(MOCK_SIGNATURE),
    disconnect: vi.fn().mockResolvedValue(undefined),
})

const makeMockProvider = (
    transport: HardwareWalletTransport,
): HardwareWalletTransportProvider => ({
    manufacturer: 'ledger',
    scan: () => () => {},
    connect: vi.fn().mockResolvedValue(transport),
    isSupported: vi.fn().mockResolvedValue(true),
})

const makeRegistry = (provider: HardwareWalletTransportProvider) => {
    const registry = createHardwareWalletRegistry()
    registry.register(provider)
    return registry
}

describe('hardwareSignerActor', () => {
    it('returns SigningResult for a single group', async () => {
        const transport = makeMockTransport()
        const provider = makeMockProvider(transport)

        const input: HardwareSignerActorInput = {
            groups: [makeGroup(ADDR_A)],
            allAccounts: [makeLedgerAccount(ADDR_A)],
            hardwareWalletRegistry: makeRegistry(provider),
            encodeTransaction: vi.fn().mockReturnValue(new Uint8Array([0xaa])),
        }

        const actor = createActor(hardwareSignerActor, { input })
        actor.start()
        const results = await toPromise(actor)

        expect(results).toHaveLength(1)
        expect(results[0].signedData.type).toBe('transactions')
        expect(results[0].signers[0].address).toBe(ADDR_A)
    })

    it('returns SigningResult for multiple groups sequentially', async () => {
        const transport = makeMockTransport()
        const provider = makeMockProvider(transport)

        const input: HardwareSignerActorInput = {
            groups: [makeGroup(ADDR_A), makeGroup(ADDR_A, 2)],
            allAccounts: [makeLedgerAccount(ADDR_A)],
            hardwareWalletRegistry: makeRegistry(provider),
            encodeTransaction: vi.fn().mockReturnValue(new Uint8Array([0xbb])),
        }

        const actor = createActor(hardwareSignerActor, { input })
        actor.start()
        const results = await toPromise(actor)

        expect(results).toHaveLength(2)
        expect(results[0].signedData.type).toBe('transactions')
        expect(results[1].signedData.type).toBe('transactions')
    })

    it('rejects when signer account is not found', async () => {
        const transport = makeMockTransport()
        const provider = makeMockProvider(transport)

        const input: HardwareSignerActorInput = {
            groups: [makeGroup(ADDR_A)],
            allAccounts: [], // no accounts
            hardwareWalletRegistry: makeRegistry(provider),
            encodeTransaction: vi.fn(),
        }

        const actor = createActor(hardwareSignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow(
            'Hardware wallet signer account not found',
        )
    })

    it('rejects when account is not a hardware wallet account', async () => {
        const transport = makeMockTransport()
        const provider = makeMockProvider(transport)

        const nonHardwareAccount: WalletAccount = {
            type: 'algo25',
            address: ADDR_B,
            keyPairId: 'key-1',
        } as unknown as WalletAccount

        const input: HardwareSignerActorInput = {
            groups: [makeGroup(ADDR_B)],
            allAccounts: [nonHardwareAccount],
            hardwareWalletRegistry: makeRegistry(provider),
            encodeTransaction: vi.fn(),
        }

        const actor = createActor(hardwareSignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow(
            'Hardware wallet signer account not found',
        )
    })

    it('rejects when no provider is registered for manufacturer', async () => {
        const emptyRegistry = createHardwareWalletRegistry()

        const input: HardwareSignerActorInput = {
            groups: [makeGroup(ADDR_A)],
            allAccounts: [makeLedgerAccount(ADDR_A)],
            hardwareWalletRegistry: emptyRegistry,
            encodeTransaction: vi.fn(),
        }

        const actor = createActor(hardwareSignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow(
            'No hardware wallet provider registered for manufacturer: ledger',
        )
    })
})
