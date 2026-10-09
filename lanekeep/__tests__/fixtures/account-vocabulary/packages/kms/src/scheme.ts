export const SeedScheme = { Quantum: 'quantum', Algo25: 'algo25' } as const
export const isQuantum = (s: string) => s === SeedScheme.Quantum
export const shims = { falcon: undefined }
