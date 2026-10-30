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

import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import {
    deviceIdForDeployment,
    useDeviceStore,
} from '@perawallet/wallet-core-device'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { DeviceId } from '../models'
import { useCloudBackupStore } from './store'

/** The id the backup was configured with, falling back to the current
 *  deployment's device id for state persisted before that id was pinned. The
 *  device store is keyed per deployment while the backup service is a single
 *  global endpoint, so reading it directly makes a deployment switch change
 *  what we send. */
export const resolveBackupDeviceId = (
    deployment: WalletMode,
): Nullable<DeviceId> =>
    useCloudBackupStore.getState().deviceId ??
    deviceIdForDeployment(useDeviceStore.getState(), deployment)
