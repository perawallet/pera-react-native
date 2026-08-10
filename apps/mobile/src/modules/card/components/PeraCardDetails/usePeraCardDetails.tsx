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

import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, Platform } from 'react-native'
import {
    CardStatus,
    useCardDetailsMutation,
    useCardIssuance,
    useCardStore,
    useConnectFundingSourceMutation,
    useIsCardUnfreezing,
    useSetCardPinMutation,
    type CardIssuanceState,
} from '@perawallet/wallet-core-card'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import { useNetworkStatus } from '@modules/network'
import { routeCapabilities } from '@routes/capabilities'
import { useRequirePinVerification } from '@modules/security'
import {
    useAddCardToWallet,
    useCardErrorToast,
    useCardFundingSourcePicker,
    useIsCardAutoFundingActive,
    useOpenCardSupport,
} from '../../hooks'
// Imported directly (not via the hooks barrel) to avoid an import cycle: the
// flow orchestrator pulls in report sheet components that import from that barrel.
import { useReportSuspiciousFlow } from '../../hooks/useReportSuspiciousFlow'
import { CardAccountDetailsSheet } from '../CardAccountDetailsSheet'
import { FreezeCardConfirmationSheet } from '../FreezeCardConfirmationSheet'
import { ReportLostStolenSheet } from '../ReportLostStolenSheet'
import { SelectFundingTypeSheet } from '../SelectFundingTypeSheet'
import { UnfreezeCardConfirmationSheet } from '../UnfreezeCardConfirmationSheet'
import {
    WalletInstructionsSheet,
    type WalletPlatform,
} from '../WalletInstructionsSheet'
import { SECURE_CARD_IMAGE_CSS } from '../../utils/secureCardImageStyle'

const PAN_MASK = '••••'

// expo-image can stall without ever firing onLoad/onError (a trickling
// connection, or the load-deferral class of bugs the reveal works around).
// Bound the wait so the reveal button can't be pinned in its disabled spinner
// state forever — on timeout we fall back to the masked card and notify.
const SECURE_IMAGE_LOAD_TIMEOUT_MS = 15_000

// Once revealed, re-mask automatically after this idle period so the PAN/CVV
// isn't left on screen indefinitely. The cached image is kept, so re-revealing
// afterwards is still an instant flip with no new single-use token.
const AUTO_HIDE_MS = 30_000

/** Single-use secure-view image plus whether it is still downloading. */
type SecureView = {
    /** Baanx-hosted image URL (PAN/CVC/expiry rendered server-side). */
    url: string
    /** True until the image's onLoad fires. */
    isLoading: boolean
}

type UsePeraCardDetailsResult = {
    /** Masked PAN for the card visual, e.g. "•••• 2234". */
    maskedPan: string
    /** Secure-view image URL once fetched. Cached for the screen visit — it
     * persists across hide so re-revealing is an instant flip with no re-fetch;
     * `null` until the first reveal (and after a load failure). */
    secureImageUrl: string | null
    /** True when the secure card face should be shown (flipped open): revealed
     * AND the image has finished loading. Drives the flip and the button label. */
    isCardOpen: boolean
    /** True only during the first fetch + image download (spinner + disabled
     * button). A cached re-reveal never enters this state. */
    isRevealing: boolean
    onToggleReveal: () => void
    /** The secure image finished rendering — ends the reveal pending state. */
    onSecureImageLoad: () => void
    /** Recover if the single-use secure image fails to load: hide it + toast. */
    onSecureImageError: () => void
    /** Connected funding-source address, or `null` if none is stored. */
    fundingAddress: string | null
    onChangeFunding: () => void
    /** True once a card has actually been created (the status query returns
     * one). Funding TYPE is per-card, so its selector only makes sense once
     * a card exists — the funding source picker itself has no such gate. */
    hasCard: boolean
    /** Where the Baanx card is on its way to existing (drives the dimmed
     * visual, the issuance notice, and hiding the card-only affordances
     * until it reaches READY). */
    issuanceState: CardIssuanceState
    /** Fires a fresh order after a failed attempt (ORDER_FAILED notice). */
    onRetryOrder: () => void
    /** Opens support for the terminal VERIFICATION_REJECTED notice. */
    onContactSupport: () => void
    /** Localised Auto/Manual funding label for the Funding Type row. */
    fundingTypeLabel: string
    /** Opens the Select Funding Type sheet. */
    onChangeFundingType: () => void
    /** True when there is no connectivity (device offline, or the status query
     * is paused pending reconnect) — drives disabling the offline-unsafe card
     * actions (set PIN, freeze/unfreeze, reveal). */
    isOffline: boolean
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
    /** False once the card already lives in the OS wallet — the add row must
     * be hidden then (a Google certification requirement). */
    showAddToWallet: boolean
    onAddToWallet: () => void
    onReportLostStolen: () => void
    onReportSuspicious: () => void
}

export const usePeraCardDetails = (): UsePeraCardDetailsResult => {
    const { t } = useLanguage()
    const { errorToast, infoToast } = useToast()
    const { pushWebView } = useWebView()
    const { request } = useBottomSheet()
    const { requirePinVerification } = useRequirePinVerification()

    const panLast4 = useCardStore(state => state.lastKnownPanLast4)
    const fundingAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )
    const isAutoFunding = useIsCardAutoFundingActive()
    const fundingTypeLabel = isAutoFunding
        ? t('peraCard.setup_status.funding_type_auto_title')
        : t('peraCard.setup_status.funding_type_manual_title')

    const { hasInternet } = useNetworkStatus()
    // Owns the KYC-wait / auto-order / provisioning-poll lifecycle, and
    // re-exposes the card status it already observes so this hook doesn't
    // mount a second observer of the same query. Coordinates with the
    // dashboard shell's instance through the shared caches.
    const {
        state: issuanceState,
        retryOrder: onRetryOrder,
        card,
        isStatusPaused,
    } = useCardIssuance()
    const isFrozen = card?.status === CardStatus.Frozen
    // Freeze/unfreeze only applies to a live card; a BLOCKED card can't toggle.
    const canToggleFreeze = card?.status !== CardStatus.Blocked
    // Offline whenever the device has no connectivity, or the status query is
    // sitting paused waiting for it to return (fail-fast mutations reject
    // instead, but the query can still be mid-pause on mount).
    const isOffline = !hasInternet || isStatusPaused

    // iOS provisions to Apple Wallet, Android to Google Pay — show one row.
    const walletPlatform = Platform.OS === 'ios' ? 'apple' : 'google'

    const cardDetails = useCardDetailsMutation()
    // Shared with the Card Frozen banner so the in-flight unfreeze state (driven
    // by the confirmation sheet) reflects on both entry points.
    const isUnfreezing = useIsCardUnfreezing()
    const setPin = useSetCardPinMutation()

    // The secure image (URL + load state as one value so they can never drift)
    // is fetched once and cached in memory for the screen visit — never written
    // to disk, and dropped when the screen unmounts. `isRevealed` is the
    // separate show/hide toggle so hiding keeps the cached image for an instant
    // re-reveal instead of re-fetching a fresh single-use token each time.
    // Caveat: with on-disk caching off, the OS may still purge the decoded
    // bitmap under memory pressure, so the "instant re-reveal" isn't guaranteed
    // — it then degrades gracefully via the image's onError → failSecureImage.
    const [secureView, setSecureView] = useState<SecureView | null>(null)
    const [isRevealed, setIsRevealed] = useState(false)
    const secureImageUrl = secureView?.url ?? null
    const isSecureImageLoading = secureView?.isLoading ?? false
    // Only "open" once the image has actually loaded, so the flip and the "Hide"
    // label never appear over a still-loading card.
    const isCardOpen = isRevealed && secureView != null && !isSecureImageLoading

    const showError = useCardErrorToast()

    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const clearLoadTimeout = useCallback(() => {
        if (loadTimeoutRef.current != null) {
            clearTimeout(loadTimeoutRef.current)
            loadTimeoutRef.current = null
        }
    }, [])

    // Tracks mount status so a reveal that resolves after the screen is gone
    // can't setState or arm a timeout on an unmounted component.
    const isMountedRef = useRef(true)
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    // Synchronous re-entry guard for the first reveal. The button's `disabled`
    // only takes effect after a re-render and `cardDetails.isPending` on the
    // closure doesn't flip until then either, so a same-tick double-tap could
    // otherwise fire `mutateAsync` twice and spend two single-use tokens.
    const isFetchingRevealRef = useRef(false)

    // The secure-view image is the only way details are shown; if it fails or
    // never resolves, drop the cache, fall back to the masked card, and notify.
    const failSecureImage = useCallback(() => {
        clearLoadTimeout()
        setSecureView(null)
        setIsRevealed(false)
        errorToast(
            t('peraCard.account.error_title'),
            t('peraCard.account.error_body'),
        )
    }, [clearLoadTimeout, errorToast, t])

    // Async impls are wrapped in sync `void` handlers below so the exposed
    // callbacks are `() => void` (the codebase convention for onPress props).
    const toggleReveal = useCallback(async () => {
        // Hide: just flip closed. Keep the cached image so the next reveal is
        // instant (no new token, no spinner).
        if (isRevealed) {
            setIsRevealed(false)
            return
        }
        // Already fetched earlier this visit: show it without re-fetching.
        if (secureView != null) {
            setIsRevealed(true)
            return
        }
        // First reveal this visit: fetch the single-use secure view. Guard
        // re-entry so a same-tick double-tap can't spend two tokens.
        if (isFetchingRevealRef.current) return
        isFetchingRevealRef.current = true
        try {
            const view = await cardDetails.mutateAsync({
                customCss: SECURE_CARD_IMAGE_CSS,
            })
            // Bail if the screen unmounted mid-fetch — no setState / timeout on a
            // dead component (the unmount cleanup effect has already run).
            if (!isMountedRef.current) return
            setSecureView({ url: view.imageUrl, isLoading: true })
            setIsRevealed(true)
            clearLoadTimeout()
            loadTimeoutRef.current = setTimeout(
                failSecureImage,
                SECURE_IMAGE_LOAD_TIMEOUT_MS,
            )
        } catch (error) {
            await showError(error)
        } finally {
            isFetchingRevealRef.current = false
        }
    }, [
        isRevealed,
        secureView,
        cardDetails,
        showError,
        clearLoadTimeout,
        failSecureImage,
    ])
    const onToggleReveal = useCallback(() => {
        void toggleReveal()
    }, [toggleReveal])

    const onSecureImageLoad = useCallback(() => {
        clearLoadTimeout()
        setSecureView(view => (view ? { ...view, isLoading: false } : view))
    }, [clearLoadTimeout])

    const onSecureImageError = failSecureImage

    // Drop any pending load timeout if the screen unmounts mid-download.
    useEffect(() => clearLoadTimeout, [clearLoadTimeout])

    // Auto re-mask after an idle period once open, so the PAN/CVV isn't left on
    // screen. Keeps the cached image (re-reveal stays instant). The effect
    // re-runs whenever the open state changes — so the timer resets on each
    // reveal and is cleared on hide and on unmount.
    useEffect(() => {
        if (!isCardOpen) return
        const timeout = setTimeout(() => setIsRevealed(false), AUTO_HIDE_MS)
        return () => clearTimeout(timeout)
    }, [isCardOpen])

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
        // A live Baanx session alone must not authorize a PIN change — require
        // local re-auth first, mirroring useAuthorizeCardDelegation.
        if (!(await requirePinVerification())) return
        try {
            const session = await setPin.mutateAsync()
            if (!routeCapabilities.inAppWebView) {
                void Linking.openURL(session.hostedPageUrl)
                return
            }
            pushWebView({ url: session.hostedPageUrl, id: 'card-set-pin' })
        } catch (error) {
            await showError(error)
        }
    }, [setPin, requirePinVerification, pushWebView, showError])
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

    const { canPushProvision, isCardInWallet, startAddCardToWallet } =
        useAddCardToWallet()

    const openWalletInstructions = useCallback(() => {
        void request({
            contents: <WalletInstructionsSheet platform={walletPlatform} />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [request, walletPlatform])

    // Native push provisioning when the OS + accreditations allow it; the
    // manual instructions sheet is both the pre-accreditation default and the
    // fallback when the native flow can't complete. A deliberate user cancel
    // ('dismissed') shows nothing.
    const addToWallet = useCallback(async () => {
        if (!canPushProvision) {
            openWalletInstructions()
            return
        }
        const outcome = await startAddCardToWallet()
        if (outcome === 'fallback') openWalletInstructions()
    }, [canPushProvision, startAddCardToWallet, openWalletInstructions])
    const onAddToWallet = useCallback(() => {
        void addToWallet()
    }, [addToWallet])

    const { pickFundingSource } = useCardFundingSourcePicker()
    const { mutateAsync: connectFundingSourceAsync } =
        useConnectFundingSourceMutation()

    // Change the linked account. Blocked while Auto funding is on: the AutoDraw
    // authorization (AB-registered LSig + on-chain Killswitch box) is
    // per-account, so repointing the card would leave the OLD account's live
    // authorization dangling and the new account without one. Until
    // change-funding is unified onto the AB flow (kill old → enable new), the
    // safe path is: switch to Manual → change account → re-enable Auto.
    // TODO(card): unify change-funding onto useAutoDrawSwitch and lift this.
    const performChangeFunding = useCallback(async () => {
        // Currently unreachable: the only entry point left is Connect, which
        // renders only with no account linked, and Auto needs one. Kept for
        // when the Change link returns — see the TODO in
        // CardFundingAccountSection.
        if (isAutoFunding) {
            infoToast(
                t('peraCard.account.funding_change_requires_manual_title'),
                t('peraCard.account.funding_change_requires_manual_body'),
            )
            return
        }
        const account = await pickFundingSource()
        if (!account || account.address === fundingAddress) return
        try {
            await connectFundingSourceAsync({ address: account.address })
        } catch (error) {
            await showError(error)
        }
    }, [
        fundingAddress,
        isAutoFunding,
        pickFundingSource,
        connectFundingSourceAsync,
        showError,
        infoToast,
        t,
    ])

    // Guard the whole picker → repoint sequence so a double-tap can't run two
    // concurrent changes (the picker opens before any mutation flips its own
    // pending flag).
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

    // Rejected KYC is terminal, so the notice's only action is support.
    const onContactSupport = useOpenCardSupport()

    const { start: onReportSuspicious } = useReportSuspiciousFlow()

    return {
        maskedPan: `${PAN_MASK} ${panLast4 ?? PAN_MASK}`,
        secureImageUrl,
        isCardOpen,
        isRevealing: cardDetails.isPending || isSecureImageLoading,
        onToggleReveal,
        onSecureImageLoad,
        onSecureImageError,
        fundingAddress,
        onChangeFunding,
        hasCard: card != null,
        issuanceState,
        onRetryOrder,
        onContactSupport,
        fundingTypeLabel,
        onChangeFundingType,
        isOffline,
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
        showAddToWallet: !isCardInWallet,
        onAddToWallet,
        onReportLostStolen,
        onReportSuspicious,
    }
}
