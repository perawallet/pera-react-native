export const stripNulls = (obj: Record<string, unknown>) => {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, value]) => value != null)
    )
}