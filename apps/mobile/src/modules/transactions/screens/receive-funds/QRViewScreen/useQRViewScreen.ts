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

import { useCallback, useEffect, useMemo } from 'react'

import {
    unreachableChainsNoteOf,
    useAccountCapabilityScope,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    trackScreen,
    AnalyticsScreenName,
    AnalyticsMetadataKey,
} from '@analytics'
import { shareText } from '@utils/shareText'
import { receiveTargetOf, type ReceiveTarget } from '@utils/receiveTarget'
import { useErrorToast } from '@hooks/useErrorToast'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { bottomSheetNotifier } from '@components/core'
import { useReceiveFunds } from '@modules/transactions/hooks'

type UseQRViewScreenResult = {
    account: Optional<WalletAccount>
    /** The account's display name on its receive chain; '' when it has none. */
    accountName: string
    /** The receive address in its chain's canonical form; '' when the account can't receive. */
    address: string
    /** What the QR encodes: the chain codec's payment URI for `address`; '' when the account can't receive. */
    paymentUri: string
    /** False when there is no account, its chain has `receive` off, or no codec is registered for it. */
    canReceive: boolean
    /** True when a picker (account or chain) led here, so back returns to it; false when back ends the flow. */
    canGoBack: boolean
    /** The copy shown in place of the QR when the account can't receive. */
    emptyTitle: string
    emptyBody: string
    handleBack: () => void
    handleCopyAddress: () => void
    handleShareAddress: () => Promise<void>
}

const NO_RECEIVE_TARGET: ReceiveTarget = {
    accountName: '',
    address: '',
    paymentUri: '',
}

export const useQRViewScreen = (): UseQRViewScreenResult => {
    const { selectedAccount, chainId, onFinished } = useReceiveFunds()
    const navigation = useAppNavigation()
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const { copyToClipboard } = useClipboard()
    const scope = useAccountCapabilityScope(
        selectedAccount ?? null,
        'receive',
        chainId,
    )

    const { accountName, address, paymentUri } = useMemo(
        (): ReceiveTarget =>
            (selectedAccount && receiveTargetOf(selectedAccount, scope)) ??
            NO_RECEIVE_TARGET,
        [selectedAccount, scope],
    )
    const canReceive = paymentUri !== ''

    const { emptyTitle, emptyBody } = useMemo(() => {
        const note =
            selectedAccount && chainId
                ? unreachableChainsNoteOf(selectedAccount, [chainId])
                : null
        if (note && chainId) {
            return {
                emptyTitle: t('receive_funds.qrview.chain_unavailable_title', {
                    chain: chainDisplayNameOf(chainId) ?? chainId,
                }),
                emptyBody: t(note),
            }
        }
        return {
            emptyTitle: t('receive_funds.qrview.error_title'),
            emptyBody: t('receive_funds.qrview.error_body'),
        }
    }, [selectedAccount, chainId, t])

    // Tracked here, not when the receive sheet opens: the sheet starts on
    // Choose Network, and only this view knows the chain the QR is for.
    const shownChainId = scope?.chainId
    useEffect(() => {
        if (shownChainId === undefined) return
        trackScreen(AnalyticsScreenName.ShowQr, {
            [AnalyticsMetadataKey.ChainId]: shownChainId,
        })
    }, [shownChainId])

    const handleCopyAddress = useCallback(() => {
        if (!canReceive) {
            return
        }
        void copyToClipboard(address)
    }, [canReceive, copyToClipboard, address])

    const handleShareAddress = useCallback(async () => {
        try {
            if (!canReceive) {
                return
            }
            await shareText({ title: accountName, message: address })
        } catch (error) {
            showError(error, t('errors.general.title'), {
                notifier: bottomSheetNotifier.current ?? undefined,
            })
        }
    }, [canReceive, accountName, address, showError, t])

    // Back returns to whichever picker led here; with none, it ends the flow.
    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack()
        } else {
            onFinished?.()
        }
    }, [navigation, onFinished])

    return {
        account: selectedAccount,
        accountName,
        address,
        paymentUri,
        canReceive,
        canGoBack: navigation.canGoBack(),
        emptyTitle,
        emptyBody,
        handleBack,
        handleCopyAddress,
        handleShareAddress,
    }
}
