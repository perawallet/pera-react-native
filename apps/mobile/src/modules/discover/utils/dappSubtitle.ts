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

import type { DiscoverDapp } from '../types'
import { dappHostOf } from './normalizeDappUrl'

/** A dApp row's second line: its first category, or its domain when it has none. */
export const dappSubtitle = (dapp: DiscoverDapp): string =>
    dapp.categories[0] ?? dappHostOf(dapp.url)
