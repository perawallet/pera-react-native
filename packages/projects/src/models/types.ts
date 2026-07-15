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

export type VerificationTier = 'verified' | 'unverified' | 'suspicious'

export type ProjectCategory = {
    id: string
    title?: string
    order?: number
}

export type PeraProject = {
    name?: string
    url?: string
    description?: string
    shortDescription?: string
    logoPng?: string
    verificationTier?: VerificationTier
    color?: string
    textColor?: string
    backgroundImage?: string
    categories?: ProjectCategory[]
    popularityScore?: number
}

export type PeraApplication = {
    /** uint64 app id as a decimal string — must not live in a JS number. */
    applicationId?: string
    name?: string
    project: PeraProject
}
