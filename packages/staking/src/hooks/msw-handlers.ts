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

// Thin MSW handler factories for the staking REST surface. Co-located with
// `endpoints.ts`. Reachable only via the test alias, never from the prod entry.

import { http, HttpResponse, type HttpHandler } from 'msw'
import type { StakingProjectsApiResponse } from '../models'

export type MockStakingProjectsParams = {
    response: StakingProjectsApiResponse
    status?: number
}

export const mockStakingProjects = ({
    response,
    status = 200,
}: MockStakingProjectsParams): HttpHandler =>
    http.get('*/v1/staking/projects-information/', () =>
        HttpResponse.json(response, { status }),
    )
