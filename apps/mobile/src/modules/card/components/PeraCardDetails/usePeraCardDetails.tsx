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

import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import {
    CardStatus,
    FundingType,
    useCardDetailsMutation,
    useCardStatusQuery,
    useCardStore,
    useConnectFundingSourceMutation,
    useIsCardUnfreezing,
    useSetCardPinMutation,
} from '@perawallet/wallet-core-card'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import {
    useAuthorizeCardDelegation,
    useCardErrorToast,
    useCardFundingDelegation,
    useCardFundingSourcePicker,
    useReportSuspiciousFlow,
} from '../../hooks'
import { CardAccountDetailsSheet } from '../CardAccountDetailsSheet'
import { FreezeCardConfirmationSheet } from '../FreezeCardConfirmationSheet'
import { ReportLostStolenSheet } from '../ReportLostStolenSheet'
import { SelectFundingTypeSheet } from '../SelectFundingTypeSheet'
import { UnfreezeCardConfirmationSheet } from '../UnfreezeCardConfirmationSheet'
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
    /** Localised Auto/Manual funding label for the Funding Type row. */
    fundingTypeLabel: string
    /** Opens the Select Funding Type sheet. */
    onChangeFundingType: () => void
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
}

export const usePeraCardDetails = (): UsePeraCardDetailsResult => {
    const { t } = useLanguage()
    const { errorToast, infoToast } = useToast()
    const { pushWebView } = useWebView()
    const { request } = useBottomSheet()

    const panLast4 = useCardStore(state => state.lastKnownPanLast4)
    const fundingAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )
    const selectedFundingType = useCardStore(state => state.selectedFundingType)
    const isAutoFunding = selectedFundingType === FundingType.Auto
    const fundingTypeLabel = isAutoFunding
        ? t('peraCard.setup_status.funding_type_auto_title')
        : t('peraCard.setup_status.funding_type_manual_title')

    const { data: card } = useCardStatusQuery()
    const isFrozen = card?.status === CardStatus.Frozen
    // Freeze/unfreeze only applies to a live card; a BLOCKED card can't toggle.
    const canToggleFreeze = card?.status !== CardStatus.Blocked

    // iOS provisions to Apple Wallet, Android to Google Pay — show one row.
    const walletPlatform = Platform.OS === 'ios' ? 'apple' : 'google'

    const cardDetails = useCardDetailsMutation()
    // Shared with the Card Frozen banner so the in-flight unfreeze state (driven
    // by the confirmation sheet) reflects on both entry points.
    const isUnfreezing = useIsCardUnfreezing()
    const setPin = useSetCardPinMutation()

    // The single-use secure image is held only in memory and discarded when the
    // user hides it again — never persisted.
    const [secureImageUrl, setSecureImageUrl] = useState<string | null>(null)

    const showError = useCardErrorToast()

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

    // Both freeze and unfreeze are confirmed AND executed inside their sheet, so
    // the sheet's button owns the pending state; here we only open it.
    // Content-sized sheet (default autoCreateContainer) so it grows to fit.
    const onToggleFreeze = useCallback(() => {
        void request({
            contents: isFrozen ? (
                <UnfreezeCardConfirmationSheet />
            ) : (
                <FreezeCardConfirmationSheet />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
            },
        })
    }, [isFrozen, request])

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

    const accounts = useAllAccounts()
    const { pickFundingSource } = useCardFundingSourcePicker()
    const { delegateTo, cancelDelegation, canDelegate } =
        useCardFundingDelegation()
    const { authorizeDelegation } = useAuthorizeCardDelegation()
    const { mutateAsync: connectFundingSourceAsync } =
        useConnectFundingSourceMutation()

    // Change the linked account. With auto-funding on, the new account is
    // delegated BEFORE the card is repointed to it, so a signing/post failure
    // leaves the old (still-delegated) account connected and the card is never
    // pointed at an un-delegated source. The old delegation is only zeroed
    // once the new one is live — best-effort, since Baanx has no DELETE, so a
    // failure there just leaves a stale allowance surfaced as a soft warning.
    const performChangeFunding = useCallback(async () => {
        const previousAccount = accounts.find(
            account => account.address === fundingAddress,
        )
        const account = await pickFundingSource()
        if (!account || account.address === fundingAddress) return

        // Manual funding: no delegation involved, just link the new account.
        if (!isAutoFunding) {
            try {
                await connectFundingSourceAsync({ address: account.address })
            } catch (error) {
                await showError(error)
            }
            return
        }

        if (!canDelegate(account)) {
            errorToast(
                t('peraCard.account.funding_delegation_unsupported_title'),
                t('peraCard.account.funding_delegation_unsupported_body'),
            )
            return
        }
        // Delegate the new account first — the card stays funded by the old
        // account until this succeeds, so a failure changes nothing on Baanx.
        try {
            // Consent + live PIN/biometric before signing the grant.
            const authorized = await authorizeDelegation(account, delegateTo)
            if (!authorized) return
        } catch {
            // Recoverable: nothing was repointed; the old account is intact.
            errorToast(
                t('peraCard.account.funding_redelegate_failed_title'),
                t('peraCard.account.funding_redelegate_failed_body'),
            )
            return
        }
        // New account is delegated; now repoint the card to it.
        try {
            await connectFundingSourceAsync({ address: account.address })
        } catch (error) {
            // The new account is delegated but couldn't be linked; the card
            // stays on the old (still connected + delegated) account, so the
            // new allowance is harmless until a retry re-links it.
            await showError(error)
            return
        }
        if (previousAccount && canDelegate(previousAccount)) {
            try {
                await cancelDelegation(previousAccount)
            } catch {
                infoToast(
                    t('peraCard.account.funding_cancel_old_failed_title'),
                    t('peraCard.account.funding_cancel_old_failed_body'),
                )
            }
        }
    }, [
        accounts,
        fundingAddress,
        isAutoFunding,
        pickFundingSource,
        canDelegate,
        connectFundingSourceAsync,
        delegateTo,
        authorizeDelegation,
        cancelDelegation,
        showError,
        errorToast,
        infoToast,
        t,
    ])

    // Guard the whole picker → consent/PIN → delegate → repoint sequence so a
    // double-tap can't run two concurrent changes (the consent gate opens
    // before any mutation flips its own pending flag).
    const isChangingFundingRef = useRef(false)
    const changeFunding = useCallback(async () => {
        if (isChangingFundingRef.current) return
        isChangingFundingRef.current = true
        try {
            await performChangeFunding()
        } finally {
            isChangingFundingRef.current = false
        }
    }, [performChangeFunding])
    const onChangeFunding = useCallback(() => {
        void changeFunding()
    }, [changeFunding])

    const onChangeFundingType = useCallback(() => {
        void request({
            contents: <SelectFundingTypeSheet />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
            },
        })
    }, [request])

    const onReportLostStolen = useCallback(() => {
        void request({
            contents: <ReportLostStolenSheet />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
            },
        })
    }, [request])

    const { start: onReportSuspicious } = useReportSuspiciousFlow()

    return {
        maskedPan: `${PAN_MASK} ${panLast4 ?? PAN_MASK}`,
        secureImageUrl,
        isRevealing: cardDetails.isPending,
        onToggleReveal,
        onSecureImageError,
        fundingAddress,
        onChangeFunding,
        fundingTypeLabel,
        onChangeFundingType,
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
        onReportLostStolen,
        onReportSuspicious,
    }
}
