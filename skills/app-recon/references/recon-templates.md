# Recon templates

## appclone/recon.md

```markdown
# Recon: <app> — <slice>
Platform: web|ios|android|desktop   Mode: full|feature|migrate   Size: S|M|L|XL
Core loop: <one sentence>

## Screens
| ID | name | route / how reached | purpose | components | states seen | source |
| S01 | ... | ... | ... | ... | empty, filled, error | src-03 |

## Flows
F01 <goal>: S01 -> S04 -> S05   clicks: 4
    edges: no data, slow network, session expired, double submit

## Components
| name | variants | states | used on |

## Data model (inferred)
Entity  field:type, ...
        relations: ...
        evidence: S04 form fields, help article "..."   confidence: high|medium|hint

## Not deducible / not clonable
- ...

## Hardest parts
1. ... 2. ... 3. ...
```

## appclone/features.csv

```csv
feature,area,priority,original,clone,notes
Sign up with email,onboarding,must,yes,no,
Share a read-only link,sharing,should,yes,no,
Partner marketplace,integrations,could,yes,skip,their network is not rebuildable
Offline mode (added by us),sync,should,no,no,fix from pain research X01
```
- `priority`: must / should / could. `clone`: yes / partial / no / skip.
- `original=no` marks features you add; they are reported separately, never inflate parity.

## appclone/sources.csv

```csv
id,url_or_ref,kind,date_read,notes
src-01,https://example.com/help,help-center,2026-01-01,
own-01,own account walkthrough,own-account,2026-01-01,user driving
```
