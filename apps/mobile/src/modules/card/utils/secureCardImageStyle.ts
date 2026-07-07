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

import type { CardImageCustomCss } from '@perawallet/wallet-core-card'

/**
 * Brand colors for the Baanx-rendered secure card image, sampled from
 * `assets/images/pera-card.png` so the server render matches the card art.
 * These are API request-body params (hex), NOT RN theme tokens — shared by
 * every screen that reveals a secure card image (Card Details, and the
 * upcoming PIN view) so the rendered images stay visually consistent.
 */
export const SECURE_CARD_IMAGE_CSS: CardImageCustomCss = {
    cardBackgroundColor: '#FCCA44',
    cardTextColor: '#000000',
    panBackgroundColor: '#FFE858',
    panTextColor: '#000000',
}
