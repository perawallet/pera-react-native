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

import { useMemo } from 'react'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import type { ReviewWarningItem } from '@modules/signing'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import {
    useEthereumSimulationSection,
    type EthereumSimulationSectionState,
} from '../EthereumSimulationSection'
import { ethereumReviewWarningsOf } from './ethereumReviewWarnings'
import { ethereumReviewWarningItemOf } from './ethereumReviewWarningItemOf'

type UseEthereumTransactionReviewParams = {
    presentation: EthereumTransactionPresentation
    source?: SignRequestSource
    verifiedOrigin?: string
}

export type UseEthereumTransactionReviewResult = {
    simulation: EthereumSimulationSectionState
    warningItems: ReviewWarningItem[]
}

export const useEthereumTransactionReview = ({
    presentation,
    source,
    verifiedOrigin,
}: UseEthereumTransactionReviewParams): UseEthereumTransactionReviewResult => {
    const { t } = useLanguage()
    const simulation = useEthereumSimulationSection(presentation)
    const { scope } = presentation

    const warningItems = useMemo(() => {
        return ethereumReviewWarningsOf({
            presentation,
            simulation,
            source,
            verifiedOrigin,
        }).map(warning => ethereumReviewWarningItemOf(warning, scope, t))
    }, [presentation, simulation, source, verifiedOrigin, scope, t])

    return { simulation, warningItems }
}
