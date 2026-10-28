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
    addressCodecs,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { assessRecipient } from './assess-recipient'
import type {
    DetectSuspectedPoisoningInput,
    FindImitatedAddressInput,
    KnownAddress,
    SuspectableEntry,
    SuspectedPoisoning,
} from './models'
import { isTrustedTransfer } from './trusted-counterparties'
import { valueTransfers } from './transfer-valuation'

const SUSPECTABLE_KINDS: ReadonlySet<TransactionSummary['kind']> = new Set([
    'transfer',
    'token-transfer',
    'nft-transfer',
])

type Candidate = { entry: SuspectableEntry; imitates: KnownAddress }

// A token contract can emit a transfer "from" the account to a look-alike that
// the account never signed, so an outgoing entry someone else signed counts too.
export const findImitatedAddress = ({
    entry,
    accountAddress,
    chainId,
    knownAddresses,
}: FindImitatedAddressInput): Optional<KnownAddress> => {
    const { summary, initiator } = entry
    if (!SUSPECTABLE_KINDS.has(summary.kind) || !summary.counterparty) {
        return undefined
    }
    const codec = addressCodecs.get(chainId)
    const isSpoofedSend =
        summary.direction === 'out' &&
        initiator !== undefined &&
        !codec.areEqual(initiator, accountAddress)
    if (summary.direction !== 'in' && !isSpoofedSend) return undefined

    const assessment = assessRecipient({
        recipient: summary.counterparty,
        chainId,
        knownAddresses,
    })
    return assessment.kind === 'look-alike'
        ? assessment.knownAddress
        : undefined
}

const hasValue = (summary: TransactionSummary): boolean =>
    !!summary.amount && summary.amount.value.gt(0)

// Worthless is exactly what fails the trust rule, so a suspected counterparty
// can never become a trusted one and sending to it keeps its warning.
export const detectSuspectedPoisoning = async ({
    entries,
    accountAddress,
    scope,
    knownAddresses,
}: DetectSuspectedPoisoningInput): Promise<SuspectedPoisoning[]> => {
    const candidates = entries.flatMap((entry): Candidate[] => {
        const imitates = findImitatedAddress({
            entry,
            accountAddress,
            chainId: scope.chainId,
            knownAddresses,
        })
        return imitates ? [{ entry, imitates }] : []
    })

    const valued = candidates.filter(({ entry }) => hasValue(entry.summary))
    const valuations =
        valued.length > 0
            ? await valueTransfers(
                  valued.map(({ entry }) => {
                      const amount = entry.summary.amount!
                      return {
                          assetRef: amount.assetRef,
                          value: amount.value,
                          decimalsHint: amount.display?.decimals,
                          isSignedByAccount: false,
                      }
                  }),
                  scope,
              )
            : []
    const valuable = new Set(
        valued.flatMap(({ entry }, index) => {
            const valuation = valuations[index]
            return valuation && isTrustedTransfer(valuation) ? [entry.id] : []
        }),
    )

    return candidates.flatMap(({ entry, imitates }) =>
        valuable.has(entry.id)
            ? []
            : [
                  {
                      transactionId: entry.id,
                      counterparty: entry.summary.counterparty!,
                      imitates,
                  },
              ],
    )
}
