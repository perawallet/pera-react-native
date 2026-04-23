export const IN_PROCESS_THRESHOLD = 200
export const FILES_PER_WORKER = 150
export const MAX_WORKERS = 4

export function pickWorkerCount({
    files,
    cpus,
}: {
    files: number
    cpus: number
}): number {
    const cpuBudget = Math.max(1, cpus - 1)
    const fileBudget = Math.max(1, Math.ceil(files / FILES_PER_WORKER))
    return Math.min(cpuBudget, fileBudget, MAX_WORKERS)
}

function isTruthy(value: string | undefined): boolean {
    if (!value) return false
    return value === '1' || value.toLowerCase() === 'true'
}

export function shouldForceWorkers(value: string | undefined): boolean {
    return isTruthy(value)
}

export function shouldProfile(value: string | undefined): boolean {
    return isTruthy(value)
}

export function readWorkerCountOverride(
    value: string | undefined,
): number | null {
    if (!value) return null
    const n = Number.parseInt(value, 10)
    if (!Number.isFinite(n) || n <= 0) return null
    return n
}
