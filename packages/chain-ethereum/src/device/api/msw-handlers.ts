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

import { http, HttpResponse, type JsonBodyType, type RequestHandler } from 'msw'
import { followedTokensPath } from './endpoints'

export type FollowedTokensHandlerOptions = {
    status?: number
    body?: JsonBodyType
    onRequest?: (deviceId: string, body: unknown) => void
}

/** The backend's followed-tokens route; answers 200 with the set it was sent unless told otherwise. */
export const followedTokensHandler = ({
    status = 200,
    body,
    onRequest,
}: FollowedTokensHandlerOptions = {}): RequestHandler =>
    http.put(
        `*${followedTokensPath(':deviceId')}`,
        async ({ request, params }) => {
            const sent = (await request.json()) as JsonBodyType
            onRequest?.(String(params.deviceId), sent)
            return HttpResponse.json(body ?? sent, { status })
        },
    )
