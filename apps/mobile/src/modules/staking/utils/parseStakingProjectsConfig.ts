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

import type { StakingProjectInfo, StakingType } from '../models'

const STAKING_TYPES: StakingType[] = ['liquid', 'pools', 'delegated']

const hasValidStakingType = (value: unknown): value is StakingType => {
    return (
        typeof value === 'string' &&
        STAKING_TYPES.includes(value as StakingType)
    )
}

const hasValidString = (value: unknown): value is string => {
    return typeof value === 'string' && value.trim().length > 0
}

const mapStakingProject = (
    rawProject: unknown,
    index: number,
): StakingProjectInfo => {
    if (!rawProject || typeof rawProject !== 'object') {
        throw new Error(
            `Invalid staking project at index ${index}: expected object`,
        )
    }

    const project = rawProject as Record<string, unknown>
    const { id, title, description, logoUrl, link, type } = project

    if (!hasValidString(id)) {
        throw new Error(`Invalid staking project id at index ${index}`)
    }

    if (!hasValidStakingType(type)) {
        throw new Error(`Invalid staking project type at index ${index}`)
    }

    if (!hasValidString(title)) {
        throw new Error(`Invalid staking project title at index ${index}`)
    }

    if (!hasValidString(description)) {
        throw new Error(`Invalid staking project description at index ${index}`)
    }

    if (!hasValidString(logoUrl)) {
        throw new Error(`Invalid staking project logoUrl at index ${index}`)
    }

    if (!hasValidString(link)) {
        throw new Error(`Invalid staking project link at index ${index}`)
    }

    return {
        id,
        title,
        description,
        logoUrl,
        link,
        type,
    }
}

export const parseStakingProjectsConfig = (
    raw: string,
): StakingProjectInfo[] => {
    // Expected source: Firebase Remote Config key `staking_projects`.
    // Expected value: JSON array of StakingProjectInfo objects.
    if (!raw || !raw.trim()) {
        throw new Error('Missing staking projects remote config value')
    }

    let parsedValue: unknown

    try {
        parsedValue = JSON.parse(raw)
    } catch {
        throw new Error('Invalid staking projects remote config JSON')
    }

    if (!Array.isArray(parsedValue)) {
        throw new Error(
            'Invalid staking projects remote config: expected array',
        )
    }

    const projects = parsedValue.map(mapStakingProject)
    const duplicateIDs = projects.filter(
        (project, index) =>
            projects.findIndex(other => other.id === project.id) !== index,
    )

    if (duplicateIDs.length > 0) {
        throw new Error(`Duplicate staking project id: ${duplicateIDs[0].id}`)
    }

    return projects
}
