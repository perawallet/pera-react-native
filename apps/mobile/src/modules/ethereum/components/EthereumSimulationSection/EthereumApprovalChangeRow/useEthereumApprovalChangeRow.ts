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

import { useMemo } from 'react'
import {
    i18nKey,
    type ChainScope,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { spendApprovalTitleOf } from '@modules/signing'
import { useEthereumContractLabel } from '@modules/ethereum/hooks/useEthereumContractLabel'
import type { EthereumApprovalChangePresentation } from '../useEthereumSimulationSection'

export type EthereumApprovalChangeNotice = {
    titleKey: I18nKey
    params?: { name: string }
    /** A warning for a grant that exposes the whole balance; information for a registry spender, as the decoded review reads it. */
    isWarning: boolean
}

export type UseEthereumApprovalChangeRowResult = {
    title: string
    notice: Optional<EthereumApprovalChangeNotice>
    /** As the transaction's own approval names it: Pera's curated label, else the bundled registry's. */
    spenderName: Optional<string>
}

const UNLIMITED_WARNING = i18nKey('signing.spend_approval.unlimited_warning')
const KNOWN_UNLIMITED_NOTE = i18nKey(
    'signing.spend_approval.known_unlimited_note',
)
const COLLECTION_WARNING = i18nKey('signing.collection_approval.warning')

const noticeOf = (
    { grant, isCollectionWide }: EthereumApprovalChangePresentation,
    spenderName: Optional<string>,
): Optional<EthereumApprovalChangeNotice> => {
    if (grant.kind !== 'unlimited') return undefined
    if (isCollectionWide) {
        return { titleKey: COLLECTION_WARNING, isWarning: true }
    }
    return spenderName
        ? {
              titleKey: KNOWN_UNLIMITED_NOTE,
              params: { name: spenderName },
              isWarning: false,
          }
        : { titleKey: UNLIMITED_WARNING, isWarning: true }
}

/** Titles the grant as the spend-approval review does, from the token record the section already read. */
export const useEthereumApprovalChangeRow = (
    change: EthereumApprovalChangePresentation,
    scope: ChainScope,
): UseEthereumApprovalChangeRowResult => {
    const { t } = useLanguage()
    const unitName = change.asset?.unitName
    const bundled = useMemo(
        () => (change.spenderName ? { name: change.spenderName } : undefined),
        [change.spenderName],
    )
    const spenderName = useEthereumContractLabel(
        scope,
        change.spender,
        bundled,
    )?.name

    if (change.grant.kind === 'revoke') {
        return {
            title: unitName
                ? t('ethereum.simulation.revoke_title', { asset: unitName })
                : t('ethereum.simulation.revoke_title_assets'),
            notice: undefined,
            spenderName,
        }
    }
    return {
        title: spendApprovalTitleOf(t, { spenderName, unitName }),
        notice: noticeOf(change, spenderName),
        spenderName,
    }
}
