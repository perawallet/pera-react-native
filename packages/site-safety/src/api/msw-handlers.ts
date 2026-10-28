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

import { http, HttpResponse, type HttpHandler, type JsonBodyType } from 'msw'
import type { PhishingListSourceId } from '../models'
import { PHISHING_LIST_SOURCES } from '../sources'

export type MockPhishingListResponse =
    | { body: JsonBodyType; etag?: string }
    | { status: number }
    | { malformed: true }

/** One handler per source given; a source left out gets no handler. */
export const mockPhishingListSources = (
    responses: Partial<Record<PhishingListSourceId, MockPhishingListResponse>>,
): HttpHandler[] =>
    PHISHING_LIST_SOURCES.flatMap(source => {
        const response = responses[source.id]
        if (!response) return []
        return [
            http.get(source.url, () => {
                if ('status' in response) {
                    return new HttpResponse(null, { status: response.status })
                }
                if ('malformed' in response) {
                    return new HttpResponse('{"deny": [', {
                        headers: { 'Content-Type': 'application/json' },
                    })
                }
                return HttpResponse.json(response.body, {
                    headers: response.etag ? { ETag: response.etag } : {},
                })
            }),
        ]
    })
