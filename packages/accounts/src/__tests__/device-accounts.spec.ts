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

import { describe, expect, it } from 'vitest'
import { buildAccount } from '../credentials'
import {
    buildDeviceAccountRegistrations,
    toDeviceAccountType,
} from '../device-accounts'
import {
    AccountTypes,
    DerivationTypes,
    type AccountCredentials,
    type WalletAccount,
} from '../models'

const account = (address: string, type: WalletAccount['type']): WalletAccount =>
    ({ id: address, address, type, keyPairId: 'kp' }) as WalletAccount

describe('toDeviceAccountType', () => {
    it('maps every account type onto its wire value', () => {
        expect(Object.values(AccountTypes).map(toDeviceAccountType)).toEqual([
            'algo25',
            'hdWallet',
            'hardware',
            'multisig',
            'watch',
            'quantum',
        ])
    })
})

describe('buildDeviceAccountRegistrations', () => {
    it('reports a quantum account with the quantum wire type', () => {
        const result = buildDeviceAccountRegistrations(
            [account('QADDR', AccountTypes.quantum)],
            [],
        )

        expect(result).toEqual([
            {
                address: 'QADDR',
                accountType: 'quantum',
                receiveNotifications: true,
            },
        ])
    })

    it('reports a watched address as watch, not as a boolean flag', () => {
        const result = buildDeviceAccountRegistrations(
            [account('WADDR', AccountTypes.watch)],
            [],
        )

        expect(result[0].accountType).toBe('watch')
    })

    it('marks muted addresses as not receiving notifications', () => {
        const result = buildDeviceAccountRegistrations(
            [
                account('ADDR_A', AccountTypes.algo25),
                account('ADDR_B', AccountTypes.algo25),
            ],
            ['ADDR_B'],
        )

        expect(result.map(entry => entry.receiveNotifications)).toEqual([
            true,
            false,
        ])
    })

    it('returns an empty array for an empty account list', () => {
        expect(buildDeviceAccountRegistrations([], ['ADDR_A'])).toEqual([])
    })

    it('registers credential-bearing accounts exactly as their legacy-shaped twins', () => {
        // A credential a later chain adds must not change what the devices API
        // is told. It isn't a `ChainId` member, hence the widening cast.
        const fixtureChainCredential = (
            keyPairId: string,
        ): AccountCredentials =>
            ({
                'fixture-chain': { keyPairId: `fixture-${keyPairId}` },
            }) as unknown as AccountCredentials
        const credentials = (keyPairId: string) => ({
            ...fixtureChainCredential(keyPairId),
            algorand: { keyPairId },
        })
        const hd = {
            account: 0,
            change: 0,
            keyIndex: 1,
            derivationType: DerivationTypes.Peikert,
        }
        const ledger = {
            manufacturer: 'ledger',
            deviceId: 'ble-1',
            deviceName: 'Ledger Nano X',
            transportType: 'ble',
        } as const
        const credentialBearing: WalletAccount[] = [
            buildAccount({
                address: 'ALGO25ADDR',
                provenance: { kind: 'local', seed: 'algo25' },
                credentials: credentials('algo25-key'),
            }),
            buildAccount({
                address: 'HDADDR',
                provenance: { kind: 'local', seed: 'bip39', hd },
                credentials: credentials('hd-key'),
            }),
            buildAccount({
                address: 'LEDGERADDR',
                provenance: {
                    kind: 'hardware',
                    device: ledger,
                    accountIndex: 0,
                },
            }),
            buildAccount({
                address: 'MSIGADDR',
                provenance: {
                    kind: 'multisig',
                    threshold: 1,
                    members: ['MEMBERA', 'MEMBERB'],
                    version: 1,
                },
            }),
            buildAccount({
                address: 'WATCHADDR',
                provenance: { kind: 'watch' },
                credentials: fixtureChainCredential('watch'),
            }),
            buildAccount({
                address: 'QUANTUMADDR',
                provenance: { kind: 'local', seed: 'quantum' },
                credentials: credentials('quantum-key'),
            }),
        ]
        const legacyShaped: WalletAccount[] = [
            account('ALGO25ADDR', AccountTypes.algo25),
            {
                ...account('HDADDR', AccountTypes.hdWallet),
                hdWalletDetails: hd,
            } as WalletAccount,
            {
                id: 'LEDGERADDR',
                address: 'LEDGERADDR',
                type: AccountTypes.hardware,
                hardwareDetails: { ...ledger, accountIndex: 0 },
            },
            {
                id: 'MSIGADDR',
                address: 'MSIGADDR',
                type: AccountTypes.multisig,
                multisigDetails: {
                    threshold: 1,
                    addresses: ['MEMBERA', 'MEMBERB'],
                    version: 1,
                },
            },
            { id: 'WATCHADDR', address: 'WATCHADDR', type: AccountTypes.watch },
            account('QUANTUMADDR', AccountTypes.quantum),
        ]

        const result = buildDeviceAccountRegistrations(credentialBearing, [
            'WATCHADDR',
        ])

        expect(result).toEqual(
            buildDeviceAccountRegistrations(legacyShaped, ['WATCHADDR']),
        )
        expect(result).toEqual([
            {
                address: 'ALGO25ADDR',
                accountType: 'algo25',
                receiveNotifications: true,
            },
            {
                address: 'HDADDR',
                accountType: 'hdWallet',
                receiveNotifications: true,
            },
            {
                address: 'LEDGERADDR',
                accountType: 'hardware',
                receiveNotifications: true,
            },
            {
                address: 'MSIGADDR',
                accountType: 'multisig',
                receiveNotifications: true,
            },
            {
                address: 'WATCHADDR',
                accountType: 'watch',
                receiveNotifications: false,
            },
            {
                address: 'QUANTUMADDR',
                accountType: 'quantum',
                receiveNotifications: true,
            },
        ])
    })
})
