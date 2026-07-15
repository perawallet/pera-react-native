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

import { useEffect, useState } from 'react'
import type { MigrationPlanSummary } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'

type UseMigrationPlansResult = {
    plans: MigrationPlanSummary[]
    isLoading: boolean
    error: Error | null
}

export const useMigrationPlans = (): UseMigrationPlansResult => {
    const [plans, setPlans] = useState<MigrationPlanSummary[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        let cancelled = false
        getProvider()
            .migration.getMigrationPlans()
            .then(result => {
                if (cancelled) return
                setPlans(result)
                setIsLoading(false)
            })
            .catch(err => {
                if (cancelled) return
                setError(err instanceof Error ? err : new Error(String(err)))
                setIsLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    return { plans, isLoading, error }
}
