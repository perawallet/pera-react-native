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

import { fromPromise } from 'xstate'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { isHardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import type {
    AnalyzedSignableGroup,
    SigningCallbacks,
    SigningResult,
} from '../../../pipeline/types'
import { HardwareWalletError } from '../../../pipeline/errors'
import { createHardwareStrategy } from '../../../pipeline/signing/createHardwareStrategy'
import type { EncodeTransactionFunction } from '../../../pipeline/signing/createHardwareStrategy'
import { resolveSigningAccount } from '../../utils/resolveSigningAccount'

export type HardwareSignerActorInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    hardwareWalletRegistry: HardwareWalletRegistry
    encodeTransaction: EncodeTransactionFunction
    callbacks?: SigningCallbacks
}

/**
 * XState actor for hardware wallet signing.
 *
 * Signs one or more transaction groups using the hardware strategy,
 * which resolves the correct transport provider from the registry
 * based on each account's manufacturer at sign-time.
 */
export const hardwareSignerActor = fromPromise<
    SigningResult[],
    HardwareSignerActorInput
>(async ({ input }) => {
    const { groups, allAccounts, hardwareWalletRegistry, encodeTransaction } =
        input

    const strategy = createHardwareStrategy({
        hardwareWalletRegistry,
        encodeTransaction,
    })

    const results: SigningResult[] = []

    for (const group of groups) {
        const signerAccount = allAccounts.find(
            a => a.address === group.signerAddress,
        )

        if (!signerAccount) {
            throw new HardwareWalletError('signer_not_found')
        }

        // Resolve the account whose key actually produces the signature.
        // For a rekeyed account this follows the rekey chain to the auth
        // account (so Ledger→Ledger rekeys sign with the AUTH device, not
        // the now-unauthorized source), while multisig-cosign participants
        // keep signing with their own key. Shared with localKeySignerActor
        // via resolveSigningAccount so signer routing stays in lockstep.
        const accountForSigning = resolveSigningAccount(
            signerAccount,
            group.source,
            allAccounts,
        )

        if (!isHardwareWalletAccount(accountForSigning)) {
            throw new HardwareWalletError('signer_not_found')
        }

        const result = await strategy.sign(
            group,
            accountForSigning,
            input.callbacks,
        )
        results.push(result)
    }

    return results
})
