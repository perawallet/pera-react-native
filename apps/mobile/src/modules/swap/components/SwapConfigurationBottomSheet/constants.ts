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

export const MIN_BALANCE_PERCENT = 1
export const MAX_BALANCE_PERCENT = 100
export const MIN_SLIPPAGE = 0.01
export const MAX_SLIPPAGE = 10

export const BALANCE_PRESETS = [25, 50, 75, 100] as const
export const SLIPPAGE_PRESETS = [0.5, 1, 2, 5] as const

export const CUSTOM_SLIPPAGE_KEY = 'custom'
