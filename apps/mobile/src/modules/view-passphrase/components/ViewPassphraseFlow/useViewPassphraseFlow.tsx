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

import { useCallback, useEffect, useState } from 'react'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    PassphraseAcknowledgeContent,
    type PassphraseAcknowledgeContentResult,
} from '../PassphraseAcknowledgeContent'
import { ViewPassphraseContent } from '../ViewPassphraseContent'

export type ViewPassphraseFlowStep = 'pin' | 'acknowledge' | 'display' | null

export type UseViewPassphraseFlowParams = {
    isVisible: boolean
    address: string
    onClose: () => void
}

export type UseViewPassphraseFlowResult = {
    step: ViewPassphraseFlowStep
    handlePinSuccess: () => void
}

export const useViewPassphraseFlow = ({
    isVisible,
    address,
    onClose,
}: UseViewPassphraseFlowParams): UseViewPassphraseFlowResult => {
    const { checkPinEnabled } = usePinCode()
    const { request: requestBottomSheet } = useBottomSheet()
    const [step, setStep] = useState<ViewPassphraseFlowStep>(null)

    useEffect(() => {
        if (!isVisible) {
            setStep(null)
            return
        }
        let cancelled = false
        ;(async () => {
            const pinEnabled = await checkPinEnabled()
            if (cancelled) return
            setStep(pinEnabled ? 'pin' : 'acknowledge')
        })()
        return () => {
            cancelled = true
        }
    }, [isVisible, checkPinEnabled])

    const handlePinSuccess = useCallback(() => {
        setStep('acknowledge')
    }, [])

    useEffect(() => {
        if (step !== 'acknowledge') return
        let cancelled = false
        requestBottomSheet<PassphraseAcknowledgeContentResult>({
            contents: <PassphraseAcknowledgeContent />,
            options: { size: 'auto', enablePanDownToClose: true },
        }).then(result => {
            if (cancelled) return
            if (result === 'confirm') {
                setStep('display')
            } else {
                onClose()
            }
        })
        return () => {
            cancelled = true
        }
    }, [step, requestBottomSheet, onClose])

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

    return {
        step,
        handlePinSuccess,
    }
}
