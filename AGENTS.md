# Repository instructions

See [README.md](README.md) for the project and the generation scripts, and [docs/secret-scanning.md](docs/secret-scanning.md) for the secret scan. From the repository root, `npm install` sets up dependencies, `npm run dev` starts the app, and `npm run lint` and `npm test` are available. CI runs `npm ci`, `npm audit`, `npm test` and `npm run build` (`.github/workflows/dependency-validation.yml`).

## Required local review

This section applies to local coding-agent sessions only. A hosted CI review
gets its instructions from the workflow. In hosted CI, do not run Crew and do not
treat missing Crew as a failed review. Run the local review before you open a
pull request. It does not replace the hosted review, which stays the merge
requirement.

Prepare each required local review in the existing coding-agent session. From this
repository root, run `crew version` and `crew install --latest --json` with a
command timeout. Require the published Crew release that
[Shared local review](#shared-local-review) names. Then read the updated project
`review/SKILL.md`: `.agents/skills/review/SKILL.md` for Codex or
`.claude/skills/review/SKILL.md` for Claude Code. Follow its shared preparation
procedure to verify this agent's full roster, helper and source records, then
continue `/review` in this session. Refresh once per invocation. The shared local
review supports Codex and Claude Code; with another agent, report the local
review as not run.

Failed preparation stops required review. A timeout is a failed preparation. If
you cannot recover the preparation, report the local review as not run and ask the
user before you open the pull request. `npm install` does not run Crew, so it does
not prove readiness; neither does a `no_agents` result or another agent's install.
Do not use stale or personal skills as a fallback. See
[Shared local review](#shared-local-review) for setup and recovery.

The shared procedure includes proposed PR title and body text from the separately
installed pull-request-description helper. This local step does not edit the PR
or change the code-review verdict. Keep `.crewrc` and its generated lock tracked
and downloaded copies ignored. Do not commit files under `.agents/skills/` or
`.claude/skills/` that Crew installed. As the agent, do not discard a
`.crewrc.lock` change. The author commits it in the pull request under review or
discards it after the review. Do not refresh while reviewers run. Do not add a
repository-specific wrapper for the review.

## Shared local review

Shared review skills and the PR-description helper come from `.crewrc` through
Crew. `npm install` does not run Crew.

Use the published [Crew release](https://crew.logic.inc/) with project manifests
(0.13+; 0.14.0 verified). Check `crew version` and Git read access to
`with-logic/skills`. Enable the agent if needed with `crew agents enable codex`
or `crew agents enable claude-code`, then run this from the repository root:

```sh
crew install --latest --json
```

A failure exits nonzero; fix the reported cause and run it again. For a
`no_agents` result, enable your agent with the commands above. A zero exit does
not prove that your agent is ready. The preparation checks of each review confirm
it.

Commit `.crewrc` and its Crew-generated `.crewrc.lock`. Plain `crew install`
retains the locked revision; `--latest` can advance it. The author commits a lock
change in the pull request under review, so that reviewers see it, or discards it
after the review with `git restore .crewrc.lock`. If `.crewrc.lock` conflicts with
the base branch, keep the base branch's lock; the next refresh can advance it
again. Authored and personal skills remain owned by their authors.
