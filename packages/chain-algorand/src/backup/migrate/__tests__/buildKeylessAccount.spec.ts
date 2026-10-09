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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '../../../__tests__/registerAlgorandAccounts'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    generateOrderedUniqueId: vi.fn(() => 'mock-time-uuid'),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    // The accounts barrel installs a network-switch subscription at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
}))

import {
    isHardwareWalletAccount,
    isMultisigAccount,
    useAccountChainStateStore,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    multisigChainAdapters,
    type MultisigParameters,
} from '@perawallet/wallet-core-multisig'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import {
    buildWatchAccount,
    buildLedgerAccount,
    buildMultiSigAccount,
    recordLegacyAuthority,
} from '../buildKeylessAccount'

const buildLegacyAccount = (
    overrides: Partial<LegacyAccount> = {},
): LegacyAccount =>
    ({
        address: 'ADDR_LEGACY',
        name: 'Legacy Name',
        type: 'standard',
        preferredOrder: 0,
        isBackedUp: true,
        secretKey: null,
        hdWalletId: null,
        ledger: null,
        joint: null,
        authAddress: null,
        ...overrides,
    }) as LegacyAccount

const deriveAddress = vi.fn(
    ({ version, threshold, addresses }: MultisigParameters) =>
        `MSIG:v${version}:t${threshold}:${addresses.join(',')}`,
)

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
    deriveAddress.mockClear()
    multisigChainAdapters.reset()
    multisigChainAdapters.register({
        chainId: LEGACY_CHAIN_ID,
        deriveAddress,
        assembleSignedTransactions: vi.fn(),
        validateSignRequest: vi.fn(),
    })
})

describe('buildWatchAccount', () => {
    it('builds a watch-type WalletAccount with id, name, and address', () => {
        const legacy = buildLegacyAccount({
            address: 'ADDR_WATCH',
            name: 'My Watcher',
            type: 'watch',
        })

        const account = buildWatchAccount(legacy)

        expect(account).toEqual({
            id: 'mock-time-uuid',
            name: 'My Watcher',
            address: 'ADDR_WATCH',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'ADDR_WATCH' } },
        })
    })

    it('returns undefined name when legacy name is an empty string', () => {
        const legacy = buildLegacyAccount({ name: '' })

        const account = buildWatchAccount(legacy)

        expect(account.name).toBeUndefined()
    })

    it('carries no authority on the account itself', () => {
        const account = buildWatchAccount(
            buildLegacyAccount({
                type: 'standard',
                secretKey: null,
                authAddress: 'AUTHADDR',
            }),
        )

        expect(account).not.toHaveProperty('rekeyAddress')
        expect(account).not.toHaveProperty('rekeyAddressByNetwork')
    })
})

describe('buildLedgerAccount', () => {
    it('throws when ledger details are missing', () => {
        const legacy = buildLegacyAccount({ type: 'ledger', ledger: null })

        expect(() => buildLedgerAccount(legacy)).toThrow(
            'Ledger account missing ledger details',
        )
    })

    it('maps ledger details into a hardware-type WalletAccount', () => {
        const legacy = buildLegacyAccount({
            address: 'ADDR_LEDGER',
            name: 'Ledger 1',
            type: 'ledger',
            ledger: {
                bluetoothAddress: 'BT-ADDR',
                bluetoothName: 'Ledger Nano X',
                positionInLedger: 3,
            },
        })

        const account = buildLedgerAccount(legacy)

        expect(account).toEqual({
            id: 'mock-time-uuid',
            name: 'Ledger 1',
            address: 'ADDR_LEDGER',
            hardwareDetails: {
                manufacturer: 'ledger',
                transportType: 'ble',
                deviceId: 'BT-ADDR',
                deviceName: 'Ledger Nano X',
                accountIndex: 3,
            },
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    transportType: 'ble',
                    deviceId: 'BT-ADDR',
                    deviceName: 'Ledger Nano X',
                },
                accountIndex: 3,
            },
            chains: { algorand: { address: 'ADDR_LEDGER' } },
        })
    })

    it('defaults deviceName to an empty string when bluetoothName is null', () => {
        const legacy = buildLegacyAccount({
            type: 'ledger',
            ledger: {
                bluetoothAddress: 'BT',
                bluetoothName: null,
                positionInLedger: 0,
            },
        })

        const account = buildLedgerAccount(legacy)

        if (!isHardwareWalletAccount(account))
            throw new Error('expected hardware account')
        expect(account.hardwareDetails.deviceName).toBe('')
    })

    it('returns undefined name when legacy name is empty', () => {
        const legacy = buildLegacyAccount({
            type: 'ledger',
            name: '',
            ledger: {
                bluetoothAddress: 'BT',
                bluetoothName: 'X',
                positionInLedger: 0,
            },
        })

        const account = buildLedgerAccount(legacy)

        expect(account.name).toBeUndefined()
    })
})

describe('buildMultiSigAccount', () => {
    it('throws when joint details are missing', () => {
        const legacy = buildLegacyAccount({ type: 'joint', joint: null })

        expect(() => buildMultiSigAccount(legacy)).toThrow(
            'Multisig account missing joint details',
        )
    })

    it('throws when participants is empty', () => {
        const legacy = buildLegacyAccount({
            address: 'ADDR_MSIG',
            type: 'joint',
            joint: { threshold: 2, version: 1, participants: [] },
        })

        expect(() => buildMultiSigAccount(legacy)).toThrow(
            'Multisig account ADDR_MSIG has no participants',
        )
    })

    it('uses the stored threshold when present without deriving', () => {
        const legacy = buildLegacyAccount({
            address: 'ADDR_MSIG',
            name: 'Joint',
            type: 'joint',
            joint: {
                threshold: 2,
                version: 1,
                participants: ['P1', 'P2', 'P3'],
            },
        })

        const account = buildMultiSigAccount(legacy)

        expect(account).toEqual({
            id: 'mock-time-uuid',
            name: 'Joint',
            address: 'ADDR_MSIG',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
            custody: { kind: 'multisig' },
            chains: {
                algorand: {
                    address: 'ADDR_MSIG',
                    native: {
                        family: 'algorand',
                        multisig: {
                            version: 1,
                            threshold: 2,
                            addresses: ['P1', 'P2', 'P3'],
                        },
                    },
                },
            },
        })
        expect(deriveAddress).not.toHaveBeenCalled()
    })

    it('derives the threshold by brute-forcing when not stored', () => {
        const participants = ['P1', 'P2', 'P3']
        const expectedAddress = `MSIG:v1:t2:P1,P2,P3`
        const legacy = buildLegacyAccount({
            address: expectedAddress,
            type: 'joint',
            joint: { threshold: null, version: 1, participants },
        })

        const account = buildMultiSigAccount(legacy)

        if (!isMultisigAccount(account))
            throw new Error('expected multisig account')
        expect(account.multisigDetails.threshold).toBe(2)
        expect(deriveAddress).toHaveBeenCalledWith({
            version: 1,
            threshold: 1,
            addresses: participants,
        })
        expect(deriveAddress).toHaveBeenCalledWith({
            version: 1,
            threshold: 2,
            addresses: participants,
        })
    })

    it('throws when no candidate threshold matches the stored address', () => {
        const legacy = buildLegacyAccount({
            address: 'ADDR_DOES_NOT_MATCH',
            type: 'joint',
            joint: {
                threshold: null,
                version: 1,
                participants: ['P1', 'P2'],
            },
        })

        expect(() => buildMultiSigAccount(legacy)).toThrow(
            /Could not derive multisig threshold for ADDR_DOES_NOT_MATCH/,
        )
    })
})

describe('recordLegacyAuthority', () => {
    const slice = () => useAccountChainStateStore.getState().states

    it("writes the legacy auth address under the active network's scope", () => {
        recordLegacyAuthority(buildLegacyAccount({ authAddress: 'AUTH' }))

        expect(slice()['algorand/mainnet' as never]?.ADDR_LEGACY).toMatchObject(
            {
                family: 'algorand',
                authAddress: 'AUTH',
            },
        )
    })

    it('writes nothing without an auth address', () => {
        recordLegacyAuthority(buildLegacyAccount({ authAddress: null }))

        expect(slice()).toEqual({})
    })

    it('does not overwrite an existing entry', () => {
        recordLegacyAuthority(buildLegacyAccount({ authAddress: 'FIRST' }))
        recordLegacyAuthority(buildLegacyAccount({ authAddress: 'SECOND' }))

        expect(slice()['algorand/mainnet' as never]?.ADDR_LEGACY).toMatchObject(
            { authAddress: 'FIRST' },
        )
    })
})
