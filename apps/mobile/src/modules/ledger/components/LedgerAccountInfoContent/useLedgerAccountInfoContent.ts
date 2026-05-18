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

import { useMemo } from 'react'
import type { Decimal } from 'decimal.js'
import {
    useLedgerAccountPreview,
    type LedgerAccountPreviewAsset,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'

export type LedgerInfoListItem =
    | { kind: 'sectionHeader'; key: string; title: string }
    | {
          kind: 'account'
          key: string
          address: string
          algoBalance: Decimal
          fiatValue: Decimal
      }
    | { kind: 'asset'; key: string; asset: LedgerAccountPreviewAsset }
    | { kind: 'rekeyAddress'; key: string; address: string }

type UseLedgerAccountInfoContentResult = {
    title: string
    items: LedgerInfoListItem[]
    isLoading: boolean
    isError: boolean
    refetch: () => void
}

export const useLedgerAccountInfoContent = (
    address: string,
    accountIndex: number,
    titleOverride?: string,
): UseLedgerAccountInfoContentResult => {
    const { t } = useLanguage()
    const { preview, isLoading, isError, refetch } =
        useLedgerAccountPreview(address)

    const items = useMemo<LedgerInfoListItem[]>(() => {
        if (!preview) return []

        const list: LedgerInfoListItem[] = [
            {
                kind: 'sectionHeader',
                key: 'h-details',
                title: t('ledger.account_info.account_details'),
            },
            {
                kind: 'account',
                key: 'account',
                address: preview.address,
                algoBalance: preview.algoBalance,
                fiatValue: preview.totalFiatValue,
            },
            {
                kind: 'sectionHeader',
                key: 'h-assets',
                title: t('ledger.account_info.assets'),
            },
            ...preview.assets.map(
                (asset): LedgerInfoListItem => ({
                    kind: 'asset',
                    key: `asset-${asset.assetId}`,
                    asset,
                }),
            ),
        ]

        if (preview.rekey.kind === 'rekeyedTo') {
            list.push(
                {
                    kind: 'sectionHeader',
                    key: 'h-rekey',
                    title: t('ledger.account_info.can_be_signed_by'),
                },
                {
                    kind: 'rekeyAddress',
                    key: `rekey-${preview.rekey.authAddress}`,
                    address: preview.rekey.authAddress,
                },
            )
        } else if (preview.rekey.kind === 'canSignFor') {
            list.push({
                kind: 'sectionHeader',
                key: 'h-rekey',
                title: t('ledger.account_info.can_sign_for'),
            })
            preview.rekey.addresses.forEach(addr => {
                list.push({
                    kind: 'rekeyAddress',
                    key: `rekey-${addr}`,
                    address: addr,
                })
            })
        }

        return list
    }, [preview, t])

    return {
        title: titleOverride ?? `Ledger #${accountIndex}`,
        items,
        isLoading,
        isError,
        refetch,
    }
}
