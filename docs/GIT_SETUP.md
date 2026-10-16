# Git repository setup
Fastest interview path: push this folder as ONE Git repository. Four language services are physically isolated under `repos/`, and each has its own README/tests. This enables a consistent Devin working directory and cross-repo evidence simulation but is **not** four real independent GitLab repositories.

For an authentic multi-repository demo, initialize and push each `repos/<service>` folder as a separate repository, plus one fifth `control-plane` repository containing `data/`, `tools/`, `devin/` and `docs/`. Keep ticket-to-repo paths consistent in README and Devin prompts. Never claim GitLab integration unless you actually connected it; GitHub hosting can be used as a stand-in and labeled honestly.

Suggested private repo names: `connected-cloud-diagnostics-python`, `connected-cloud-charging-typescript`, `connected-cloud-ota-java`, `connected-cloud-telemetry-go`, `connected-cloud-security-control`.

No authentication tokens, real vehicle identifiers or real Lucid data should be committed.

## Automated export of five Git-ready folders

From the combined workspace root run:

```bash
python3 tools/split_repos.py --output ~/Desktop/connected-cloud-export
```

This creates four standalone service folders and one control-plane folder. It does **not** publish to GitHub/GitLab, initialize remotes, or create pull requests. The cross-repository baseline runner works in the combined workspace; service tests continue to work independently in their exported repositories.
