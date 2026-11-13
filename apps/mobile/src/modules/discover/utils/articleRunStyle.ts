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

import type { Optional } from '@perawallet/wallet-core-shared'
import type { FontWeight, TypographyVariant } from '@theme/typography'
import type { ArticleText } from './articleHtml'

export type ArticleRunStyle =
    | { plain: true }
    | {
          plain: false
          variant: TypographyVariant
          weight: Optional<FontWeight>
          italic: boolean
          link: boolean
      }

// 700, not 600: on iOS the bundled SemiBold file registers as DMSans18pt-SemiBold,
// so the app's 600 face name does not resolve there and the run would draw regular.
const BOLD: FontWeight = 700

/**
 * How a text run renders inside its block (`base`) or link. React Native lets
 * a nested Text's style win, and every PWText variant sets size, family and
 * colour, so an unmarked run stays a bare string that inherits; a marked run
 * keeps the block's variant and changes only what its mark changes.
 */
export const articleRunStyle = (
    run: ArticleText,
    base: TypographyVariant,
    inLink: boolean,
): ArticleRunStyle => {
    if (!run.bold && !run.italic && !run.code) return { plain: true }
    return {
        plain: false,
        variant: run.code ? 'mono' : base,
        weight: run.bold ? BOLD : undefined,
        italic: run.italic,
        link: inLink,
    }
}
