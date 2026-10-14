// A package outside the chain-neutral list may name Algorand.
export const family = 'algorand'

export const isRekeyed = (account: { rekeyed: boolean }) => account.rekeyed
