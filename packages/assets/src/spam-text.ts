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

const LINK =
    /https?:\/\/|www\.|t\.me\/|t\.ly\/|\b[a-z0-9-]{2,}\.(com|net|org|io|xyz|live|app|top|site|online|club|vip|pro|fun|info|cc|gift|link|claims?)\b/i
const LURE_EMOJI = /[✅⭐🎁💰🔥]/u
// Only verbs that ask the holder to act: "reward" or "distribution" alone
// also name real tokens.
const CALL_TO_ACT = /\b(claim|redeem|visit|airdrop)\b/i

/** Whether an asset's name or symbol advertises a scam: a link, a lure emoji, or a call to claim. */
export const isSpamAssetText = (text: string): boolean =>
    LINK.test(text) || LURE_EMOJI.test(text) || CALL_TO_ACT.test(text)
