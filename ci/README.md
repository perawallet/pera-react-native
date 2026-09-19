# Pipeline definition

Consumed by `pera-ci`, the self-hosted build daemon.

The daemon reads `pipelines.yml` from `refs/heads/main`, never from the tag
being built, so the tag cannot change which jobs exist, what they depend on,
or which `env` and `secrets` each one receives. It does not follow that a tag
cannot change what a build does: the job **scripts** in `jobs/` are run from
the checkout of the ref being built, so whoever can push a release tag can
change their contents.

What contains a fork, then, is the trigger: the daemon polls
`git ls-remote --tags` and filters to `refs/tags/`, so nothing but a tag can
start a run, and a fork cannot push a tag to this repository. A pull request —
from a fork or otherwise — never reaches the signing host.

Each job is an opaque script. The executor understands only `needs`, `env`,
`secrets`, `always_run` and `allow_failure`; there are no conditionals, and
anything that wants one belongs in the script.

## What a job receives

| Variable              | Meaning                                                        |
| --------------------- | -------------------------------------------------------------- |
| `CI_RUN_ID`           | The run's numeric id                                           |
| `CI_JOB_NAME`         | This job's name in the manifest                                |
| `CI_TAG`              | The tag being built, without `refs/tags/`                      |
| `CI_SHA`              | The commit the tag points at                                   |
| `CI_WORKSPACE`        | The checkout root, and the job's working directory             |
| `CI_ARTIFACT_DIR`     | Where to put anything that should outlive the run              |
| `CI_OUTPUT`           | Append `KEY=value` lines; dependents read `CI_OUT_<JOB>_<KEY>` |
| `CI_JOB_STATUS_<JOB>` | An upstream job's result, for `always_run` jobs                |
| `CI_UPLOADS_ENABLED`  | `false` until this pipeline is meant to ship; set per pipeline |

A job gets `PATH`, `HOME`, the cache variables, its declared `env`, and its
declared `secrets`. Nothing else from the daemon's environment reaches it.

`CI_OUT_<JOB>_<KEY>` is scoped to a job's transitive `needs` closure, but
`CI_JOB_STATUS_<JOB>` is not: it is set for every job that has run so far,
whether or not the reading job declares it as a `need`. `notify.sh` relies on
this to report on jobs it never lists in `needs`.

Resolve Node from `.tool-versions` inside each job. Inheriting the daemon's
Node changes host globals under the test suite.

## Secret resolution and per-environment validation

`ci/pipelines.yml`'s `secrets` list names are a mix of `PRODUCTION_`/
`STAGING_`-prefixed and bare names, depending on how the operator populated
the secret store. Whichever name the daemon resolved a value under, the job
sees it injected as the bare name only — it never re-exposes the prefixed
name.

`tools/validate-env.sh`'s per-environment checks were written for Bitrise,
where the prefixed name is always what's set (aliasing to the bare name is a
later, separate step). Under the daemon the prefixed name is never set, so
every one of those checks falls through to its bare-name branch and prints a
`NOTE`. That fallback is correct and intentional — see the comment in
`tools/validate-env.sh`, which is shared with Bitrise and not changed for the
daemon's sake — but it means the check no longer proves anything about which
environment's secrets a job got: it accepts whatever sits under the bare
name, unconditionally. If the secret store holds only a bare
`ANDROID_GOOGLE_SERVICES_BASE64`, a staging nightly silently gets the
production Firebase project (or the reverse), and the only signal is a
`NOTE` line among dozens in the job log.

The consequence: the per-environment guarantee — this job gets staging
secrets, that job gets production secrets — now lives entirely in how the
operator populates the secret store per pipeline. Nothing in this repository
checks it.
