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

import { describe, it, expect } from 'vitest'
import { resolveHardwareDeviceName } from '../resolveHardwareDeviceName'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { AnalyzedSignableGroup } from '../../../pipeline/types'

const ledgerAccount = (address: string, rekeyAddress?: string) =>
    ({
        type: 'hardware',
        address,
        rekeyAddress,
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'dev-1',
            deviceName: 'Nano X',
            accountIndex: 0,
            transportType: 'ble',
        },
    }) as unknown as WalletAccount

const watchAccount = (address: string, rekeyAddress?: string) =>
    ({ type: 'watch', address, rekeyAddress }) as unknown as WalletAccount

const group = (
    signerAddress: string,
    source: AnalyzedSignableGroup['source'] = { type: 'local' },
): AnalyzedSignableGroup =>
    ({
        data: { type: 'transactions', transactions: [], indicesToSign: [] },
        source,
        signerAddress,
        analysis: {
            totalFees: 0n,
            transactionSummaries: [],
            warnings: [],
            signableAddresses: [],
            riskLevel: 'low',
        },
    }) as unknown as AnalyzedSignableGroup

describe('resolveHardwareDeviceName', () => {
    it('resolves the device name when the sender itself is the Ledger', () => {
        const sender = ledgerAccount('SENDER')

        expect(resolveHardwareDeviceName([group('SENDER')], [sender])).toBe(
            'Nano X',
        )
    })

    it('resolves the device name from the auth account for a rekeyed-to-Ledger sender', () => {
        // The signature comes from the AUTH account's device — the sender has
        // no hardwareDetails, so reading the sender leaves the overlay with
        // generic copy.
        const sender = watchAccount('SENDER', 'AUTH')
        const auth = ledgerAccount('AUTH')

        expect(
            resolveHardwareDeviceName([group('SENDER')], [sender, auth]),
        ).toBe('Nano X')
    })

    it('reads the participant itself for multisig-cosign groups (rekey bypassed)', () => {
        const participant = ledgerAccount('PARTICIPANT', 'ELSEWHERE')

        expect(
            resolveHardwareDeviceName(
                [
                    group('PARTICIPANT', {
                        type: 'multisig-cosign',
                        signRequestId: 'sr-1',
                    }),
                ],
                [participant],
            ),
        ).toBe('Nano X')
    })

    it('returns null when the signer account is unknown', () => {
        expect(resolveHardwareDeviceName([group('SENDER')], [])).toBeNull()
    })

    it('returns null when the rekey target is not held', () => {
        const sender = watchAccount('SENDER', 'MISSING_AUTH')

        expect(
            resolveHardwareDeviceName([group('SENDER')], [sender]),
        ).toBeNull()
    })

    it('returns null for an empty group list', () => {
        expect(resolveHardwareDeviceName([], [])).toBeNull()
    })
})
