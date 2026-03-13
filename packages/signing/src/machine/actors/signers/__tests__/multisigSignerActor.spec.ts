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

import { describe, it, expect } from 'vitest'
import { createActor, toPromise } from 'xstate'
import { multisigSignerActor } from '../multisigSignerActor'
import type { MultisigSignerActorInput } from '../multisigSignerActor'
import type { AnalyzedSignableGroup } from '../../../../pipeline/types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { CannotSignError } from '../../../../pipeline/errors'

const MULTISIG_ADDRESS =
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM'

const mockMultisigAccount: WalletAccount = {
    type: 'multisig',
    address: MULTISIG_ADDRESS,
} as unknown as WalletAccount

const mockGroup: AnalyzedSignableGroup = {
    data: {
        type: 'transactions',
        transactions: [],
        indicesToSign: [],
    },
    source: { type: 'local' },
    signerAddress: MULTISIG_ADDRESS,
    analysis: {
        totalFees: 0n,
        transactionSummaries: [],
        warnings: [],
        signableAddresses: [],
        riskLevel: 'low',
    },
}

describe('multisigSignerActor', () => {
    it('throws CannotSignError (stub — not yet implemented)', async () => {
        const input: MultisigSignerActorInput = {
            groups: [mockGroup],
            allAccounts: [mockMultisigAccount],
        }

        const actor = createActor(multisigSignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toBeInstanceOf(CannotSignError)
    })

    it('error message includes the group signer address', async () => {
        const input: MultisigSignerActorInput = {
            groups: [mockGroup],
            allAccounts: [mockMultisigAccount],
        }

        const actor = createActor(multisigSignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow(MULTISIG_ADDRESS)
    })
})
