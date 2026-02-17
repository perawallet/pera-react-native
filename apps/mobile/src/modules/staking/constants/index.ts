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

import type { StakingType } from '../models'

export const STAKING_TYPE_LABELS: Record<StakingType, string> = {
    liquid: 'Liquid Staking',
    pools: 'Staking Pools',
    delegated: 'Delegated Staking',
}

export const STAKING_TYPE_COLORS: Record<StakingType, string> = {
    liquid: 'rgba(255,110,92,1)',
    pools: 'rgba(31,142,157,1)',
    delegated: 'rgba(255,174,227,1)',
}


export const STAKING_DISCLAIMER_STORAGE_KEY = 'pera.staking.disclaimerAccepted'

export const STAKING_TERMS_URL = 'https://perawallet.app/terms-and-services/'
export const STAKING_DEFI_URL = 'https://algorand.co/ecosystem/defi'
