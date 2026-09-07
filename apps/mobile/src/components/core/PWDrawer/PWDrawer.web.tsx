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

import type { PWDrawerProps } from './types'

/**
 * Passthrough on web. An edge drag isn't a gesture the extension popup can
 * offer, so `routeCapabilities.accountDrawer` is off there and callers keep the
 * bottom sheet; this variant also keeps the reanimated/gesture-handler drag out
 * of the web bundle entirely.
 */
export const PWDrawer = ({ children }: PWDrawerProps) => <>{children}</>
