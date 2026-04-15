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

import { useCallback, useEffect } from 'react'
import { useTooltipSeen } from '@perawallet/wallet-core-settings'
import { useModalState } from '@hooks/useModalState'
import { useLanguage } from '@hooks/useLanguage'
import { PWIconVariant } from '@components/core/PWIcon'
import type { PWTooltipVariant } from './PWTooltip'

export type UsePWTooltipParams = {
    id?: string
    variant: PWTooltipVariant
    iconVariant?: PWIconVariant
    confirmLabel?: string
    autoOpenFirstRun: boolean
}

export type UsePWTooltipResult = {
    isOpen: boolean
    openTooltip: () => void
    handleClose: () => void
    resolvedIconVariant: PWIconVariant
    resolvedConfirmLabel: string
}

export const usePWTooltip = ({
    id,
    variant,
    iconVariant,
    confirmLabel,
    autoOpenFirstRun,
}: UsePWTooltipParams): UsePWTooltipResult => {
    const { isOpen, open, close } = useModalState()
    const { hasSeen, markSeen } = useTooltipSeen()
    const { t } = useLanguage()

    const resolvedIconVariant: PWIconVariant = iconVariant ?? variant
    const resolvedConfirmLabel = confirmLabel ?? t('common.close.label')

    const handleClose = useCallback(() => {
        close()
        if (id) {
            markSeen(id)
        }
    }, [close, id, markSeen])

    useEffect(() => {
        if (autoOpenFirstRun && id && !hasSeen(id)) {
            open()
        }
        // Intentionally only run once on mount: first-run gating should not
        // retrigger when dependent state updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        isOpen,
        openTooltip: open,
        handleClose,
        resolvedIconVariant,
        resolvedConfirmLabel,
    }
}
