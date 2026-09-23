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

A job whose `env` sets `ENVIRONMENT` has each declared secret `X` resolved as
`<ENVIRONMENT>_X` first (`PRODUCTION_X`, `STAGING_X`), falling back to a bare
`X`, which the daemon logs by name. A value found under the prefix reaches the
job under both names; a bare fallback reaches it as `X` only.

That is the shape `tools/setup-env-secrets.sh` leaves a Bitrise job in, so
`tools/validate-env.sh` runs unchanged on both: it requires the prefixed name
for every per-environment secret and fails a job that has no
environment-specific value for one. A staging nightly cannot silently pick up
the production Firebase project from a bare `ANDROID_GOOGLE_SERVICES_BASE64`.
