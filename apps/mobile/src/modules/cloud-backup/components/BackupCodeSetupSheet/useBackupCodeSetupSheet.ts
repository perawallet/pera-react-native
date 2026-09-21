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

import { useCallback, useState } from 'react'

import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'

type UseBackupCodeSetupSheetResult = {
    title: string
    description: string
    hasError: boolean
    handleCodeComplete: (code: string) => void
    handleErrorAnimationComplete: () => void
}

export const useBackupCodeSetupSheet = (): UseBackupCodeSetupSheetResult => {
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<string>()
    const [isConfirming, setIsConfirming] = useState(false)
    const [chosenCode, setChosenCode] = useState('')
    const [hasError, setHasError] = useState(false)

    const handleCodeComplete = useCallback(
        (code: string) => {
            if (!isConfirming) {
                setChosenCode(code)
                setIsConfirming(true)
                return
            }

            if (code === chosenCode) {
                resolve(code)
                return
            }

            setHasError(true)
        },
        [isConfirming, chosenCode, resolve],
    )

    // Back to choosing, not to re-confirming: the typo may have been in the
    // first code, which no amount of re-entering the second one can fix.
    const handleErrorAnimationComplete = useCallback(() => {
        setHasError(false)
        setChosenCode('')
        setIsConfirming(false)
    }, [])

    return {
        title: t(
            isConfirming
                ? 'cloud_backup.encryption_code.confirm_title'
                : 'cloud_backup.encryption_code.setup_title',
        ),
        description: t(
            isConfirming
                ? 'cloud_backup.encryption_code.confirm_description'
                : 'cloud_backup.encryption_code.setup_description',
        ),
        hasError,
        handleCodeComplete,
        handleErrorAnimationComplete,
    }
}
