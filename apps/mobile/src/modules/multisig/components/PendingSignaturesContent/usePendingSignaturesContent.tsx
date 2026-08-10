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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { trackEvent, MultisigEvent } from '@analytics'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    useNetwork,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    ACTIONABLE_SIGN_REQUEST_STATUSES,
    FINALIZED_SIGN_REQUEST_STATUSES,
    isDraftSignRequestId,
    useDraftSignRequestStore,
    useSignRequestDetailQuery,
    type DraftSignRequest,
    type MultisigSignRequest,
    type SignRequestStatus,
} from '@perawallet/wallet-core-multisig'
import { formatTimeRemaining, logger } from '@perawallet/wallet-core-shared'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { useBottomSheet, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useMultisigSignRequestDecline } from '../../hooks/useMultisigSignRequestDecline'
import { usePendingSignaturesSheetStore } from '../../stores/usePendingSignaturesSheetStore'
import { buildMultisigCosignRequest } from '../../utils/buildMultisigCosignRequest'
import { buildSignerRows, type SignerRow } from '../../utils/buildSignerRows'
import { getInFlightCosignAddresses } from '../../utils/getInFlightCosignAddresses'
import { getLocalUnsignedSigners } from '../../utils/getLocalUnsignedSigners'
import {
    getStatusBannerVariant,
    type StatusBannerVariant,
} from '../../utils/getStatusBannerVariant'
import { selectCosignDispatchAddresses } from '../../utils/selectCosignDispatchAddresses'
import { getSignedResponseCount } from '../../utils/signRequestStatus'
import { splitLocalUnsignedSigners } from '../../utils/splitLocalUnsignedSigners'

export type UsePendingSignaturesContentResult = {
    isLoading: boolean
    signRequest: MultisigSignRequest | null
    status: SignRequestStatus | null
    bannerVariant: StatusBannerVariant
    /**
     * Fallback when the backend supplies no `failReasonDisplay`. Status-specific
     * so an expired request reads "canceled" rather than "failed".
     */
    failureBannerKey: string
    signedCount: number
    threshold: number
    timeRemaining: string | null
    failReason: string | null
    signers: SignerRow[]
    handleClose: () => void
    /**
     * The backend query settled in error before any data arrived (e.g. the
     * request was deleted or purged). A poll failure over already-loaded data
     * keeps showing that data instead.
     */
    hasLoadError: boolean
    handleRetryLoad: () => void
    canSign: boolean
    handleSign: () => void
    handleSignParticipant: (address: string) => void
    canCancel: boolean
    isCancelling: boolean
    handleCancel: () => Promise<void>
    /**
     * A locally-created draft with no backend record yet. The first per-row Sign
     * bootstraps the real propose, and other rows block until it resolves so two
     * proposes can't race on one draft.
     */
    isDraft: boolean
    /**
     * The same race-prevention rule {@link handleSignParticipant} enforces on
     * tap, surfaced separately so the UI can grey out the other rows.
     */
    disableOtherSignersForDraft: boolean
}

/**
 * How long a `failed` request keeps polling before the failure banner commits.
 * The backend owns async submission and can briefly report `failed` for a
 * transaction that actually landed, so a later `confirmed` supersedes it. The
 * native apps never surface this transient state at all.
 */
export const FAILED_RECOVERY_WINDOW_MS = 30_000

const FAILURE_BANNER_KEY_BY_STATUS: Partial<Record<SignRequestStatus, string>> =
    {
        expired: 'multisig.pending_signatures.canceled',
        declined: 'multisig.pending_signatures.declined',
        failed: 'multisig.pending_signatures.failed_default',
    }

export const usePendingSignaturesContent =
    (): UsePendingSignaturesContentResult => {
        const { t } = useLanguage()
        const { network } = useNetwork()
        const deviceId = useDeviceID(network) ?? ''
        const accounts = useAllAccounts()
        const { decodeTransaction } = useTransactionEncoder()
        const { addSignRequest, pendingSignRequests } = useSigningRequest()
        const signRequestId = usePendingSignaturesSheetStore(
            state => state.signRequestId,
        )
        const closeSheet = usePendingSignaturesSheetStore(
            state => state.closeSheet,
        )
        const { dismiss } = useBottomSheetResult<void>()
        const { request: requestBottomSheet } = useBottomSheet()

        // Draft mode: no backend record exists yet. Happens when the only local
        // participants are hardware wallets, so the propose is deferred until
        // the user taps Sign on a Ledger row.
        const isDraft =
            signRequestId !== null && isDraftSignRequestId(signRequestId)
        const draft = useDraftSignRequestStore(state =>
            isDraft && signRequestId ? state.drafts[signRequestId] : undefined,
        )

        // Tracks whether the bounded recovery window for a `failed` request
        // has elapsed. While false, a `failed` request is treated as still
        // submitting (keep polling) so a transient backend false-negative can
        // be superseded by a later `confirmed`. See FAILED_RECOVERY_WINDOW_MS.
        const [isFailedRecoveryExpired, setIsFailedRecoveryExpired] =
            useState(false)

        const {
            data: signRequestData,
            isLoading,
            isError,
            refetch,
        } = useSignRequestDetailQuery({
            network,
            deviceId,
            signRequestId: signRequestId ?? '',
            // Disable the backend query in draft mode — there is no backend
            // record to fetch yet. We synthesize the sign-request shape from
            // the local draft below so the rest of the hook is unchanged.
            enabled: signRequestId !== null && deviceId !== '' && !isDraft,
            pollWhilePending: true,
            // Keep polling on `failed` until the recovery window elapses.
            pollWhileFailed: !isFailedRecoveryExpired,
        })
        const signRequest = isDraft
            ? (synthesizeDraftSignRequest(draft) ?? null)
            : (signRequestData ?? null)

        const status = signRequest?.status ?? null

        // Errors also stop the polling loop (refetchInterval sees no status),
        // so without a manual retry the sheet would never recover.
        const hasLoadError = isError && !signRequest

        const handleRetryLoad = useCallback(() => {
            void refetch()
        }, [refetch])

        // Measured from the FIRST `failed`, not reset per poll — the dependency
        // is the `status` string, which is stable across identical polls.
        useEffect(() => {
            if (status !== 'failed') {
                setIsFailedRecoveryExpired(false)
                return
            }
            const timer = setTimeout(
                () => setIsFailedRecoveryExpired(true),
                FAILED_RECOVERY_WINDOW_MS,
            )
            return () => clearTimeout(timer)
        }, [status])

        const isFailureWithinRecoveryWindow =
            status === 'failed' && !isFailedRecoveryExpired

        const bannerVariant: StatusBannerVariant = getStatusBannerVariant(
            status,
            isFailureWithinRecoveryWindow,
        )

        const signedCount = signRequest
            ? getSignedResponseCount(signRequest)
            : 0

        const threshold = signRequest?.multisigAccount.threshold ?? 0

        const timeRemaining =
            !signRequest ||
            (status && FINALIZED_SIGN_REQUEST_STATUSES.has(status))
                ? null
                : formatTimeRemaining(signRequest.expectedExpireDatetime)

        const {
            localKey: localKeyUnsignedSigners,
            hardware: hardwareUnsignedSet,
        } = useMemo(() => {
            if (
                !signRequest ||
                !status ||
                !ACTIONABLE_SIGN_REQUEST_STATUSES.has(status)
            ) {
                return { localKey: [], hardware: new Set<string>() }
            }
            return splitLocalUnsignedSigners(
                getLocalUnsignedSigners(signRequest, accounts),
            )
        }, [signRequest, status, accounts])

        /**
         * The signing store is the source of truth: once the actor finishes,
         * either way, the entry drops from `pendingSignRequests` and this flips
         * back to false.
         */
        const inFlightCosignAddresses = useMemo(
            () =>
                getInFlightCosignAddresses(pendingSignRequests, signRequestId),
            [pendingSignRequests, signRequestId],
        )

        const signers = useMemo(() => {
            if (!signRequest) return []
            return buildSignerRows({
                signRequest,
                status,
                hardwareUnsignedSet,
                inFlightCosignAddresses,
            })
        }, [signRequest, status, hardwareUnsignedSet, inFlightCosignAddresses])

        // In draft mode the first per-row Sign bootstraps the backend propose.
        // Lock other rows while it's in flight so two propose calls don't race.
        const disableOtherSignersForDraft =
            isDraft && signers.some(s => s.isSigning)

        const failureBannerKey =
            (status && FAILURE_BANNER_KEY_BY_STATUS[status]) ??
            'multisig.pending_signatures.failed_default'

        const handleClose = useCallback(() => {
            trackEvent(MultisigEvent.CloseForNow)
            closeSheet()
            dismiss()
        }, [closeSheet, dismiss])

        const canSign = localKeyUnsignedSigners.length > 0

        const dispatchCosign = useCallback(
            (address: string) => {
                if (!signRequest) return
                try {
                    const cosignRequest = buildMultisigCosignRequest({
                        signRequest,
                        signerAddress: address,
                        decodeTransaction,
                    })
                    addSignRequest(cosignRequest)
                } catch (error) {
                    // A cosign request that fails validation (PERA-4711) must
                    // never be signed; skip it without crashing the handler.
                    logger.error('Skipping invalid multisig cosign request', {
                        error,
                    })
                }
            },
            [signRequest, decodeTransaction, addSignRequest],
        )

        const handleSign = useCallback(() => {
            if (!signRequest) return
            // Skip signers already in flight and cap the batch at the
            // signatures still needed — otherwise a repeated Sign (or a device
            // holding more participants than the threshold needs) stacks
            // surplus cosign sheets that then linger.
            const toDispatch = selectCosignDispatchAddresses({
                localKeySigners: localKeyUnsignedSigners,
                inFlightAddresses: inFlightCosignAddresses,
                threshold,
                signedCount,
            })
            if (toDispatch.length === 0) return
            trackEvent(MultisigEvent.ConfirmTransaction)
            for (const address of toDispatch) {
                dispatchCosign(address)
            }
        }, [
            signRequest,
            localKeyUnsignedSigners,
            inFlightCosignAddresses,
            threshold,
            signedCount,
            dispatchCosign,
        ])

        const handleSignParticipant = useCallback(
            (address: string) => {
                if (!signRequest) return
                if (!status || !ACTIONABLE_SIGN_REQUEST_STATUSES.has(status))
                    return
                if (!hardwareUnsignedSet.has(address)) return
                if (inFlightCosignAddresses.has(address)) return
                // Draft mode: one per-row Sign at a time. The first tap
                // bootstraps the real backend propose; allowing a parallel
                // tap would race two propose calls on the same draft.
                if (isDraft && inFlightCosignAddresses.size > 0) return
                dispatchCosign(address)
            },
            [
                signRequest,
                status,
                hardwareUnsignedSet,
                inFlightCosignAddresses,
                dispatchCosign,
                isDraft,
            ],
        )

        const {
            canPerform: canCancel,
            isPending: isCancelling,
            handleConfirm: cancelMutationCall,
        } = useMultisigSignRequestDecline({
            mode: 'cancel',
            signRequest,
        })

        const handleCancel = useCallback(async () => {
            trackEvent(MultisigEvent.CancelTransaction)
            const confirmed = await requestBottomSheet<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon='warning'
                        iconVariant='error'
                        title={t('multisig.cancel_transaction.confirm_title')}
                        message={t('multisig.cancel_transaction.confirm_body')}
                        confirmLabel={t(
                            'multisig.cancel_transaction.confirm_action',
                        )}
                        cancelLabel={t(
                            'multisig.cancel_transaction.keep_waiting',
                        )}
                        confirmVariant='primary'
                        testID='cancel_transaction_confirm_sheet'
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!confirmed) return
            await cancelMutationCall()
            closeSheet()
            dismiss()
        }, [requestBottomSheet, t, cancelMutationCall, closeSheet, dismiss])

        return {
            isLoading,
            signRequest,
            status,
            bannerVariant,
            failureBannerKey,
            signedCount,
            threshold,
            // Draft requests have no on-chain expiry yet (no backend record).
            // Hide the time-remaining badge until propose lands and the
            // sheet swaps to the real signRequestId.
            timeRemaining: isDraft ? null : timeRemaining,
            failReason: signRequest?.failReasonDisplay ?? null,
            signers,
            handleClose,
            hasLoadError,
            handleRetryLoad,
            canSign,
            handleSign,
            handleSignParticipant,
            canCancel,
            isCancelling,
            handleCancel,
            isDraft,
            disableOtherSignersForDraft,
        }
    }

/**
 * Lets the sheet render unchanged in draft mode. Every participant shows as
 * pending — no responses exist until a Ledger row bootstraps the real propose.
 */
const synthesizeDraftSignRequest = (
    draft: DraftSignRequest | undefined,
): MultisigSignRequest | null => {
    if (!draft) return null
    return {
        id: draft.localId,
        status: 'pending' as const,
        type: draft.proposeType,
        createdAt: draft.createdAt,
        // Synthetic placeholder — never read in draft mode because
        // `timeRemaining` is explicitly nulled out above.
        expectedExpireDatetime: draft.createdAt,
        failReasonDisplay: null,
        proposerAddress: null,
        multisigAccount: {
            customId: draft.localId,
            createdAt: draft.createdAt,
            address: draft.multisigAddress,
            version: draft.multisigDetails.version,
            threshold: draft.multisigDetails.threshold,
            participantAddresses: draft.multisigDetails.participantAddresses,
        },
        transactionLists: [
            {
                id: `${draft.localId}-txl-0`,
                rawTransactions: draft.rawTransactionsBase64,
                firstValidBlock: 0,
                lastValidBlock: 0,
                expectedExpireDatetime: draft.createdAt,
                responses: [],
            },
        ],
    }
}
