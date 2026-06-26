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

import { useCallback, useState } from 'react'
import { Platform } from 'react-native'
import {
    CardStatus,
    useCardDetailsMutation,
    useCardStatusQuery,
    useCardStore,
    useIsCardUnfreezing,
    useSetCardPinMutation,
    useUnfreezeCardMutation,
} from '@perawallet/wallet-core-card'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import { useCardComingSoonToast, useCardErrorToast } from '../../hooks'
import { CardAccountDetailsSheet } from '../CardAccountDetailsSheet'
import { FreezeCardConfirmationSheet } from '../FreezeCardConfirmationSheet'
import {
    WalletInstructionsSheet,
    type WalletPlatform,
} from '../WalletInstructionsSheet'

const PAN_MASK = '••••'

type UsePeraCardDetailsResult = {
    /** Masked PAN for the card visual, e.g. "•••• 2234". */
    maskedPan: string
    /** Secure-view image URL when revealed; `null` while masked. */
    secureImageUrl: string | null
    isRevealing: boolean
    onToggleReveal: () => void
    /** Recover if the single-use secure image fails to load: hide it + toast. */
    onSecureImageError: () => void
    /** Connected funding-source address, or `null` if none is stored. */
    fundingAddress: string | null
    onChangeFunding: () => void
    isFrozen: boolean
    freezeLabel: string
    /** True while an unfreeze request is in flight (freezing's pending state
     * lives on the confirmation sheet's button). */
    isFreezing: boolean
    /** False when the card is BLOCKED — the freeze toggle is then hidden. */
    canToggleFreeze: boolean
    onToggleFreeze: () => void
    onSetPin: () => void
    /** True while the set-PIN token request is in flight. */
    isSettingPin: boolean
    onAccountsDetails: () => void
    /** Which wallet-provisioning row to show: Apple Wallet on iOS, Google Pay on Android. */
    walletPlatform: WalletPlatform
    onAddToWallet: () => void
    onReportLostStolen: () => void
    onReportSuspicious: () => void
    onCancelCard: () => void
}

export const usePeraCardDetails = (): UsePeraCardDetailsResult => {
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const { pushWebView } = useWebView()
    const { request } = useBottomSheet()

    const panLast4 = useCardStore(state => state.lastKnownPanLast4)
    const fundingAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )

    const { data: card } = useCardStatusQuery()
    const isFrozen = card?.status === CardStatus.Frozen
    // Freeze/unfreeze only applies to a live card; a BLOCKED card can't toggle.
    const canToggleFreeze = card?.status !== CardStatus.Blocked

    // iOS provisions to Apple Wallet, Android to Google Pay — show one row.
    const walletPlatform = Platform.OS === 'ios' ? 'apple' : 'google'

    const cardDetails = useCardDetailsMutation()
    const unfreeze = useUnfreezeCardMutation()
    // Shared with the Card Frozen banner so the two unfreeze entry points
    // can't fire concurrently.
    const isUnfreezing = useIsCardUnfreezing()
    const setPin = useSetCardPinMutation()

    // The single-use secure image is held only in memory and discarded when the
    // user hides it again — never persisted.
    const [secureImageUrl, setSecureImageUrl] = useState<string | null>(null)

    const showError = useCardErrorToast()

    const showComingSoon = useCardComingSoonToast()

    // Async impls are wrapped in sync `void` handlers below so the exposed
    // callbacks are `() => void` (the codebase convention for onPress props).
    const toggleReveal = useCallback(async () => {
        if (secureImageUrl != null) {
            setSecureImageUrl(null)
            return
        }
        try {
            const view = await cardDetails.mutateAsync()
            setSecureImageUrl(view.imageUrl)
        } catch (error) {
            await showError(error)
        }
    }, [secureImageUrl, cardDetails, showError])
    const onToggleReveal = useCallback(() => {
        void toggleReveal()
    }, [toggleReveal])

    // The secure-view image is the only way details are shown; if it fails to
    // load (expired single-use URL, network), fall back to masked + notify.
    const onSecureImageError = useCallback(() => {
        setSecureImageUrl(null)
        errorToast(
            t('peraCard.account.error_title'),
            t('peraCard.account.error_body'),
        )
    }, [errorToast, t])

    const toggleFreeze = useCallback(async () => {
        if (!isFrozen) {
            // Freezing is confirmed AND executed inside the sheet, so its button
            // owns the pending state; here we only open it. Content-sized sheet
            // (default autoCreateContainer) so it grows to fit, no scroll.
            void request({
                contents: <FreezeCardConfirmationSheet />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                },
            })
            return
        }
        // Unfreezing is immediate. Guard re-entry against a double-tap (shared
        // with the banner via useIsCardUnfreezing).
        if (isUnfreezing) return
        try {
            await unfreeze.mutateAsync()
        } catch (error) {
            await showError(error)
        }
    }, [isFrozen, isUnfreezing, unfreeze, request, showError])
    const onToggleFreeze = useCallback(() => {
        void toggleFreeze()
    }, [toggleFreeze])

    const submitSetPin = useCallback(async () => {
        // Guard re-entry so a slow token request can't stack a second WebView.
        if (setPin.isPending) return
        try {
            const session = await setPin.mutateAsync()
            pushWebView({ url: session.hostedPageUrl, id: 'card-set-pin' })
        } catch (error) {
            await showError(error)
        }
    }, [setPin, pushWebView, showError])
    const onSetPin = useCallback(() => {
        void submitSetPin()
    }, [submitSetPin])

    const onAccountsDetails = useCallback(() => {
        void request({
            contents: <CardAccountDetailsSheet />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [request])

    const onAddToWallet = useCallback(() => {
        void request({
            contents: <WalletInstructionsSheet platform={walletPlatform} />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [request, walletPlatform])

    return {
        maskedPan: `${PAN_MASK} ${panLast4 ?? PAN_MASK}`,
        secureImageUrl,
        isRevealing: cardDetails.isPending,
        onToggleReveal,
        onSecureImageError,
        fundingAddress,
        onChangeFunding: showComingSoon,
        isFrozen,
        freezeLabel: isFrozen
            ? t('peraCard.account.unfreeze_card')
            : t('peraCard.account.freeze_card'),
        isFreezing: isUnfreezing,
        canToggleFreeze,
        onToggleFreeze,
        onSetPin,
        isSettingPin: setPin.isPending,
        onAccountsDetails,
        walletPlatform,
        onAddToWallet,
        onReportLostStolen: showComingSoon,
        onReportSuspicious: showComingSoon,
        onCancelCard: showComingSoon,
    }
}
