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

import { useEffect } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import { createCrashReportingErrorReporter } from '@perawallet/wallet-extension-platform'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'

/** Routes logger errors to the platform's crash reporter while mounted. */
export const useCrashReporterBinding = (): void => {
    const provider = usePeraProvider()

    useEffect(() => {
        logger.setErrorReporter(
            createCrashReportingErrorReporter(provider.crashReporting),
        )

        return () => {
            logger.setErrorReporter(undefined)
        }
    }, [provider])
}
