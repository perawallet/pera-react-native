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
import type { WalletAccount } from '../models'
import { testAccount } from './accountFactory'
import { registerFakeAccountsChain, seedAuthority } from './fakeAccountsChain'

const single = (address: string) => testAccount('local', address)
const hdWallet = (address: string) => testAccount('hd', address)
const hardware = (address: string) => testAccount('hardware', address)
const multisig = (address: string) => testAccount('multisig', address)
const watch = (address: string) => testAccount('watch', address)

beforeEach(() => {
    registerFakeAccountsChain()
    useAccountChainStateStore.getState().resetState()
})

describe('canSignArbitraryData', () => {
    it('returns true for a single-key account', () => {
        const a = single('A')
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
        const ms = multisig('M')
        expect(canSignArbitraryData(ms)).toBe(false)
    })

    it('returns false for watch accounts', () => {
        const a = watch('A')
        expect(canSignArbitraryData(a)).toBe(false)
    })

    it('returns true for a key-holding account even if rekeyed — own keypair still signs', () => {
        // The dApp verifies the signature against the requested address's
        // own pubkey; the on-chain auth-addr is irrelevant for off-chain
        // data. Holding the account's own keypair is sufficient.
        const a: WalletAccount = single('A')
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
