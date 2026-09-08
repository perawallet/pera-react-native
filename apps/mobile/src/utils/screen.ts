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

import { LARGE_SCREEN_MIN_WIDTH_DP } from '@constants/ui'

// The shorter side, so a phone held in landscape does not qualify.
export const isLargeScreen = (width: number, height: number): boolean =>
    Math.min(width, height) >= LARGE_SCREEN_MIN_WIDTH_DP
