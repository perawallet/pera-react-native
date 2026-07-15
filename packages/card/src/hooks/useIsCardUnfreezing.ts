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

import { useIsMutating } from '@tanstack/react-query'
import { cardMutationKeys } from './querykeys'

/**
 * True while ANY unfreeze request is in flight, across all callers. The card is
 * unfreezable from two places at once (the Card Frozen banner and the Card
 * Details options row), each with its own mutation instance; this shared flag
 * lets both guard against — and reflect — a single in-flight unfreeze so they
 * can't double-fire.
 */
export const useIsCardUnfreezing = (): boolean =>
    useIsMutating({ mutationKey: cardMutationKeys.unfreeze }) > 0
