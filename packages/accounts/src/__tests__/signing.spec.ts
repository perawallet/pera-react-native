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

import { beforeEach, describe, expect, it } from 'vitest'
import { canSignArbitraryData } from '../utils'
import { useAccountChainStateStore } from '../store'
import { registerFakeAccountsChain, seedAuthority } from './fakeAccountsChain'
import {
    type StandaloneAccount,
    type HDWalletAccount,
    type HardwareWalletAccount,
    type MultiSigAccount,
    type WatchAccount,
    type WalletAccount,
} from '../models'

const algo25 = (
    address: string,
    extra: Partial<StandaloneAccount> = {},
): StandaloneAccount => ({
    custody: { kind: 'local', seed: null },
    address,
    keyPairId: 'kp',
    ...extra,
})

const hdWallet = (
    address: string,
    extra: Partial<HDWalletAccount> = {},
): HDWalletAccount => ({
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    address,
    keyPairId: 'kp',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 32,
    },
    ...extra,
})

const hardware = (
    address: string,
    extra: Partial<HardwareWalletAccount> = {},
): HardwareWalletAccount => ({
    custody: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'd',
            deviceName: 'Ledger',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    address,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'd',
        deviceName: 'Ledger',
        accountIndex: 0,
        transportType: 'ble',
    },
    ...extra,
})

const multisig = (
    address: string,
    participants: string[],
    extra: Partial<MultiSigAccount> = {},
): MultiSigAccount => ({
    custody: { kind: 'multisig' },
    address,
    multisigDetails: { threshold: 2, addresses: participants, version: 1 },
    ...extra,
})

const watch = (address: string): WatchAccount => ({
    custody: { kind: 'watch' },
    address,
})

beforeEach(() => {
    registerFakeAccountsChain()
    useAccountChainStateStore.getState().resetState()
})

describe('canSignArbitraryData', () => {
    it('returns true for a standard algo25', () => {
        const a = algo25('A')
        expect(canSignArbitraryData(a)).toBe(true)
    })

    it('returns true for an HD wallet account', () => {
        const a = hdWallet('A')
        expect(canSignArbitraryData(a)).toBe(true)
    })

    it('returns false for a hardware wallet — Ledger has no raw-byte opcode', () => {
        const a = hardware('A')
        expect(canSignArbitraryData(a)).toBe(false)
    })

    it('returns false for a multisig — no multisig signature shape for raw data', () => {
        const ms = multisig('M', ['P1', 'P2'])
        expect(canSignArbitraryData(ms)).toBe(false)
    })

    it('returns false for watch accounts', () => {
        const a = watch('A')
        expect(canSignArbitraryData(a)).toBe(false)
    })

    it('returns true for an algo25/HD even if rekeyed — own keypair still signs', () => {
        // The dApp verifies the signature against the requested address's
        // own pubkey; the on-chain auth-addr is irrelevant for off-chain
        // data. Holding the account's own keypair is sufficient.
        const a: WalletAccount = algo25('A')
        seedAuthority('A', 'S')
        expect(canSignArbitraryData(a)).toBe(true)
    })

    it('returns false for a watch-rekeyed account regardless of auth', () => {
        // We hold the auth account, but the dApp expects a signature from
        // the watch address's pubkey — which we never had.
        const a = watch('A')
        seedAuthority('A', 'S')
        expect(canSignArbitraryData(a)).toBe(false)
    })
})
