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
import type { HardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    AnalyzedSignableGroup,
    SigningResult,
} from '../../../pipeline/types'
import { HardwareWalletError } from '../../../pipeline/errors'
import { createHardwareStrategy } from '../../../pipeline/signing/createHardwareStrategy'
import type { EncodeTransactionFunction } from '../../../pipeline/signing/createHardwareStrategy'

export type HardwareSignerActorInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    hardwareWalletRegistry: HardwareWalletRegistry
    encodeTransaction: EncodeTransactionFunction
}

/**
 * XState actor for hardware wallet signing.
 *
 * Signs one or more transaction groups using the hardware strategy,
 * resolving the correct transport provider from the registry based on
 * each account's manufacturer.
 */
export const hardwareSignerActor = fromPromise<
    SigningResult[],
    HardwareSignerActorInput
>(async ({ input }) => {
    const { groups, allAccounts, hardwareWalletRegistry, encodeTransaction } =
        input

    const results: SigningResult[] = []

    for (const group of groups) {
        const signerAccount = allAccounts.find(
            a => a.address === group.signerAddress,
        )

        if (!signerAccount || !isHardwareWalletAccount(signerAccount)) {
            throw new HardwareWalletError(
                `Hardware wallet signer account not found for address ${group.signerAddress}`,
            )
        }

        const { manufacturer } = (signerAccount as HardwareWalletAccount)
            .hardwareDetails
        const transportProvider =
            hardwareWalletRegistry.getProvider(manufacturer)

        if (!transportProvider) {
            throw new HardwareWalletError(
                `No hardware wallet provider registered for manufacturer: ${manufacturer}`,
            )
        }

        const strategy = createHardwareStrategy({
            transportProvider,
            encodeTransaction,
        })

        const result = await strategy.sign(group, signerAccount)
        results.push(result)
    }

    return results
})
