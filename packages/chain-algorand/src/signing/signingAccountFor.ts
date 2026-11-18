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
    findAccountByAddressOn,
    getSignerFor,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { SignedFor } from '@perawallet/wallet-core-signing'
import { ALGORAND_CHAIN_ID } from '../chain-id'

/**
 * The account whose key signs a slot: a named signer is that key itself, so
 * its own rekey isn't followed; an account signed for is one hop away.
 */
export const signingAccountOf = (
    { address, isSigner }: SignedFor,
    accounts: WalletAccount[],
): Nullable<WalletAccount> =>
    isSigner
        ? (findAccountByAddressOn(accounts, ALGORAND_CHAIN_ID, address) ?? null)
        : getSignerFor(address, accounts, ALGORAND_CHAIN_ID)

/**
 * {@link signingAccountOf} for a transaction from `sender` with an ARC-0001
 * `namedSigner`. Fee assignment only sees ARC-0001 overrides, whose payloads
 * always carry the named signer as their authority, so every override is the
 * planner's named signer, the sender included.
 */
export const signingAccountFor = (
    sender: string,
    namedSigner: Optional<string>,
    accounts: WalletAccount[],
): Nullable<WalletAccount> =>
    signingAccountOf(
        namedSigner === undefined
            ? { address: sender, isSigner: false }
            : { address: namedSigner, isSigner: true },
        accounts,
    )
