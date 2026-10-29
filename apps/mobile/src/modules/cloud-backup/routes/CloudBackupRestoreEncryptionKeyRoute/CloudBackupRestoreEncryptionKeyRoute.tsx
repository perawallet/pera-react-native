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

import { CloudBackupRestoreEncryptionKeyScreen } from '../../screens/CloudBackupRestoreEncryptionKeyScreen'
import { useCloudBackupRestoreExit } from '../../hooks/useCloudBackupRestoreExit'

// The restore screens are shared with the import flow, which has no
// `CloudBackupOverview` to land on, so each stack names its own exit.
export const CloudBackupRestoreEncryptionKeyRoute = () => {
    const { exitToOverview } = useCloudBackupRestoreExit()
    return <CloudBackupRestoreEncryptionKeyScreen onDone={exitToOverview} />
}
