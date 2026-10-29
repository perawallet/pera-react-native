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

import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
    chainAccountOf,
    useAccountAddedTokensQuery,
    useAddTokenMutation,
    useRemoveTokenMutation,
    type AccountHoldingSource,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isNativeAssetId,
    PeraAssetVerificationTier,
    type ScopedAssetSearchResult,
} from '@perawallet/wallet-core-assets'
import {
    chainDisplayNameOf,
    getChainDescriptor,
} from '@perawallet/wallet-core-chain-shared'
import {
    assetRefKey,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

type UseAddAssetTokenResult = {
    canAddToken: (result: ScopedAssetSearchResult) => boolean
    /** On for a token added here that holds nothing: its check offers Remove. */
    canRemoveToken: (result: ScopedAssetSearchResult) => boolean
    isTokenPending: (result: ScopedAssetSearchResult) => boolean
    /** Added in this sheet, before the holdings read catches up. */
    isTokenAdded: (result: ScopedAssetSearchResult) => boolean
    handleAddToken: (result: ScopedAssetSearchResult) => Promise<void>
    handleRemoveToken: (result: ScopedAssetSearchResult) => Promise<void>
}

/** A chain without opt-in adds a token as a local record: no transaction, no fee. */
export const addsWithoutOptIn = (chainId: ChainId): boolean =>
    !getChainDescriptor(chainId).protocol.requiresAssetOptIn

// Keyed by chain too, so an asset id added on one chain never reads as added
// on another. The list keys its rows by it as well.
export const resultKey = ({ scope, asset }: ScopedAssetSearchResult): string =>
    assetRefKey({ chainId: scope.chainId, assetId: asset.assetId })

const tierOf = ({ asset }: ScopedAssetSearchResult) =>
    asset.peraMetadata?.verificationTier ?? PeraAssetVerificationTier.unverified

const assetLabelOf = ({ asset }: ScopedAssetSearchResult): string =>
    asset.unitName ?? asset.name ?? asset.assetId

export const chainNameOf = (chainId: ChainId): string =>
    chainDisplayNameOf(chainId) ?? chainId

const withKey = (keys: ReadonlySet<string>, key: string): ReadonlySet<string> =>
    new Set(keys).add(key)

const withoutKey = (
    keys: ReadonlySet<string>,
    key: string,
): ReadonlySet<string> => {
    const next = new Set(keys)
    next.delete(key)
    return next
}

export const useAddAssetToken = (
    account: Maybe<WalletAccount>,
    holdingSources: readonly AccountHoldingSource[],
): UseAddAssetTokenResult => {
    const { t } = useLanguage()
    const { request } = useBottomSheet()
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const { addToken } = useAddTokenMutation()
    const { removeToken } = useRemoveTokenMutation()
    const { addedTokens } = useAccountAddedTokensQuery(holdingSources)
    // State only draws the spinner: it lands a render late, so a second tap
    // in the same frame would read it empty. The ref is the guard.
    const inFlightKeys = useRef(new Set<string>())
    const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(
        new Set(),
    )
    const [addedKeys, setAddedKeys] = useState<ReadonlySet<string>>(new Set())

    const addressOn = useCallback(
        (chainId: ChainId) =>
            account ? chainAccountOf(account, chainId)?.address : undefined,
        [account],
    )
    const canAddToken = useCallback(
        (result: ScopedAssetSearchResult) =>
            addsWithoutOptIn(result.scope.chainId) &&
            addressOn(result.scope.chainId) !== undefined &&
            !isNativeAssetId(result.scope.chainId, result.asset.assetId),
        [addressOn],
    )
    const removableKeys = useMemo(
        () =>
            new Set(
                addedTokens
                    .filter(({ hasBalance }) => !hasBalance)
                    .map(({ scope, assetId }) =>
                        assetRefKey({ chainId: scope.chainId, assetId }),
                    ),
            ),
        [addedTokens],
    )
    const canRemoveToken = useCallback(
        (result: ScopedAssetSearchResult) =>
            removableKeys.has(resultKey(result)),
        [removableKeys],
    )
    const isTokenPending = useCallback(
        (result: ScopedAssetSearchResult) => pendingKeys.has(resultKey(result)),
        [pendingKeys],
    )
    const isTokenAdded = useCallback(
        (result: ScopedAssetSearchResult) => addedKeys.has(resultKey(result)),
        [addedKeys],
    )

    // The sheets take display strings, not ids: an unverified token has no
    // stored record yet to read its name back from.
    // Pera flagged a suspicious token, so it gets its own, harder warning.
    const confirmUnverified = useCallback(
        (assetName: string, isSuspicious: boolean) =>
            request<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon='warning'
                        iconVariant='error'
                        title={t(
                            isSuspicious
                                ? 'add_asset.token.suspicious_title'
                                : 'add_asset.token.unverified_title',
                        )}
                        message={t(
                            isSuspicious
                                ? 'add_asset.token.suspicious_body'
                                : 'add_asset.token.unverified_body',
                            { assetName },
                        )}
                        confirmLabel={t('add_asset.token.unverified_confirm')}
                        cancelLabel={t('common.cancel.label')}
                        confirmVariant={
                            isSuspicious ? 'destructive' : 'primary'
                        }
                        testID={
                            isSuspicious
                                ? 'add_asset_suspicious_token_sheet'
                                : 'add_asset_unverified_token_sheet'
                        }
                        confirmTestID='add_asset_unverified_token_confirm'
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            }),
        [request, t],
    )
    const confirmRemove = useCallback(
        (assetName: string, chain: string) =>
            request<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon='trash'
                        iconVariant='error'
                        title={t('add_asset.token.remove_title', { assetName })}
                        message={t('add_asset.token.remove_body', { chain })}
                        confirmLabel={t('add_asset.token.remove_confirm')}
                        cancelLabel={t('common.cancel.label')}
                        confirmVariant='destructive'
                        testID='add_asset_remove_token_sheet'
                        confirmTestID='add_asset_remove_token_confirm'
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            }),
        [request, t],
    )

    const handleAddToken = useCallback(
        async (result: ScopedAssetSearchResult) => {
            const key = resultKey(result)
            const accountAddress = addressOn(result.scope.chainId)
            if (
                !accountAddress ||
                !canAddToken(result) ||
                inFlightKeys.current.has(key)
            ) {
                return
            }
            // Claimed before the sheet, so a tap while it's open adds nothing.
            inFlightKeys.current.add(key)
            const assetName = assetLabelOf(result)
            const tier = tierOf(result)
            try {
                if (
                    tier !== PeraAssetVerificationTier.verified &&
                    (await confirmUnverified(
                        assetName,
                        tier === PeraAssetVerificationTier.suspicious,
                    )) !== true
                ) {
                    return
                }
                setPendingKeys(prev => withKey(prev, key))
                await addToken({
                    accountAddress,
                    scope: result.scope,
                    assetId: result.asset.assetId,
                })
                setAddedKeys(prev => withKey(prev, key))
                showToast({
                    title: t('add_asset.token.added_title'),
                    body: t('add_asset.token.added_body', {
                        assetName,
                        chain: chainNameOf(result.scope.chainId),
                    }),
                    type: 'success',
                })
            } catch (err) {
                showError(err, t('add_asset.token.add_failed_title'))
            } finally {
                inFlightKeys.current.delete(key)
                setPendingKeys(prev => withoutKey(prev, key))
            }
        },
        [
            addressOn,
            canAddToken,
            confirmUnverified,
            addToken,
            showToast,
            showError,
            t,
        ],
    )

    const handleRemoveToken = useCallback(
        async (result: ScopedAssetSearchResult) => {
            const key = resultKey(result)
            const accountAddress = addressOn(result.scope.chainId)
            if (
                !accountAddress ||
                !canRemoveToken(result) ||
                inFlightKeys.current.has(key)
            ) {
                return
            }
            inFlightKeys.current.add(key)
            const assetName = assetLabelOf(result)
            const chain = chainNameOf(result.scope.chainId)
            try {
                if ((await confirmRemove(assetName, chain)) !== true) return
                setPendingKeys(prev => withKey(prev, key))
                await removeToken({
                    accountAddress,
                    scope: result.scope,
                    assetId: result.asset.assetId,
                })
                setAddedKeys(prev => withoutKey(prev, key))
                showToast({
                    title: t('add_asset.token.removed_title'),
                    body: t('add_asset.token.removed_body', {
                        assetName,
                        chain,
                    }),
                    type: 'success',
                })
            } catch (err) {
                showError(err, t('add_asset.token.remove_failed_title'))
            } finally {
                inFlightKeys.current.delete(key)
                setPendingKeys(prev => withoutKey(prev, key))
            }
        },
        [
            addressOn,
            canRemoveToken,
            confirmRemove,
            removeToken,
            showToast,
            showError,
            t,
        ],
    )

    return {
        canAddToken,
        canRemoveToken,
        isTokenPending,
        isTokenAdded,
        handleAddToken,
        handleRemoveToken,
    }
}
