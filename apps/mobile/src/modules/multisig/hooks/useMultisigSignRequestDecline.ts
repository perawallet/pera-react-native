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

import { useCallback, useMemo, useState } from 'react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useInboxInvalidator } from '@perawallet/wallet-core-messages'
import {
    ACTIONABLE_SIGN_REQUEST_STATUSES,
    useDeclineSignRequestMutation,
    type MultisigSignRequest,
} from '@perawallet/wallet-core-multisig'
import {
    useSigningRequest,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import { useToast } from '@hooks/useToast'

export type UseMultisigSignRequestDeclineParams =
    | {
          mode: 'decline'
          request: SignRequest
          signerAddress: string
      }
    | {
          mode: 'cancel'
          signRequest: MultisigSignRequest | null
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
    title: 'multisig.decline.error.title',
    body: 'multisig.decline.error.body',
} as const

const CANCEL_ERROR_KEYS = {
    title: 'multisig.cancel_transaction.error.title',
    body: 'multisig.cancel_transaction.error.body',
} as const

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
 *   status + local proposer + unsigned proposer.
 */
export const useMultisigSignRequestDecline = (
    params: UseMultisigSignRequestDeclineParams,
): UseMultisigSignRequestDeclineResult => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network) ?? ''
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
        network,
        signRequestId,
    })

    const unsignedProposerAddress = useMemo(() => {
        if (params.mode !== 'cancel') return null
        const signRequest = params.signRequest
        if (!signRequest?.proposerAddress) return null
        const proposer = signRequest.proposerAddress
        const isLocalAccount = accounts.some(a => a.address === proposer)
        if (!isLocalAccount) return null

        const responses = signRequest.transactionLists[0]?.responses ?? []
        const hasResponded = responses.some(r => r.address === proposer)
        if (hasResponded) return null

        return proposer
    }, [params, accounts])

    const targetAddress =
        params.mode === 'decline'
            ? params.signerAddress
            : unsignedProposerAddress

    const canPerform = useMemo(() => {
        if (params.mode === 'decline') return true
        const signRequest = params.signRequest
        if (!signRequest) return false
        if (!ACTIONABLE_SIGN_REQUEST_STATUSES.has(signRequest.status))
            return false
        return unsignedProposerAddress !== null
    }, [params, unsignedProposerAddress])

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
