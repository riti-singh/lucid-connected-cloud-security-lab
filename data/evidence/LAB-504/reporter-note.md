# Reporter note (synthetic)

> Synthetic lab evidence. Fictional reporter, pod, and incident; not a real Lucid finding.

- Reporter: support-cloud SRE (fictional), filed on 2026-10-13.
- Symptom: the hypothetical support pod hit its memory limit and restarted when an agent opened `bundle-2026-10-13-full.txt` (about 6 GiB) from inside the approved diagnostic root. Support tooling was unavailable to every agent for about 20 minutes.
- Reporter's severity: `high`. Any support agent can trigger this with a legitimate bundle name, and the outage takes support tooling down for all agents.
- The scanner rated the same code `low` (see `scanner-findings.json`).
- The service owner has not confirmed a severity yet.
