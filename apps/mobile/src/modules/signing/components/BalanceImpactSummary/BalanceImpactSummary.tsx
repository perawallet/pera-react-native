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

import { PWView } from '@components/core'
import { PreviewUnavailableCard } from '../PreviewUnavailableCard'
import { WalletChangesCard } from '../WalletChangesCard'
import { useBalanceImpactSummary } from './useBalanceImpactSummary'

/** The request's expected balance impact across all its transactions. */
export const BalanceImpactSummary = () => {
    const { receive, spend, hasImpact, isSimulating, simulationFailed } =
        useBalanceImpactSummary()

    // Simulation resolves the inner txns that carry the receive side. If it
    // failed, the impact is incomplete (spend may show, receive is unknown) —
    // say so rather than show a partial impact that reads complete.
    if (simulationFailed) {
        return (
            <PWView testID='balance-impact-summary'>
                <PreviewUnavailableCard />
            </PWView>
        )
    }

    if (!hasImpact && !isSimulating) return null

    return (
        <PWView testID='balance-impact-summary'>
            <WalletChangesCard
                spend={spend}
                receive={receive}
                isLoading={!hasImpact}
            />
        </PWView>
    )
}
