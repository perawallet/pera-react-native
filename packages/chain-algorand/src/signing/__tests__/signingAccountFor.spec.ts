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
import '../../__tests__/registerAlgorandAccounts'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { seedAuthority } from '../../accounts/__tests__/seedAuthority'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { signingAccountFor } from '../signingAccountFor'
import { makeTestAddress } from './transactions'

const SENDER = makeTestAddress(1).toString()
const NAMED = makeTestAddress(2).toString()
const NAMED_AUTH = makeTestAddress(3).toString()

const localAccount = (id: string, address: string): WalletAccount =>
    ({
        id,
        custody: { kind: 'local', seed: null },
        chains: {
            [ALGORAND_CHAIN_ID]: { address, keyPairId: `kp-${id}` },
        },
    }) as unknown as WalletAccount

const sender = localAccount('sender', SENDER)
const named = localAccount('named', NAMED)
const namedAuth = localAccount('named-auth', NAMED_AUTH)
const accounts = [sender, named, namedAuth]

describe('signingAccountFor', () => {
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
        seedAuthority(NAMED, NAMED_AUTH)
    })

    it("is the sender's own signer when no signer is named", () => {
        expect(signingAccountFor(SENDER, undefined, accounts)).toBe(sender)
    })

    it("signs with the sender's own key when the named signer is the sender", () => {
        expect(signingAccountFor(NAMED, NAMED, accounts)).toBe(named)
    })

    it("is the named signer itself, not the account it's rekeyed to", () => {
        expect(signingAccountFor(SENDER, NAMED, accounts)).toBe(named)
    })

    it('is null for a named signer the wallet does not hold', () => {
        expect(
            signingAccountFor(SENDER, makeTestAddress(9).toString(), accounts),
        ).toBeNull()
    })
})
