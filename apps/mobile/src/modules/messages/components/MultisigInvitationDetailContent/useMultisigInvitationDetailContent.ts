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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useDeleteMultisigInvitationMutation } from '@perawallet/wallet-core-messages'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { trackEvent, MultisigEvent } from '@analytics'
import type { MultisigInvitationParam } from '../../routes/types'

type UseMultisigInvitationDetailContentParams = {
    invitation: MultisigInvitationParam
    onIgnored: () => void
    onAccepted: () => void
}

export type UseMultisigInvitationDetailContentResult = {
    renderedInvitation: MultisigInvitationParam | null
    totalParticipants: number
    isIgnoring: boolean
    isUserIncluded: boolean
    handleIgnore: () => Promise<void>
    handleAccept: () => void
}

export const useMultisigInvitationDetailContent = ({
    invitation,
    onIgnored,
    onAccepted,
}: UseMultisigInvitationDetailContentParams): UseMultisigInvitationDetailContentResult => {
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

    const renderedInvitation = invitation

    const totalParticipants = renderedInvitation.participantAddresses.length

    const isUserIncluded = useMemo(() => {
        const participantSet = new Set(renderedInvitation.participantAddresses)
        return accounts.some(a => participantSet.has(a.address))
    }, [accounts, renderedInvitation])

    const handleAccept = useCallback(() => {
        trackEvent(MultisigEvent.InviteAddPressed)
        onAccepted()
    }, [onAccepted])

    const handleIgnore = useCallback(async () => {
        if (isIgnoring) return
        trackEvent(MultisigEvent.InviteIgnorePressed)
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
            onIgnored()
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
        onIgnored,
        errorToast,
        t,
    ])

    return {
        renderedInvitation,
        totalParticipants,
        isIgnoring,
        isUserIncluded,
        handleIgnore,
        handleAccept,
    }
}
