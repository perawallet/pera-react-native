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

import { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'

/**
 * The ARC-0027 capabilities the wallet grants a connected Liquid Auth dApp.
 * The Liquid Auth protocol doesn't negotiate per-connection permissions the
 * way WalletConnect does, so the approval/details UIs display the full
 * capability set (account access + transaction + data signing) — matching the
 * WalletConnect permission list. Reuses the WalletConnect AlgorandPermission
 * values + PermissionItem so the two surfaces render identically.
 */
export const LIQUID_AUTH_PERMISSIONS: AlgorandPermission[] = [
    AlgorandPermission.ACCOUNT_PERMISSION,
    AlgorandPermission.TX_PERMISSION,
    AlgorandPermission.DATA_PERMISSION,
]
