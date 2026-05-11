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
    FAILURE_SIGN_REQUEST_STATUSES,
    FINALIZED_SIGN_REQUEST_STATUSES,
    useSignRequestDetailQuery,
    type MultisigSignRequest,
    type SignRequestStatus,
} from '@perawallet/wallet-core-multisig'
import { formatTimeRemaining } from '@perawallet/wallet-core-shared'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { useBottomSheet, useBottomSheetResult } from '@modules/bottom-sheet'
import { useMultisigSignRequestDecline } from '../../hooks/useMultisigSignRequestDecline'
import { usePendingSignaturesSheetStore } from '../../stores/usePendingSignaturesSheetStore'
import { buildMultisigCosignRequest } from '../../utils/buildMultisigCosignRequest'
import { getLocalUnsignedSigners } from '../../utils/getLocalUnsignedSigners'
import { getSignedResponseCount } from '../../utils/signRequestStatus'
import type { SignerStatus } from '../SignerStatusListItem'
import { useLanguage } from '@hooks/useLanguage'
import { ConfirmActionContent } from '@components/ConfirmActionContent'

export type SignerRow = {
    address: string
    status: SignerStatus
}

type StatusBannerVariant = 'waiting' | 'success' | 'failure'

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
        const { addSignRequest } = useSigningRequest()
        const signRequestId = usePendingSignaturesSheetStore(
            state => state.signRequestId,
        )
        const closeSheet = usePendingSignaturesSheetStore(
            state => state.closeSheet,
        )
        const { dismiss } = useBottomSheetResult<void>()
        const { request: requestBottomSheet } = useBottomSheet()

        const { data: signRequest, isLoading } = useSignRequestDetailQuery({
            network,
            deviceId,
            signRequestId: signRequestId ?? '',
            enabled: signRequestId !== null,
            pollWhilePending: true,
        })

        const status = signRequest?.status ?? null

        const bannerVariant: StatusBannerVariant = useMemo(() => {
            if (!status) return 'waiting'
            if (status === 'confirmed') return 'success'
            if (FAILURE_SIGN_REQUEST_STATUSES.has(status)) return 'failure'
            return 'waiting'
        }, [status])

        const signedCount = useMemo(
            () => (signRequest ? getSignedResponseCount(signRequest) : 0),
            [signRequest],
        )

        const threshold = signRequest?.multisigAccount.threshold ?? 0

        const timeRemaining = useMemo(() => {
            if (!signRequest) return null
            if (status && FINALIZED_SIGN_REQUEST_STATUSES.has(status))
                return null
            return formatTimeRemaining(signRequest.expectedExpireDatetime)
        }, [signRequest, status])

        const signers: SignerRow[] = useMemo(() => {
            if (!signRequest) return []
            const isFinalized =
                status !== null && FINALIZED_SIGN_REQUEST_STATUSES.has(status)
            const responses = signRequest.transactionLists[0]?.responses ?? []
            const responseByAddress = new Map(
                responses.map(r => [r.address, r]),
            )
            return signRequest.multisigAccount.participantAddresses.map(
                address => {
                    const response = responseByAddress.get(address)
                    if (response?.response === 'signed') {
                        return { address, status: 'signed' as const }
                    }
                    if (response?.response === 'declined') {
                        return { address, status: 'declined' as const }
                    }
                    const unrespondedStatus: SignerStatus = isFinalized
                        ? 'unsigned'
                        : 'pending'
                    return { address, status: unrespondedStatus }
                },
            )
        }, [signRequest, status])

        const failureBannerKey =
            (status && FAILURE_BANNER_KEY_BY_STATUS[status]) ??
            'multisig.pending_signatures.failed_default'

        const handleClose = useCallback(() => {
            closeSheet()
            dismiss()
        }, [closeSheet, dismiss])

        const localUnsignedSigners = useMemo(() => {
            if (!signRequest) return []
            if (!status || !ACTIONABLE_SIGN_REQUEST_STATUSES.has(status))
                return []
            return getLocalUnsignedSigners(signRequest, accounts)
        }, [signRequest, status, accounts])

        const canSign = localUnsignedSigners.length > 0

        const handleSign = useCallback(() => {
            if (!signRequest) return
            if (localUnsignedSigners.length === 0) return
            for (const signer of localUnsignedSigners) {
                const cosignRequest = buildMultisigCosignRequest({
                    signRequest,
                    signerAddress: signer.address,
                    decodeTransaction,
                })
                addSignRequest(cosignRequest)
            }
            closeSheet()
            dismiss()
        }, [
            signRequest,
            localUnsignedSigners,
            decodeTransaction,
            addSignRequest,
            closeSheet,
            dismiss,
        ])

        const {
            canPerform: canCancel,
            isPending: isCancelling,
            handleConfirm: cancelMutationCall,
        } = useMultisigSignRequestDecline({
            mode: 'cancel',
            signRequest: signRequest ?? null,
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
            signRequest: signRequest ?? null,
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
            canCancel,
            isCancelling,
            handleCancel,
        }
    }
