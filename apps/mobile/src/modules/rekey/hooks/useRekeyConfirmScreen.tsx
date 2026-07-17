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

import { useCallback, useRef } from 'react'
import {
    getAccountDisplayName,
    isQuantumDowngrade,
    isRekeyedAccount,
    useAllAccounts,
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useRekeyFeePreflight,
    useRekeyTransactionFeeQuery,
    useSubmitRekeyMutation,
} from '@perawallet/wallet-core-transactions'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import { trackEvent, OnboardingEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useHandleRekeyError } from './useHandleRekeyError'
import { useRekeyProposeHandoff } from './useRekeyProposeHandoff'
import { PreviousRekeyWarningSheet } from '../components/PreviousRekeyWarningSheet'
import { QuantumDowngradeWarningSheet } from '../components/QuantumDowngradeWarningSheet'

import type { Decimal } from 'decimal.js'

// Shared by the rekey-to-{ledger,shared,standard} confirm screens, which differ
// only in the target stack they navigate to, the support URL, and the warning
// sheet's i18n prefix / testID.
export type RekeyConfirmConfig = {
    sourceAddress: string
    targetAddress: string
    supportUrl: string
    warningI18nPrefix: string
    warningTestID: string
    /** Navigate to the variant's success screen after a confirmed rekey. */
    onSubmitSuccess: (sourceAddress: string) => void
    /**
     * Called when the rekey is a multisig (shared-account) transaction that
     * gets proposed for cosigning instead of broadcast immediately. The signing
     * Promise never resolves in that case — the propose surfaces via a
     * `'proposed'` signing event — so the flow hands off here (exiting to the
     * pending-signatures sheet) rather than showing the success screen. Omit
     * for variants whose source is never a shared account.
     */
    onProposed?: (sourceAddress: string) => void
}

export type UseRekeyConfirmScreenResult = {
    source: WalletAccount | null
    target: WalletAccount | null
    currentAuth: WalletAccount | null
    feeAlgos: Decimal | undefined
    feePending: boolean
    hasPreviousRekey: boolean
    isSubmitting: boolean
    isUnderfunded: boolean
    handleConfirmPress: () => void
}

export const useRekeyConfirmScreen = ({
    sourceAddress,
    targetAddress,
    supportUrl,
    warningI18nPrefix,
    warningTestID,
    onSubmitSuccess,
    onProposed,
}: RekeyConfirmConfig): UseRekeyConfirmScreenResult => {
    const navigation = useAppNavigation()

    const source = useFindAccountByAddress(sourceAddress)
    const target = useFindAccountByAddress(targetAddress)
    const currentAuth = useFindAccountByAddress(source?.rekeyAddress ?? '')
    const accounts = useAllAccounts()

    // A shared-account rekey is signed via the multisig propose flow, whose
    // signing Promise never resolves — hand off to the pending-signatures
    // sheet on the 'proposed' event instead of leaving the CTA spinning.
    const { markSubmitted, hasHandedOff } = useRekeyProposeHandoff(() =>
        onProposed?.(sourceAddress),
    )

    const { t } = useLanguage()
    const handleRekeyError = useHandleRekeyError()
    const { pushWebView } = useWebView()
    const { request: requestBottomSheet } = useBottomSheet()
    const { submitAsync, isPending: isSubmitting } = useSubmitRekeyMutation({
        signingMetadata: {
            name: t('rekey.signing.source_name'),
            description: t('rekey.signing.source_description'),
        },
    })
    const { feeAlgos, isPending: feePending } = useRekeyTransactionFeeQuery(
        sourceAddress,
        targetAddress,
    )
    // The source pays the rekey fee — block before any sign request is
    // created (and before the Ledger device prompt for hardware auths).
    const { isUnderfunded } = useRekeyFeePreflight(sourceAddress, feeAlgos)

    const hasPreviousRekey = isRekeyedAccount(source)

    // Synchronous in-flight guard: `isSubmitting` only propagates on the
    // next render, so a same-frame double tap would submit twice without it.
    const inFlightRef = useRef(false)

    const submit = useCallback(async () => {
        if (!source || !target) {
            // The CTA is disabled in this state, but guard anyway — a
            // dead confirm screen with no feedback is worse than a toast.
            handleRekeyError(
                new Error('Rekey source or target could not be resolved'),
            )
            navigation.goBack()
            return
        }
        if (isUnderfunded) return

        if (target.address === source.rekeyAddress) {
            // Unreachable via the select-target screens (eligibility excludes
            // the current auth), but guard against a stale route param
            // producing a fee-burning no-op rekey.
            handleRekeyError(
                new Error('Rekey target is already the current auth address'),
            )
            return
        }

        markSubmitted()
        try {
            await submitAsync({
                sourceAddress: source.address,
                rekeyToAddress: target.address,
            })
            // A multisig propose already handed off via the 'proposed' event;
            // don't also show the success screen.
            if (hasHandedOff()) return
            trackEvent(OnboardingEvent.RekeyAccount)
            onSubmitSuccess(source.address)
        } catch (error) {
            // After a propose handoff the signing Promise eventually rejects on
            // timeout — that's expected, not a failure to surface.
            if (hasHandedOff()) return
            handleRekeyError(error)
        }
    }, [
        submitAsync,
        navigation,
        handleRekeyError,
        source,
        target,
        isUnderfunded,
        onSubmitSuccess,
        markSubmitted,
        hasHandedOff,
    ])

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: supportUrl })
    }, [pushWebView, supportUrl])

    const runConfirmFlow = useCallback(async () => {
        // Gate before the warning sheets too — confirming a warning must
        // never lead into a rekey that cannot pay its fee.
        if (isUnderfunded) return

        if (hasPreviousRekey) {
            const sourceName = source ? getAccountDisplayName(source) : ''
            const currentAuthName = currentAuth
                ? getAccountDisplayName(currentAuth)
                : ''
            const confirmed = await requestBottomSheet<boolean>({
                contents: (
                    <PreviousRekeyWarningSheet
                        i18nPrefix={warningI18nPrefix}
                        testID={warningTestID}
                        currentAuthName={currentAuthName}
                        sourceName={sourceName}
                        onLearnMore={handleLearnMore}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!confirmed) return
        }

        // Rekeying a quantum account to an Ed25519 authority strips its
        // quantum-safe protection — warn before it happens. Not shown when the
        // target's effective authority is also quantum, nor for Ed25519 sources.
        if (source && target && isQuantumDowngrade(source, target, accounts)) {
            const confirmed = await requestBottomSheet<boolean>({
                contents: (
                    <QuantumDowngradeWarningSheet
                        sourceName={getAccountDisplayName(source)}
                        targetName={getAccountDisplayName(target)}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!confirmed) return
        }

        await submit()
    }, [
        hasPreviousRekey,
        source,
        target,
        accounts,
        currentAuth,
        isUnderfunded,
        requestBottomSheet,
        handleLearnMore,
        submit,
        warningI18nPrefix,
        warningTestID,
    ])

    const handleConfirmPress = useCallback(async () => {
        if (inFlightRef.current) return
        inFlightRef.current = true
        try {
            await runConfirmFlow()
        } finally {
            inFlightRef.current = false
        }
    }, [runConfirmFlow])

    return {
        source: source ?? null,
        target: target ?? null,
        currentAuth: currentAuth ?? null,
        feeAlgos,
        feePending,
        hasPreviousRekey,
        isSubmitting,
        isUnderfunded,
        handleConfirmPress: () => void handleConfirmPress(),
    }
}
