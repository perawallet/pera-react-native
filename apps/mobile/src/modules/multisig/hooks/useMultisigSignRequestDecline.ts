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

import { useCallback, useMemo, useState } from 'react'
import {
    useAllAccounts,
    findAccountByAddressOn,
} from '@perawallet/wallet-core-accounts'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import { useInboxInvalidator } from '@perawallet/wallet-core-messages'
import {
    ACTIONABLE_SIGN_REQUEST_STATUSES,
    useDeclineSignRequestMutation,
    type MultisigSignRequest,
} from '@perawallet/wallet-core-multisig'
import {
    chainIdOfSignRequest,
    useSigningRequest,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import { i18nKey, type ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useToast } from '@hooks/useToast'
import { getSignedResponseCount } from '../utils/signRequestStatus'

export type UseMultisigSignRequestDeclineParams =
    | {
          mode: 'decline'
          request: SignRequest
          signerAddress: string
      }
    | {
          mode: 'cancel'
          signRequest: Nullable<MultisigSignRequest>
          /** The backend request names no chain, so the sheet showing it passes the one it resolved. */
          chainId: ChainId
      }

export type UseMultisigSignRequestDeclineResult = {
    canPerform: boolean
    isPending: boolean
    isConfirmOpen: boolean
    openConfirm: () => void
    closeConfirm: () => void
    handleConfirm: () => Promise<void>
}

const DECLINE_ERROR_KEYS = {
    title: i18nKey('multisig.decline.error.title'),
    body: i18nKey('multisig.decline.error.body'),
}

const CANCEL_ERROR_KEYS = {
    title: i18nKey('multisig.cancel_transaction.error.title'),
    body: i18nKey('multisig.cancel_transaction.error.body'),
}

/**
 * Decline-mutation orchestration for a multisig sign request, covering two
 * actor-perspectives:
 *
 * - `mode: 'decline'` — a signer refusing to sign a request they were asked
 *   to cosign. Removes the local sign request from the signing store on
 *   success.
 * - `mode: 'cancel'` — the proposer withdrawing their own request. There's
 *   no separate cancel endpoint, so we call the decline mutation against the
 *   proposer's address. Exposes a `canPerform` gate based on actionable
 *   status + local proposer. Mirrors pera-android: a proposer can cancel
 *   regardless of whether they have already signed — the backend treats
 *   their decline as the final word on the request.
 */
export const useMultisigSignRequestDecline = (
    params: UseMultisigSignRequestDeclineParams,
): UseMultisigSignRequestDeclineResult => {
    const scope = useSelectedScope(
        params.mode === 'decline'
            ? chainIdOfSignRequest(params.request)
            : params.chainId,
    )
    const deviceId = useDeploymentDeviceID(deploymentOf(scope)) ?? ''
    const { errorToast } = useToast()
    const { rejectRequest } = useSigningRequest()
    const accounts = useAllAccounts()
    const { invalidate: invalidateInbox } = useInboxInvalidator()

    const [isConfirmOpen, setIsConfirmOpen] = useState(false)

    const signRequestId =
        params.mode === 'decline'
            ? (params.request.signRequestId ?? '')
            : (params.signRequest?.id ?? '')

    const declineMutation = useDeclineSignRequestMutation({
        scope,
        signRequestId,
    })

    // The proposer's address if it belongs to a local account — regardless
    // of whether they have already signed. Mirrors pera-android's
    // `hasProposer` check, which gates the Cancel/Close-for-now button pair
    // on local ownership of the proposer slot only.
    const localProposerAddress = useMemo(() => {
        if (params.mode !== 'cancel') return null
        const signRequest = params.signRequest
        if (!signRequest?.proposerAddress) return null
        const proposer = signRequest.proposerAddress
        const isLocalAccount = !!findAccountByAddressOn(
            accounts,
            scope.chainId,
            proposer,
        )
        if (!isLocalAccount) return null
        return proposer
    }, [params, accounts, scope.chainId])

    const targetAddress =
        params.mode === 'decline' ? params.signerAddress : localProposerAddress

    const canPerform = useMemo(() => {
        if (params.mode === 'decline') return true
        const signRequest = params.signRequest
        if (!signRequest) return false
        if (!ACTIONABLE_SIGN_REQUEST_STATUSES.has(signRequest.status))
            return false
        if (localProposerAddress === null) return false
        // Mirror pera-android: once the threshold is met the backend will
        // submit on its own, so the proposer can no longer cancel — only
        // Close remains. Until then (status still `pending` and the
        // request is short of the threshold) the proposer can cancel
        // regardless of whether they themselves have already signed.
        const signedCount = getSignedResponseCount(signRequest)
        return signedCount < signRequest.multisigAccount.threshold
    }, [params, localProposerAddress])

    const errorKeys =
        params.mode === 'decline' ? DECLINE_ERROR_KEYS : CANCEL_ERROR_KEYS

    const openConfirm = useCallback(() => setIsConfirmOpen(true), [])
    const closeConfirm = useCallback(() => setIsConfirmOpen(false), [])

    const handleConfirm = useCallback(async () => {
        if (!signRequestId || !targetAddress || !deviceId) {
            errorToast(errorKeys.title, errorKeys.body)
            return
        }
        try {
            await declineMutation.mutateAsync({
                address: targetAddress,
                deviceId,
            })
            invalidateInbox()
            setIsConfirmOpen(false)
            if (params.mode === 'decline') {
                // Route through the state machine so the actor reaches `rejected`,
                // fires the request's reject callback, and the lifecycle does the
                // cleanup. Bypassing with removeSignRequest stopped the actor
                // without delivering USER_REJECTED.
                rejectRequest(params.request)
            }
        } catch {
            errorToast(errorKeys.title, errorKeys.body)
        }
    }, [
        signRequestId,
        targetAddress,
        deviceId,
        declineMutation,
        invalidateInbox,
        params,
        rejectRequest,
        errorToast,
        errorKeys,
    ])

    return {
        canPerform,
        isPending: declineMutation.isPending,
        isConfirmOpen,
        openConfirm,
        closeConfirm,
        handleConfirm,
    }
}
