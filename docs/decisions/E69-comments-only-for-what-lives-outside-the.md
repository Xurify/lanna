# E69. Comments only for what lives outside the repo (2026-11-07, branch `fix/review-miss-reason`)

Owner's rule: "Code explains itself; name things until it does. A comment is allowed only for something outside this repo (browser, framework, library, platform, third-party API, spec, or where an external number comes from)."

**How to apply:** the full rule is in [AGENTS.md](../../AGENTS.md) under **Code style → Comments**, and `CLAUDE.md` points to it. The product why belongs in a decision file here, the pull request's description and commit messages, not in the code. Code you add or change follows it; an older comment goes when the code around it is next changed.
