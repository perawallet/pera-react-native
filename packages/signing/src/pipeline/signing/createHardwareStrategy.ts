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
    chainAccountOf,
    hasCustody,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    SigningResult,
} from '../types'
import { CannotSignError, HardwareWalletError, SigningError } from '../errors'

export type HardwareStrategyOptions = {
    /** The chain the device signs for; the account's address there is the one verified. */
    chainId: ChainId
}

const assertHardwareSigner = (account: WalletAccount, chainId: ChainId) => {
    const address = chainAccountOf(account, chainId)?.address
    if (!hasCustody(account, 'hardware')) {
        throw new CannotSignError(
            address ?? '',
            'Account is not a hardware wallet',
        )
    }
    if (!address) {
        throw new CannotSignError('', `Account has no address on ${chainId}`)
    }
}

/**
 * Refuses every group: the hardware child signs transactions through their
 * chain's planner and messages through their chain's message signer, so a
 * group reaching here is one no device can sign.
 */
export const createHardwareStrategy = ({
    chainId,
}: HardwareStrategyOptions): SigningStrategy => ({
    canSign: (account: WalletAccount): boolean =>
        hasCustody(account, 'hardware'),

    sign: async (
        group: AnalyzedSignableGroup,
        account: WalletAccount,
    ): Promise<SigningResult> => {
        assertHardwareSigner(account, chainId)

        if (group.data.type === 'arbitrary-data') {
            throw new SigningError(
                'Hardware wallet signing of arbitrary data is not supported',
                undefined,
                // Retrying can never succeed — suppress the Retry affordance.
                { retryable: false },
            )
        }
        if (group.data.type === 'transactions') {
            throw new SigningError(
                'Hardware wallets sign transactions through their planner',
                undefined,
                { retryable: false },
            )
        }
        if (group.data.type === 'auth-data' || group.data.type === 'message') {
            throw new SigningError(
                "Hardware wallets sign messages through their chain's message signer",
                undefined,
                { retryable: false },
            )
        }
        throw new HardwareWalletError('unsupported_data_type')
    },
})
