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

export const CardStatus = {
    Active: 'ACTIVE',
    Frozen: 'FROZEN',
    Blocked: 'BLOCKED',
} as const
export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus]

export const CardType = {
    Virtual: 'VIRTUAL',
    Physical: 'PHYSICAL',
    Metal: 'METAL',
} as const
export type CardType = (typeof CardType)[keyof typeof CardType]

/** Non-sensitive card summary from GET /v1/card/status. */
export type Card = {
    id: string
    holderName: string
    /** Display value, e.g. "2027/05". Non-sensitive. */
    expiryDate: string
    /** Last 4 PAN digits — the only PAN data safe to retain. */
    panLast4: string
    status: CardStatus
    type: CardType
    /** ISO 8601 timestamp. */
    orderedAt: string
}

/**
 * SENSITIVE secure-view handle from `POST /v1/card/{details,pin}/token`. Baanx
 * returns a single-use token + an `imageUrl` rendering the PAN/CVV (or PIN) as
 * an image — raw values are never exposed via the API. Held only transiently
 * by the rendering screen; never persisted or cached.
 */
export type CardSecureView = {
    token: string
    imageUrl: string
}

/**
 * SENSITIVE set-PIN handle from `POST /v1/card/set-pin/token`. Returns a
 * single-use token + a `hostedPageUrl` the user opens to set their PIN. Never
 * persisted or cached.
 */
export type CardSetPinSession = {
    token: string
    hostedPageUrl: string
}
