interface FlagState { hasPassword: boolean }
type KeyState = { mnemonic: Uint16Array }
type MaybeKeyStore = { seed: Nullable<Uint8Array> }
type LoginParams = { password: string }
interface NameState { label: string }
