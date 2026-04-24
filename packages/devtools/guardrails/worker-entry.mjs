// Worker bootstrap: registers tsx so the worker can load `.ts` source files
// (and resolve the `.js`-suffixed local imports they use under NodeNext).
// tsx's --import hook does not auto-register inside worker threads, so we
// register explicitly here before dynamically importing the actual worker.
import { register } from 'tsx/esm/api'

register()

await import('./worker.ts')
