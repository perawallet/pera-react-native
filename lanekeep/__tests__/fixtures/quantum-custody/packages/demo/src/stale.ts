// Keys used to live under storage/quantum-child
export const sign = (seed: string) => signWithQuantumSeed(seed)
export const cipher = { decryptData: 1 }
export const legacyCommit = '_commitQuantumChildKeyV2'
export const regex = /encryptData/
