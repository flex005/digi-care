# diGi-Care Admin & Manager — where the build stands against the AM PRD

Written 15/09/2026, at commit `4f03725`, after Phases 17 to 24. The PRD is
*diGi-Care Admin & Manager, UX Flow & Screen Specification v2.0* (29 screens).
Every statement below was checked against the code when it was written; where
something is missing, that was confirmed by looking for it, not assumed.

## What this build is

A desktop web app for the two governance roles in a care home — the **Admin**
(registered manager) and the **Manager** (deputy manager) — plus a read-only
**Auditor**. Frontend only: no server, no database, no authentication, no
email. Every record comes from generated fixtures and every write lives in the
browser tab until reload or sign-out. Care Worker, Family Portal and Superadmin
are separate products and are not built here; care workers appear in this app
as people an Admin manages, never as users.

It is live at `digi-care-zeta.vercel.app`. The test suite is 71 files and
1,310 tests, alongside eleven guard scripts that check the rules mechanically
(plus eslint and stylelint) and a layout check run in a real browser.

## Built

| PRD section | What exists |
| --- | --- |
| **Authentication** | Sign-in offering the three roles above. An invitation-acceptance screen with password rules and a four-digit signing code. A six-digit verification step. A session that ends after a settable period of inactivity, with a warning first. An account page listing this one session. The organisation setup wizard. **None of it authenticates anybody**, and each screen says so. |
| **Dashboard** | The site dashboard, with an Admin-only banner naming invitations nobody has accepted. A site switcher, and an Admin-only view of every home side by side. |
| **Team** | Staff list with search and filters, read-only for a Manager. Invite drawer (care worker, senior carer, deputy manager), including which residents a care worker covers. Staff profile with homes, resident assignment and recorded activity. Assigning a Manager to several homes. Deactivation with a reason and a typed confirmation. |
| **Residents** | Admission (see the departures). Writing and finalising care plan domains, with version history. |
| **Incidents** | Acknowledging, the manager's own review kept separate from what the reporter wrote, and closing only once there is a root cause and a decision about telling the CQC. |
| **Compliance** | The five Key Questions and statutory notifications. Filing a notification and opening the inspection pack are Admin-only. |
| **Family Portal management** | Naming family members who may see a resident's updates, allowed only once that resident's Family Portal consent is on file. Sharing a care note, and writing a plain-language message about an incident, both kept as an append-only history. **Nothing reaches a family**, and every control says so as an instruction: *if this family needs to know today, telephone them.* |
| **Activities** | Calendar, recording attendance, and cancelling a session with a reason. |
| **Consent** | The consent page and withdrawal. |
| **Documents, Reports** | Both built. |
| **Settings** | Home name and timezone; adjustable figures; which risk assessments, care plan domains and consents a home uses; review frequency; default family access level. The organisation name is set in the wizard. Round times shown read-only. |

**Admin vs Manager** is enforced in what renders: a Manager does not see the
Admin-only controls rather than seeing them disabled, and gets a page saying
why if they open one directly. This is not security; anybody can sign in as
anybody.

## Deliberate departures from the PRD

Each was decided and recorded, not missed.

- **Roles.** A separate "organisation admin" role was folded into registered manager. It was one PRD role with two names, and an undocumented split had turned it into two. Only the three governance and audit roles can sign in.
- **Nine risk assessments, not ten.** The Mental Capacity Act test is a capacity decision, not a risk, and lives with consent.
- **No custom consent types.** A resident's consents are held as exactly eight types, and a custom type would give up the guarantee that none can be forgotten.
- **Round times are not configurable.** Every medication record was produced against them. A change "effective later" would need a scheduler this build does not have.
- **Four settings sections are absent and named on the screen:** notification settings and data export (no server), and the Family Portal on/off switch and the pharmacy-cycle toggle (either would break records already on file). Data export in particular: a request with a legal deadline must not look started when it is not.
- **Refused in authentication:** single active session, a device and IP list (these would be invented records), and "since your last login" (there is no last login to compare against). The password strength bar shows "N of 5 rules met" rather than Weak/Fair/Strong.
- **Family access is never shown as "Invited"**, because nothing is sent and nothing can become Active.
- **Admission:** a DNAR decision is never recorded because a file was attached, since the decision needs a clinician's signature. No target dates are set at admission. Gender is four answers plus "not recorded", and "prefers not to say" counts as an answer. The five organisation fields the wizard's first step asks for (address, country, care setting, CQC number, primary contact) have no field until a screen needs one.
- **Cancelling a session keeps attendance already recorded.** The PRD offers to remove it.
- **The incident family message is a disclosure record, not a field on the manager's review**, and family access reads its basis from the consent rather than asking again.
- **Resident assignment changes nothing on any screen that counts gaps**, enforced by a guard, because a missing record must not become a mark against whoever was assigned.
- **No personal dashboard.** The PRD has none, and the one that existed was built for care workers.

## Asked for by the PRD and not built

- The invitation and verification emails, the forgot-password flow and the lockout alert (no email).
- On the staff profile: changing a role, ending another person's sessions, and a "last active" column.
- Signing code confirmation when finalising a care plan domain.
- A root cause dropdown on incidents; the field is free text.
- The inspection pack's generation and download, report export, and the cross-site consolidated report.
- Creating and editing activity sessions from a screen. The code to save them exists and no screen uses it.
- **Recording a consent from a screen.** The code to write one exists and nothing calls it, so Family Portal access currently works only for residents whose consent is already in the fixtures.
- Adding custom care plan domains (approved, not built).
- Settings that change what existing records mean are shown on the risk assessment list only. The care plan and consent screens do not yet show when a domain or consent type has been turned off.
- Billing.

## Defects found while writing this

Each of these is a statement on screen that the build does not back up, and
each should be fixed before anybody relies on it:

1. Admission's documents step says a DNAR form "can be filed here". There is no upload control on the form.
2. Admission's step strip marks **Contact and GP** as required. Nothing on that step is required, and the steps do not gate anything: all five sections render on one page.
3. The invite drawer tells somebody to change a person's role "on their own page". The staff profile has no role control.
4. Settings says custom care plan domains are site-scoped "where they are added". There is nowhere to add one.
5. The invitation screen asks for a job title and does not keep it.
