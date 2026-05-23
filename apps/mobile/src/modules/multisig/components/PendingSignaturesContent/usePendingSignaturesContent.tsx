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

import { useCallback, useMemo } from 'react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    useNetwork,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    ACTIONABLE_SIGN_REQUEST_STATUSES,
    FINALIZED_SIGN_REQUEST_STATUSES,
    useSignRequestDetailQuery,
    type MultisigSignRequest,
    type SignRequestStatus,
} from '@perawallet/wallet-core-multisig'
import { formatTimeRemaining } from '@perawallet/wallet-core-shared'
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
import { getSignedResponseCount } from '../../utils/signRequestStatus'
import { splitLocalUnsignedSigners } from '../../utils/splitLocalUnsignedSigners'

export type UsePendingSignaturesContentResult = {
    isLoading: boolean
    signRequest: MultisigSignRequest | null
    status: SignRequestStatus | null
    bannerVariant: StatusBannerVariant
    /**
     * Translation key for the failure banner's default message — used when the
     * backend doesn't supply a `failReasonDisplay`. Status-specific so an
     * expired request reads "Transaction canceled" rather than the generic
     * "Transaction failed".
     */
    failureBannerKey: string
    signedCount: number
    threshold: number
    timeRemaining: string | null
    failReason: string | null
    signers: SignerRow[]
    handleClose: () => void
    canSign: boolean
    handleSign: () => void
    handleSignParticipant: (address: string) => void
    canCancel: boolean
    isCancelling: boolean
    handleCancel: () => Promise<void>
}

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

        const { data: signRequestData, isLoading } = useSignRequestDetailQuery({
            network,
            deviceId,
            signRequestId: signRequestId ?? '',
            enabled: signRequestId !== null && deviceId !== '',
            pollWhilePending: true,
        })
        const signRequest = signRequestData ?? null

        const status = signRequest?.status ?? null

        const bannerVariant: StatusBannerVariant =
            getStatusBannerVariant(status)

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
         * Source of truth for `isSigning` is the signing store: once the
         * actor finishes (success → backend addSignatures → next
         * sign-request-detail poll observes the signed response; failure →
         * the signing event bus publishes a 'failed' event for the inline
         * error view), the entry drops from `pendingSignRequests` and
         * `isSigning` flips back to false.
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

        const failureBannerKey =
            (status && FAILURE_BANNER_KEY_BY_STATUS[status]) ??
            'multisig.pending_signatures.failed_default'

        const handleClose = useCallback(() => {
            closeSheet()
            dismiss()
        }, [closeSheet, dismiss])

        const canSign = localKeyUnsignedSigners.length > 0

        const dispatchCosign = useCallback(
            (address: string) => {
                if (!signRequest) return
                const cosignRequest = buildMultisigCosignRequest({
                    signRequest,
                    signerAddress: address,
                    decodeTransaction,
                })
                addSignRequest(cosignRequest)
            },
            [signRequest, decodeTransaction, addSignRequest],
        )

        const handleSign = useCallback(() => {
            if (!signRequest) return
            if (localKeyUnsignedSigners.length === 0) return
            for (const signer of localKeyUnsignedSigners) {
                dispatchCosign(signer.address)
            }
        }, [signRequest, localKeyUnsignedSigners, dispatchCosign])

        const handleSignParticipant = useCallback(
            (address: string) => {
                if (!signRequest) return
                if (!status || !ACTIONABLE_SIGN_REQUEST_STATUSES.has(status))
                    return
                if (!hardwareUnsignedSet.has(address)) return
                if (inFlightCosignAddresses.has(address)) return
                dispatchCosign(address)
            },
            [
                signRequest,
                status,
                hardwareUnsignedSet,
                inFlightCosignAddresses,
                dispatchCosign,
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
            timeRemaining,
            failReason: signRequest?.failReasonDisplay ?? null,
            signers,
            handleClose,
            canSign,
            handleSign,
            handleSignParticipant,
            canCancel,
            isCancelling,
            handleCancel,
        }
    }
