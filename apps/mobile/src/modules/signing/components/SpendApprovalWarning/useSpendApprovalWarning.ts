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
    type I18nKey,
    type SpendApproval,
} from '@perawallet/wallet-core-chain-contract'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'

export type SpendApprovalWarningRow = {
    type: 'spend' | 'unlimited' | 'no-expiry' | 'long-lived' | 'collection'
    icon: IconName
    message: string
    emphasis?: string
    caption?: string
}

export type UseSpendApprovalWarningResult = {
    rows: SpendApprovalWarningRow[]
    deadlineText: string
    /** Set when the spender is a well-known contract: the panel reads as information, not danger. */
    knownSpenderName?: string
    isUnlimited: boolean
}

type RowCopy = {
    icon: IconName
    message: I18nKey
    emphasis?: I18nKey
}

// A collection approval has no allowance; its own hook builds that row.
type SpendRowType = Exclude<SpendApprovalWarningRow['type'], 'collection'>

const ROW_COPY: Record<SpendRowType, RowCopy> = {
    spend: {
        icon: 'outflow',
        message: i18nKey('signing.spend_approval.spend_warning'),
        emphasis: i18nKey('signing.spend_approval.spend_warning_bold'),
    },
    unlimited: {
        icon: 'warning',
        message: i18nKey('signing.spend_approval.unlimited_warning'),
    },
    'no-expiry': {
        icon: 'pending',
        message: i18nKey('signing.spend_approval.no_deadline_warning'),
    },
    'long-lived': {
        icon: 'pending',
        message: i18nKey('signing.spend_approval.long_deadline_warning'),
    },
}

const NFT_SPEND_MESSAGE = i18nKey('signing.spend_approval.nft_spend_warning')

// A registry contract moves tokens only inside a call or signature the signer
// approves, so the "anyone can drain you" copy would overstate the risk.
const KNOWN_SPENDER_COPY: Partial<Record<SpendRowType, RowCopy>> = {
    spend: {
        icon: 'outflow',
        message: i18nKey('signing.spend_approval.known_spend_note'),
    },
    unlimited: {
        icon: 'info',
        message: i18nKey('signing.spend_approval.known_unlimited_note'),
    },
}

export const useSpendApprovalWarning = (
    approval: SpendApproval,
): UseSpendApprovalWarningResult => {
    const { t } = useLanguage()

    return useMemo(() => {
        const { spender, knownSpender, allowances, deadline, isLongLived } =
            approval
        const isNftOnly = allowances.every(allowance => !!allowance.nft)
        const types: SpendRowType[] = ['spend']
        const isUnlimited = allowances.some(
            allowance => allowance.amount === undefined,
        )
        if (isUnlimited) {
            types.push('unlimited')
        }
        if (deadline === undefined) {
            types.push('no-expiry')
        } else if (isLongLived) {
            types.push('long-lived')
        }

        const rows = types.map((type): SpendApprovalWarningRow => {
            const known = knownSpender && KNOWN_SPENDER_COPY[type]
            if (known) {
                return {
                    type,
                    icon: known.icon,
                    message: t(known.message, { name: knownSpender.name }),
                    caption:
                        type === 'spend'
                            ? t('signing.spend_approval.spender_caption', {
                                  address: spender,
                              })
                            : undefined,
                }
            }
            const { icon, message, emphasis } = ROW_COPY[type]
            return {
                type,
                icon,
                message: t(
                    type === 'spend' && isNftOnly ? NFT_SPEND_MESSAGE : message,
                ),
                emphasis: emphasis ? t(emphasis) : undefined,
                caption:
                    type === 'spend'
                        ? t('signing.spend_approval.spender_caption', {
                              address: spender,
                          })
                        : undefined,
            }
        })

        return {
            rows,
            deadlineText:
                deadline === undefined
                    ? t('signing.spend_approval.never')
                    : formatDatetime(new Date(deadline)),
            isUnlimited,
            ...(knownSpender && { knownSpenderName: knownSpender.name }),
        }
    }, [approval, t])
}
