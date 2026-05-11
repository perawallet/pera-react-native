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

import { useEffect } from 'react'
import { PinEditView } from '@modules/security/components/PinEditView'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    PassphraseAcknowledgeContent,
    type PassphraseAcknowledgeContentResult,
} from '../PassphraseAcknowledgeContent'
import { ViewPassphraseContent } from '../ViewPassphraseContent'
import { useViewPassphraseFlow } from './useViewPassphraseFlow'

export type ViewPassphraseFlowProps = {
    isVisible: boolean
    address: string
    onClose: () => void
}

export const ViewPassphraseFlow = ({
    isVisible,
    address,
    onClose,
}: ViewPassphraseFlowProps) => {
    const { step, handlePinSuccess, advanceToDisplay } = useViewPassphraseFlow({
        isVisible,
        onClose,
    })
    const { request: requestBottomSheet } = useBottomSheet()

    useEffect(() => {
        if (step !== 'acknowledge') return
        let cancelled = false
        requestBottomSheet<PassphraseAcknowledgeContentResult>({
            contents: <PassphraseAcknowledgeContent />,
            options: { size: 'auto', enablePanDownToClose: true },
        }).then(result => {
            if (cancelled) return
            if (result === 'confirm') {
                advanceToDisplay()
            } else {
                onClose()
            }
        })
        return () => {
            cancelled = true
        }
    }, [step, requestBottomSheet, advanceToDisplay, onClose])

    useEffect(() => {
        if (step !== 'display') return
        let cancelled = false
        requestBottomSheet<void>({
            contents: <ViewPassphraseContent address={address} />,
            options: { size: 'lg', enablePanDownToClose: true },
        }).finally(() => {
            if (!cancelled) onClose()
        })
        return () => {
            cancelled = true
        }
    }, [step, requestBottomSheet, address, onClose])

    return (
        <PinEditView
            mode={step === 'pin' ? 'verify' : null}
            onSuccess={handlePinSuccess}
            onClose={onClose}
        />
    )
}
