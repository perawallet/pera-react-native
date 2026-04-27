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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useDeleteMultisigInvitationMutation } from '@perawallet/wallet-core-messages'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { MultisigInvitationParam } from '../../routes/types'

type UseMultisigInvitationDetailBottomSheetParams = {
    invitation: MultisigInvitationParam | null
    onClose: () => void
}

export type UseMultisigInvitationDetailBottomSheetResult = {
    renderedInvitation: MultisigInvitationParam | null
    totalParticipants: number
    isIgnoring: boolean
    isUserIncluded: boolean
    handleIgnore: () => Promise<void>
    handleAccept: () => void
}

export const useMultisigInvitationDetailBottomSheet = ({
    invitation,
    onClose,
}: UseMultisigInvitationDetailBottomSheetParams): UseMultisigInvitationDetailBottomSheetResult => {
    const { push } = useAppNavigation()
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const { network } = useNetwork()
    const deviceId = useDeviceID(network) ?? ''
    const accounts = useAllAccounts()
    const deleteImportInboxMutation = useDeleteMultisigInvitationMutation({
        network,
        deviceId,
    })

    const [isIgnoring, setIsIgnoring] = useState(false)
    const [renderedInvitation, setRenderedInvitation] =
        useState<MultisigInvitationParam | null>(invitation)

    useEffect(() => {
        if (invitation) {
            setRenderedInvitation(invitation)
        }
    }, [invitation])

    const totalParticipants =
        renderedInvitation?.participantAddresses.length ?? 0

    const isUserIncluded = useMemo(() => {
        if (!renderedInvitation) return false
        const participantSet = new Set(renderedInvitation.participantAddresses)
        return accounts.some(a => participantSet.has(a.address))
    }, [accounts, renderedInvitation])

    const handleIgnore = useCallback(async () => {
        if (isIgnoring || !renderedInvitation) return
        if (!deviceId) {
            errorToast(
                t('multisig.invitation.title'),
                t('multisig.invitation.ignore_error'),
            )
            return
        }

        try {
            setIsIgnoring(true)
            await deleteImportInboxMutation.mutateAsync({
                multisigAddress: renderedInvitation.address,
            })
            onClose()
        } catch {
            errorToast(
                t('multisig.invitation.title'),
                t('multisig.invitation.ignore_error'),
            )
        } finally {
            setIsIgnoring(false)
        }
    }, [
        isIgnoring,
        renderedInvitation,
        deviceId,
        deleteImportInboxMutation,
        onClose,
        errorToast,
        t,
    ])

    const handleAccept = useCallback(() => {
        if (!renderedInvitation) return
        onClose()
        push('Messages', {
            screen: 'MultisigInvitationName',
            params: { invitation: renderedInvitation },
        })
    }, [push, renderedInvitation, onClose])

    return {
        renderedInvitation,
        totalParticipants,
        isIgnoring,
        isUserIncluded,
        handleIgnore,
        handleAccept,
    }
}
