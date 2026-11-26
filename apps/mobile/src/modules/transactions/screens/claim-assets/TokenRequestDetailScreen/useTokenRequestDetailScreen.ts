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
import type { Decimal } from 'decimal.js'
import {
    addressOn,
    assetFromHoldingLiteRow,
    useAllAccounts,
    useTokenInboxQuery,
    type WalletAccount,
    settleInboxTokens,
} from '@perawallet/wallet-core-accounts'
import {
    PeraAssetVerificationTier,
    toWholeUnits,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { imitatedCurrencyOf } from '@perawallet/wallet-core-currencies'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { MessagesStackParamList } from '@modules/messages'

export type InboxTokenDetail = {
    asset: PeraAsset
    /** Display units. */
    amount: Decimal
    usdPrice: Nullable<Decimal>
}

export type UseTokenRequestDetailScreenResult = {
    /** Null once the token has left the inbox, or before it is read. */
    token: Nullable<InboxTokenDetail>
    scope: ChainScope
    account: Maybe<WalletAccount>
    isPending: boolean
    isSuspicious: boolean
    /** Code the token's unit name imitates (the chain's native ticker or a fiat code), or null. */
    imitatedCurrency: Nullable<string>
    handleAccept: () => void
    handleReject: () => void
}

export const useTokenRequestDetailScreen =
    (): UseTokenRequestDetailScreenResult => {
        const { t } = useLanguage()
        const { goBack } = useAppNavigation()
        const { showToast } = useToast()
        const { accountId, scope, assetId } =
            useRoute<RouteProp<MessagesStackParamList, 'TokenRequestDetail'>>()
                .params
        const account = useAllAccounts().find(each => each.id === accountId)
        const address = account ? addressOn(account, scope) : undefined
        const sources = useMemo(
            () => (address ? [{ address, scope }] : []),
            [address, scope],
        )
        const { holdings, isPending } = useTokenInboxQuery(sources)

        const token = useMemo((): Nullable<InboxTokenDetail> => {
            const holding = holdings.find(each => each.assetId === assetId)
            const asset = holding
                ? assetFromHoldingLiteRow(holding, scope.chainId)
                : null
            if (!holding || !asset) return null
            return {
                asset,
                amount: toWholeUnits(holding.amount, asset),
                usdPrice: holding.usdPrice,
            }
        }, [holdings, assetId, scope.chainId])

        const settle = useCallback(
            (isAccepted: boolean) => {
                if (!address || !token) return
                settleInboxTokens([{ address, scope, assetId }], isAccepted)
                showToast({
                    title: t(
                        isAccepted
                            ? 'asset_inbox.claim.token_accepted_toast'
                            : 'asset_inbox.claim.token_rejected_toast',
                        {
                            assetName:
                                token.asset.name ?? token.asset.unitName ?? '',
                        },
                    ),
                    body: '',
                    type: 'success',
                })
                goBack()
            },
            [address, token, scope, assetId, showToast, t, goBack],
        )

        return {
            token,
            scope,
            account,
            isPending,
            isSuspicious:
                token?.asset.peraMetadata?.verificationTier ===
                PeraAssetVerificationTier.suspicious,
            imitatedCurrency: token
                ? imitatedCurrencyOf(
                      { chainId: scope.chainId, assetId },
                      token.asset.unitName,
                  )
                : null,
            handleAccept: () => settle(true),
            handleReject: () => settle(false),
        }
    }
