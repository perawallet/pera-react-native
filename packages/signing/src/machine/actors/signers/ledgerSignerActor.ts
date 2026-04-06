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
import { isLedgerAccount } from '@perawallet/wallet-core-accounts'
import type { LedgerTransportProvider } from '@perawallet/wallet-core-ledger'
import type {
    AnalyzedSignableGroup,
    SigningResult,
} from '../../../pipeline/types'
import { HardwareWalletError } from '../../../pipeline/errors'
import { createHardwareStrategy } from '../../../pipeline/signing/createHardwareStrategy'
import type { EncodeTransactionFunction } from '../../../pipeline/signing/createHardwareStrategy'

export type LedgerSignerActorInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    transportProvider: LedgerTransportProvider
    encodeTransaction: EncodeTransactionFunction
}

/**
 * XState actor for Ledger hardware wallet signing.
 *
 * Signs one or more transaction groups using the hardware strategy,
 * connecting to the Ledger device and requesting user confirmation.
 */
export const ledgerSignerActor = fromPromise<
    SigningResult[],
    LedgerSignerActorInput
>(async ({ input }) => {
    const { groups, allAccounts, transportProvider, encodeTransaction } = input

    const strategy = createHardwareStrategy({
        transportProvider,
        encodeTransaction,
    })

    const results: SigningResult[] = []

    for (const group of groups) {
        const signerAccount = allAccounts.find(
            a => a.address === group.signerAddress,
        )

        if (!signerAccount || !isLedgerAccount(signerAccount)) {
            throw new HardwareWalletError(
                `Ledger signer account not found for address ${group.signerAddress}`,
            )
        }

        const result = await strategy.sign(group, signerAccount)
        results.push(result)
    }

    return results
})
