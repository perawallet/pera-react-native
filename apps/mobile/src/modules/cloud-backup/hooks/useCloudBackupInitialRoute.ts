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

import { useCloudBackupStore } from '@perawallet/wallet-core-backup'
import { useCloudBackupIntroduction } from './useCloudBackupIntroduction'
import type { CloudBackupStackParamList } from '../routes/types'

// Via `Extract` rather than spelled out: renaming a route drops it from the
// union here, so the `return` below stops compiling instead of shipping a
// route name the navigator no longer knows.
export type UseCloudBackupInitialRouteResult = Extract<
    keyof CloudBackupStackParamList,
    'CloudBackupIntro' | 'CloudBackupHome' | 'CloudBackupOverview'
>

/**
 * Consumed only as the navigator's `initialRouteName`, which React Navigation
 * reads once per mount — so a later change here never redirects an open flow.
 */
export const useCloudBackupInitialRoute =
    (): UseCloudBackupInitialRouteResult => {
        const isConfigured = useCloudBackupStore(state => state.isConfigured())
        const { isIntroductionSeen } = useCloudBackupIntroduction()

        if (isConfigured) {
            return 'CloudBackupOverview'
        }

        return isIntroductionSeen ? 'CloudBackupHome' : 'CloudBackupIntro'
    }
