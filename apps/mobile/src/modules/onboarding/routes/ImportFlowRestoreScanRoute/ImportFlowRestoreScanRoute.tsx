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

import type React from 'react'

import { CloudBackupRestoreScanScreen } from '@modules/cloud-backup/routes'
import { useExitAccountFlow } from '@modules/onboarding/hooks'

// The restore screens are shared with the cloud-backup stack, whose
// `CloudBackupOverview` exit does not exist here; a restore reached from the
// import flow ends like every other import.
export const ImportFlowRestoreScanRoute = () => {
    const { exitAccountFlow } = useExitAccountFlow()
    return <CloudBackupRestoreScanScreen onDone={exitAccountFlow} />
}
