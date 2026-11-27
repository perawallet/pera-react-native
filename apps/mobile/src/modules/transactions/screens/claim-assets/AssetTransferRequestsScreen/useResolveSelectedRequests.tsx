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

import { useCallback } from 'react'
import { settleInboxTokens } from '@perawallet/wallet-core-accounts'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    isAssetInboxResolutionBlocked,
    type AssetInboxRequest,
    type AssetInboxResolution,
} from '@perawallet/wallet-core-transactions'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useClaimAssets } from '@modules/transactions/hooks'
import {
    isSelectable,
    type ClaimRow,
    type InboxRequestRow,
    type TokenRow,
} from './inboxRequestRow'

export type UseResolveSelectedRequestsParams = {
    rows: readonly InboxRequestRow[]
    selectedKeys: Nullable<ReadonlySet<string>>
    backendRequests: AssetInboxRequest[]
    backendScope: ChainScope
    backendAddress: Nullable<string>
    /** Called once the user confirms, before anything is sent. */
    onConfirm: () => void
}

export type UseResolveSelectedRequestsResult = (
    mode: AssetInboxResolution,
) => Promise<void>

/**
 * Tokens waiting on the device settle at once; backend requests go to the
 * bulk processing screen, minus any the account can't afford.
 */
export const useResolveSelectedRequests = ({
    rows,
    selectedKeys,
    backendRequests,
    backendScope,
    backendAddress,
    onConfirm,
}: UseResolveSelectedRequestsParams): UseResolveSelectedRequestsResult => {
    const { t } = useLanguage()
    const { push } = useAppNavigation()
    const { showToast, errorToast } = useToast()
    const { request: requestBottomSheet } = useBottomSheet()
    const { setAccountAddress, setAssetRequests } = useClaimAssets()
    const symbol = useNativeAsset(backendScope).unitName ?? ''

    return useCallback(
        async (mode: AssetInboxResolution) => {
            if (!selectedKeys || selectedKeys.size === 0) return
            const isClaim = mode === 'claim'
            const picked = rows.filter(
                row => isSelectable(row) && selectedKeys.has(row.key),
            )
            const claims = picked.filter(
                (row): row is ClaimRow => row.kind === 'claim',
            )
            const tokens = picked.filter(
                (row): row is TokenRow => row.kind === 'token',
            )
            const resolvable = claims.filter(
                row => !isAssetInboxResolutionBlocked(row.request, mode),
            )
            const skippedCount = claims.length - resolvable.length
            const count = resolvable.length + tokens.length

            if (count === 0) {
                errorToast(
                    t('messages.claim.insufficient_native_title', { symbol }),
                    isClaim
                        ? t('messages.claim.insufficient_native_claim', {
                              symbol,
                          })
                        : t('messages.claim.insufficient_native_reject', {
                              symbol,
                          }),
                )
                return
            }

            const notes: string[] = []
            if (resolvable.length > 0) {
                notes.push(
                    t('asset_inbox.requests.bulk_transactions_note', {
                        count: resolvable.length,
                    }),
                )
                if (!isClaim) {
                    notes.push(
                        t('asset_inbox.requests.bulk_reject_irreversible'),
                    )
                } else if (resolvable.length > 1) {
                    // The backend judges each request's affordability alone.
                    notes.push(
                        t('asset_inbox.requests.bulk_min_balance_note', {
                            symbol,
                        }),
                    )
                }
            }
            if (tokens.length > 0) {
                notes.push(
                    isClaim
                        ? t('asset_inbox.requests.bulk_tokens_note', {
                              count: tokens.length,
                          })
                        : t('asset_inbox.requests.reject_all_body', {
                              count: tokens.length,
                          }),
                )
            }
            if (skippedCount > 0) {
                notes.push(
                    t('asset_inbox.requests.bulk_skipped_note', {
                        count: skippedCount,
                        symbol,
                    }),
                )
            }

            const isConfirmed = await requestBottomSheet<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon={isClaim ? 'info' : 'warning'}
                        iconVariant={isClaim ? 'primary' : 'error'}
                        title={
                            isClaim
                                ? t('asset_inbox.requests.bulk_claim_title', {
                                      count,
                                  })
                                : t('asset_inbox.requests.bulk_reject_title', {
                                      count,
                                  })
                        }
                        message={notes.join('\n\n')}
                        confirmLabel={
                            isClaim
                                ? t('asset_inbox.requests.claim_selected', {
                                      count,
                                  })
                                : t('asset_inbox.requests.reject_selected', {
                                      count,
                                  })
                        }
                        cancelLabel={t('common.cancel.label')}
                        buttonPaddingStyle='dense'
                        testID='asset_inbox_bulk_sheet'
                        confirmTestID='asset_inbox_bulk_confirm'
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!isConfirmed) return

            onConfirm()
            if (tokens.length > 0) {
                settleInboxTokens(
                    tokens.map(row => ({
                        address: row.address,
                        scope: row.scope,
                        assetId: row.asset.assetId,
                    })),
                    isClaim,
                )
            }
            if (resolvable.length === 0) {
                showToast({
                    title: isClaim
                        ? t('asset_inbox.requests.accepted_tokens_toast', {
                              count: tokens.length,
                          })
                        : t('asset_inbox.requests.rejected_all_toast', {
                              count: tokens.length,
                          }),
                    body: '',
                    type: 'success',
                })
                return
            }
            setAccountAddress(backendAddress)
            setAssetRequests(backendRequests)
            push('Messages', {
                screen: 'BulkClaimProcessing',
                params: {
                    mode,
                    assetIndexes: resolvable.map(row => row.index),
                    scope: backendScope,
                },
            })
        },
        [
            selectedKeys,
            rows,
            symbol,
            showToast,
            errorToast,
            t,
            requestBottomSheet,
            onConfirm,
            setAccountAddress,
            setAssetRequests,
            backendAddress,
            backendRequests,
            push,
            backendScope,
        ],
    )
}
