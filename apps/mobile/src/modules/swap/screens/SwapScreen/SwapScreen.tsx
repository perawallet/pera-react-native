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

import { useCallback } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { EmptyView } from '@components/EmptyView'
import { useSwapIntroduction } from '@modules/swap/hooks'
import { SwapIntroduction } from '@modules/swap/components'

export const SwapScreen = () => {
    const { t } = useLanguage()
    const { isIntroductionSeen, markIntroductionSeen } = useSwapIntroduction()
    const introModal = useModalState(!isIntroductionSeen)

    const handleStartSwapping = useCallback(() => {
        markIntroductionSeen()
        introModal.close()
    }, [markIntroductionSeen, introModal])

    return (
        <>
            <EmptyView
                title={t('common.not_implemented.title')}
                body={t('common.not_implemented.body')}
            />

            <SwapIntroduction
                isVisible={introModal.isOpen}
                onStartSwapping={handleStartSwapping}
                onClose={introModal.close}
            />
        </>
    )
}
