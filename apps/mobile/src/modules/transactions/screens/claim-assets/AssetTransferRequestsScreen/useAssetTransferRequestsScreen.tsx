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
import { useCallback, useMemo } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    assetFromHoldingLiteRow,
    receivesUnaskedAssets,
    useAccountHoldingSources,
    useAllAccounts,
    useRegisteredChainIds,
    useTokenInboxQuery,
    settleInboxTokens,
} from '@perawallet/wallet-core-accounts'
import { toWholeUnits } from '@perawallet/wallet-core-assets'
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    isIntegrityRequiredError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    useAssetInboxRequestsQuery,
    type AssetInboxResolution,
} from '@perawallet/wallet-core-transactions'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import type { MessagesStackParamList } from '@modules/messages'
import { useClaimAssets } from '@modules/transactions/hooks'
import type { InboxRequestRow, TokenRow } from './inboxRequestRow'
import { useInboxRowSelection } from './useInboxRowSelection'
import { useResolveSelectedRequests } from './useResolveSelectedRequests'

export type { InboxRequestRow } from './inboxRequestRow'

export type UseAssetTransferRequestsScreenResult = {
    rows: InboxRequestRow[]
    isPending: boolean
    isIntegrityBlocked: boolean
    /** Reject All acts on the tokens waiting on the device; each is accepted on its own screen. */
    canRejectAll: boolean
    /** Long-pressing a row starts selecting; null while not selecting. */
    selectedKeys: Nullable<ReadonlySet<string>>
    isAllSelected: boolean
    handleRowPress: (row: InboxRequestRow) => void
    handleRowLongPress: (row: InboxRequestRow) => void
    handleToggleSelectAll: () => void
    handleCancelSelection: () => void
    handleRejectAll: () => void
    handleResolveSelected: (mode: AssetInboxResolution) => void
}

export const useAssetTransferRequestsScreen =
    (): UseAssetTransferRequestsScreenResult => {
        const { t } = useLanguage()
        const { push } = useAppNavigation()
        const { showToast } = useToast()
        const { request: requestBottomSheet } = useBottomSheet()
        const { setAccountAddress, setAssetRequests } = useClaimAssets()
        const { accountId } =
            useRoute<
                RouteProp<MessagesStackParamList, 'AssetTransferRequests'>
            >().params
        const account = useAllAccounts().find(each => each.id === accountId)
        const sources = useAccountHoldingSources(account)

        // The inbox backend serves the account's address on a chain that
        // requires an opt-in; the query is off without one.
        const backendSource = sources.find(
            ({ scope }) => !receivesUnaskedAssets(scope.chainId),
        )
        const fallbackScope = useSelectedScope(useRegisteredChainIds()[0]!)
        const backendScope = backendSource?.scope ?? fallbackScope
        const backend = useAssetInboxRequestsQuery(
            backendScope,
            backendSource?.address ?? null,
        )
        const tokenInbox = useTokenInboxQuery(sources)

        const tokenRows = useMemo(
            () =>
                tokenInbox.holdings.flatMap((holding): TokenRow[] => {
                    const asset = assetFromHoldingLiteRow(
                        holding,
                        holding.scope.chainId,
                    )
                    if (!asset) return []
                    return [
                        {
                            kind: 'token',
                            key: `token|${toScopeKey(holding.scope)}|${holding.assetId}`,
                            scope: holding.scope,
                            address: holding.address,
                            asset,
                            amount: toWholeUnits(holding.amount, asset),
                            usdPrice: holding.usdPrice,
                        },
                    ]
                }),
            [tokenInbox.holdings],
        )

        const rows = useMemo<InboxRequestRow[]>(() => {
            const claimRows = backend.data.map(
                (request, index): InboxRequestRow => ({
                    kind: 'claim',
                    key: `claim|${request.asset.assetId}|${index}`,
                    scope: backendScope,
                    request,
                    index,
                }),
            )
            const sections: InboxRequestRow[][] = [
                claimRows,
                ...sources.map(({ scope }) =>
                    tokenRows.filter(
                        row => toScopeKey(row.scope) === toScopeKey(scope),
                    ),
                ),
            ]
            const scopeOf = (section: InboxRequestRow[]) =>
                (section[0] as Exclude<InboxRequestRow, { kind: 'header' }>)
                    .scope
            return sections
                .filter(section => section.length > 0)
                .flatMap(section => [
                    {
                        kind: 'header' as const,
                        key: `header|${toScopeKey(scopeOf(section))}`,
                        chainId: scopeOf(section).chainId,
                    },
                    ...section,
                ])
        }, [backend.data, backendScope, sources, tokenRows])

        const {
            selectedKeys,
            isAllSelected,
            toggleRow,
            startWith,
            toggleAll,
            clear,
        } = useInboxRowSelection(rows)
        const resolveSelected = useResolveSelectedRequests({
            rows,
            selectedKeys,
            backendRequests: backend.data,
            backendScope,
            backendAddress: backendSource?.address ?? null,
            onConfirm: clear,
        })

        const handleRowPress = useCallback(
            (row: InboxRequestRow) => {
                if (selectedKeys !== null) {
                    toggleRow(row)
                    return
                }
                if (row.kind === 'claim') {
                    setAccountAddress(backendSource?.address ?? null)
                    setAssetRequests(backend.data)
                    push('Messages', {
                        screen: 'AssetClaimDetail',
                        params: { assetIndex: row.index, scope: row.scope },
                    })
                } else if (row.kind === 'token') {
                    push('Messages', {
                        screen: 'TokenRequestDetail',
                        params: {
                            accountId,
                            scope: row.scope,
                            assetId: row.asset.assetId,
                        },
                    })
                }
            },
            [
                selectedKeys,
                toggleRow,
                accountId,
                backend.data,
                backendSource?.address,
                push,
                setAccountAddress,
                setAssetRequests,
            ],
        )

        const handleRejectAll = useCallback(async () => {
            const count = tokenRows.length
            const notes = [
                t('asset_inbox.requests.reject_all_body', { count }),
                ...(backend.data.length > 0
                    ? [t('asset_inbox.requests.reject_all_skips_claims')]
                    : []),
            ]
            const isConfirmed = await requestBottomSheet<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon='warning'
                        iconVariant='error'
                        title={t('asset_inbox.requests.reject_all_title')}
                        message={notes.join('\n\n')}
                        confirmLabel={t('asset_inbox.requests.reject_all')}
                        cancelLabel={t('common.cancel.label')}
                        buttonPaddingStyle='dense'
                        testID='asset_inbox_reject_all_sheet'
                        confirmTestID='asset_inbox_reject_all_confirm'
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!isConfirmed) return
            settleInboxTokens(
                tokenRows.map(row => ({
                    address: row.address,
                    scope: row.scope,
                    assetId: row.asset.assetId,
                })),
                false,
            )
            showToast({
                title: t('asset_inbox.requests.rejected_all_toast', { count }),
                body: '',
                type: 'success',
            })
        }, [tokenRows, backend.data.length, requestBottomSheet, showToast, t])

        return {
            rows,
            isPending: backend.isPending || tokenInbox.isPending,
            isIntegrityBlocked:
                backend.isError && isIntegrityRequiredError(backend.error),
            canRejectAll: tokenRows.length > 0 && selectedKeys === null,
            selectedKeys,
            isAllSelected,
            handleRowPress,
            handleRowLongPress: startWith,
            handleToggleSelectAll: toggleAll,
            handleCancelSelection: clear,
            handleRejectAll: () => void handleRejectAll(),
            handleResolveSelected: mode => void resolveSelected(mode),
        }
    }
