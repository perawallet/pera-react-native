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

import { isDev, isStaging } from '@perawallet/wallet-core-config'

// Both variants target the staging backend, whose v4 ASA item carries every
// field sync stores; production stays on the Django bulk read until it does.
// A named allow-list, so a new variant never inherits the v4 read.
export const isV4AssetSyncEnabled = (): boolean => isDev || isStaging
