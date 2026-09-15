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

It is live at `digi-care-zeta.vercel.app`. The test suite is 73 files and
1,323 tests as of Phase 25, alongside eleven guard scripts that check the rules
mechanically (plus eslint and stylelint) and a layout check run in a real
browser.

## Built

| PRD section | What exists |
| --- | --- |
| **Authentication** | Sign-in offering the three roles above. An invitation-acceptance screen with password rules and a four-digit signing code. A six-digit verification step. A session that ends after a settable period of inactivity, with a warning first. An account page listing this one session. The organisation setup wizard. **None of it authenticates anybody**, and each screen says so. |
| **Dashboard** | The site dashboard, with an Admin-only banner naming invitations nobody has accepted. A site switcher, and an Admin-only view of every home side by side. |
| **Team** | Staff list with search and filters, read-only for a Manager. Invite drawer (care worker, senior carer, deputy manager), including which residents a care worker covers. Staff profile with homes, resident assignment and recorded activity. Assigning a Manager to several homes. Deactivation with a reason and a typed confirmation. |
| **Residents** | Admission in five steps shown one at a time, of which only the first is required, with a DNAR form that can be filed as part of it (see the departures). Writing and finalising care plan domains, with version history. |
| **Incidents** | Acknowledging, the manager's own review kept separate from what the reporter wrote, and closing only once there is a root cause and a decision about telling the CQC. |
| **Compliance** | The five Key Questions and statutory notifications. Filing a notification and opening the inspection pack are Admin-only. |
| **Family Portal management** | Naming family members who may see a resident's updates, allowed only once that resident's Family Portal consent is on file. Sharing a care note, and writing a plain-language message about an incident, both kept as an append-only history. **Nothing reaches a family**, and every control says so as an instruction: *if this family needs to know today, telephone them.* |
| **Activities** | Calendar, planning a session, changing one before it starts, recording attendance, and cancelling a session with a reason. |
| **Consent** | The consent page; recording a decision after the capacity assessment, on the resident's own authority, as a best-interests decision, or by an attorney where a health and welfare LPA is on file; and withdrawal. |
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
- **Admission's second step, Contact and GP, is not required.** The PRD marks it required. The build never required anything on it, and the step labels now say so rather than claiming otherwise. Whether it should be required is still to be decided.
- **No job title on the invitation screen.** The PRD asks for one, and there is nowhere on a staff record to keep it.
- **Cancelling a session keeps attendance already recorded.** The PRD offers to remove it.
- **A session can be changed only before it starts**, because once it has begun its time is what attendance is recorded against.
- **The incident family message is a disclosure record, not a field on the manager's review**, and family access reads its basis from the consent rather than asking again.
- **Resident assignment changes nothing on any screen that counts gaps**, enforced by a guard, because a missing record must not become a mark against whoever was assigned.
- **No personal dashboard.** The PRD has none, and the one that existed was built for care workers.

## Asked for by the PRD and not built

- The invitation and verification emails, the forgot-password flow and the lockout alert (no email).
- On the staff profile: changing a role, ending another person's sessions, and a "last active" column.
- Signing code confirmation when finalising a care plan domain.
- A root cause dropdown on incidents; the field is free text.
- The inspection pack's generation and download, report export, and the cross-site consolidated report.
- Changing who is invited to a session once it is planned.
- Changing a role on the staff profile (listed above); the invite drawer now says so.
- Adding custom care plan domains (approved, not built); Settings now says so.
- Settings that change what existing records mean are shown on the risk assessment list only. The care plan and consent screens do not yet show when a domain or consent type has been turned off.
- Billing.

## Defects found while writing this, and fixed in Phase 25

Each was a statement on screen that the build did not back up. Each had been
reported as done in its phase and accepted without anybody asking what backed
it. With them went the two writes that had code and no screen: recording a
consent, and planning or changing a session.

1. Admission's documents step said a DNAR form "can be filed here", with no control. **Fixed:** the step has one, and the form is filed on the resident's record at admission while the decision stays unrecorded.
2. Admission's step strip marked **Contact and GP** required over a single page that gated nothing. **Fixed:** one step at a time, the later steps opening once step 1 is answered, and labels that match what the form requires.
3. The invite drawer said to change a person's role "on their own page", which has no role control. **Fixed:** it now says role changes are not built.
4. Settings said custom care plan domains are site-scoped "where they are added", with nowhere to add one. **Fixed:** it now says adding one is not built.
5. The invitation screen asked for a job title and kept it nowhere. **Fixed:** the field is gone.
