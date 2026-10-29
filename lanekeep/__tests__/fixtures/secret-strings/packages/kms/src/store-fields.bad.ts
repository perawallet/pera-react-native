interface FooState {
    password: string
}
type BarStore = { mnemonic: string[] }
type BazState = { seed?: Nullable<string> }
type QuxState = Base & { privateKey: string | null }
interface ListState {
    passphrase: readonly string[]
}
type DeepStore = A & B & { secret: string }
type PlainState = { count: number; seed: string }
