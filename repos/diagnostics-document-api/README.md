# Diagnostics Document API (Python)
Synthetic cloud support workflow for retrieving diagnostic bundles. The system must only read files under an approved diagnostic root. This repository deliberately omits path containment validation. Run `python3 -m unittest discover -s tests -v` from this folder. Expected baseline: legitimate fetch passes, traversal and absolute-path rejection fail.
