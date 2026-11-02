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

import { createContext } from 'react'

/**
 * The colour text takes when its style names none. `secondary` is textGray,
 * as in a detail card's value column; an explicit style colour still wins.
 */
export type PWTextTone = 'default' | 'secondary'

export const PWTextToneContext = createContext<PWTextTone>('default')
