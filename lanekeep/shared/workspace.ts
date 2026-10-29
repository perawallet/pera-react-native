/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Rules run inside lanekeep's own runtime, so these read through the rule
// context and never import node:fs or node:path.

export interface FileReader {
    readFile(path: string): string | undefined
}

export type WorkspaceRoot = 'apps' | 'packages' | 'extensions'

export interface WorkspaceMember {
    /** Repo-relative, with no trailing slash. */
    dir: string
    root: WorkspaceRoot
}

// Lazy prefix, so a scratch fixture's own `packages/<name>` resolves too.
const MEMBER = /^((?:.*?\/)?(apps|packages|extensions)\/[^/]+)\//

export const workspaceMemberOf = (
    path: string,
): WorkspaceMember | undefined => {
    const match = MEMBER.exec(path)
    const dir = match?.[1]
    const root = match?.[2]
    if (dir === undefined || root === undefined) return undefined
    return { dir, root: root as WorkspaceRoot }
}

/** The `name` in `<dir>/package.json`, or undefined if absent, unparseable or not a string. */
export const manifestNameOf = (
    reader: FileReader,
    dir: string,
): string | undefined => {
    const raw = reader.readFile(`${dir}/package.json`)
    if (raw === undefined) return undefined
    try {
        const name = (JSON.parse(raw) as { name?: unknown }).name
        return typeof name === 'string' ? name : undefined
    } catch {
        return undefined
    }
}
