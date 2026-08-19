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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    AnalyzedSignableGroup,
    SigningResult,
} from '../../../pipeline/types'
import { CannotSignError } from '../../../pipeline/errors'

/**
 * Shared scaffold for the per-signer actors (local-key, multisig):
 * signs every group in parallel, resolving each group's signer account by
 * address first and throwing {@link CannotSignError} when it's absent. The
 * per-strategy signing logic is supplied by `signGroup`. Centralizing the
 * lookup + not-found invariant keeps it identical across every actor.
 */
export const signGroupsBySignerAccount = (
    groups: AnalyzedSignableGroup[],
    allAccounts: WalletAccount[],
    signGroup: (
        group: AnalyzedSignableGroup,
        signerAccount: WalletAccount,
    ) => SigningResult | Promise<SigningResult>,
): Promise<SigningResult[]> =>
    Promise.all(
        groups.map(group => {
            const signerAccount = allAccounts.find(
                a => a.address === group.signerAddress,
            )
            if (!signerAccount) {
                throw new CannotSignError(
                    group.signerAddress,
                    'Account not found in allAccounts',
                )
            }
            return signGroup(group, signerAccount)
        }),
    )
