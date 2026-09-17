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

It is live at `digi-care-zeta.vercel.app`. The test suite is 77 files and
1,364 tests as of Phase 29, alongside thirteen guard scripts that check the rules
mechanically (plus eslint and stylelint) and a layout check run in a real
browser.

## Built

| PRD section | What exists |
| --- | --- |
| **Authentication** | Sign-in offering the three roles above. An invitation-acceptance screen with password rules and a four-digit signing code. A six-digit verification step. A session that ends after a settable period of inactivity, with a warning first. An account page listing this one session. The organisation setup wizard, offered to the registered manager straight after verifying, and reachable again from Settings → Organisation. **None of it authenticates anybody.** |
| **Dashboard** | The site dashboard, with an Admin-only banner naming invitations nobody has accepted. A site switcher, and an Admin-only view of every home side by side. |
| **Team** | Staff list with search and filters, read-only for a Manager. Invite drawer (care worker, senior carer, deputy manager), including which residents a care worker covers. Staff profile with homes, resident assignment and recorded activity. Assigning a Manager to several homes. Deactivation with a reason and a typed confirmation. |
| **Residents** | Admission in five steps shown one at a time, of which only the first is required, with a DNAR form that can be filed as part of it (see the departures). Writing and finalising care plan domains, with version history. |
| **Incidents** | Acknowledging, the manager's own review kept separate from what the reporter wrote, and closing only once there is a root cause and a decision about telling the CQC. |
| **Compliance** | The five Key Questions and statutory notifications. Filing a notification and opening the inspection pack are Admin-only. |
| **Family Portal management** | Its own module: a resident tab listing everybody named for that person — name, relationship, email, access level, who recorded it and when — each with Edit and Remove, and an Add button opening a dialog rather than a form standing open on the page. A cross-resident screen leads on residents who agreed and have nobody named. Naming somebody is allowed only once that resident's Family Portal consent is on file. Sharing a care note, and writing a plain-language message about an incident, both kept as an append-only history. **Nothing reaches a family**, and every control says so as an instruction: *if this family needs to know today, telephone them.* |
| **Activities** | Calendar, planning a session, changing one before it starts, recording attendance, and cancelling a session with a reason. |
| **Consent** | The consent page; recording a decision after the capacity assessment, on the resident's own authority, as a best-interests decision, or by an attorney where a health and welfare LPA is on file; and withdrawal. |
| **Documents, Reports** | Both built. |
| **Settings** | Four tabs: Team, Homes, This home and Organisation. **This home**: its name and timezone, and which risk assessments, care plan domains and consents it uses. **Organisation**: the figures every home runs on, including review frequency, with round times shown read-only, and a **Set up the organisation** button at the top that opens the wizard at `/settings/setup`, where the organisation name is set. |

**Admin vs Manager** is enforced in what renders: a Manager does not see the
Admin-only controls rather than seeing them disabled, and gets a page saying
why if they open one directly. This is not security; anybody can sign in as
anybody.

**A record is read at the home that holds it.** The session hands a viewer only
the homes they are appointed to, so the site switcher is absent for somebody
with one home and present for somebody with two, whatever their role. Every
queue and figure follows from that, because they read the active home. The
loaders refuse a record belonging to a home the viewer does not hold, which is
what stops a URL reaching another home's resident: the screen says which home
the record belongs to and which homes are yours, rather than reporting an error
over a record that loaded or a not-found for a resident who exists.

## Deliberate departures from the PRD

Each was decided and recorded, not missed.

- **A Manager's homes are a property of their assignment, not of their role.** One home means no site switcher; two means one. Marie Halloran covers both homes, which the PRD's TM-04 exists for; Deborah Aluko covers one, which is the commoner case. The Admin covers both, because administering the organisation is a different fact from which service a manager is registered to.
- **Roles.** A separate "organisation admin" role was folded into registered manager. It was one PRD role with two names, and an undocumented split had turned it into two. Only the three governance and audit roles can sign in.
- **Nine risk assessments, not ten.** The Mental Capacity Act test is a capacity decision, not a risk, and lives with consent.
- **No custom consent types.** A resident's consents are held as exactly eight types, and a custom type would give up the guarantee that none can be forgotten.
- **Round times are not configurable.** Every medication record was produced against them. A change "effective later" would need a scheduler this build does not have.
- **Four settings sections are absent and named on the screen:** notification settings and data export (no server), and the Family Portal on/off switch and the pharmacy-cycle toggle (either would break records already on file). Data export in particular: a request with a legal deadline must not look started when it is not.
- **Refused in authentication:** single active session, a device and IP list (these would be invented records), and "since your last login" (there is no last login to compare against). The password strength bar shows "N of 5 rules met" rather than Weak/Fair/Strong.
- **Family access is never shown as "Invited"**, because nothing is sent and nothing can become Active. An email address is recorded on a family member as a contact detail, and nothing in this build sends to it.
- **The Family Portal module never records a consent.** Whether a family may see anything is the resident's consent, owned by the Consent tab; who is named is owned by the Family Portal tab. A guard fails the build if the family module ever reaches a consent writer.
- **People named before a consent was withdrawn are shown, not hidden.** They keep access until somebody removes them, so the screen that names them shows them with a Remove control, and the module screen counts them as a separate finding. There is no Edit there and no Add: correcting what an unauthorised access says is not the act somebody needs, and ending it is.
- **A family member is an append-only list of revisions**, so a correction keeps who granted the access and when, and adds who changed it, what they changed and when. Remove-and-re-add would discard the record of the decision.
- **An access level appends rather than replaces.** It can be changed — the same person under the same authorisation — but the earlier level stays on the record, because the disclosure log says what was shared while it stood. A mistyped email replaces, because it was never true.
- **Admission departs from the PRD in four places, all for one reason.** A form that requires something on the day somebody arrives will get it invented. A resident arriving from hospital at nine in the evening may have no discharge summary and no practice details with them. The PRD asks for a complete record, and a complete record is better than an incomplete one. But the question is whether requiring an answer produces a complete record or a plausible one. A gap that every screen shows is honest, and an invented answer is indistinguishable from a recorded one for as long as the record lasts. So:
  1. **Contact and GP (step 2) is not required.** The PRD marks it required.
  2. **A DNAR decision is never recorded because a form was filed.** The decision needs a clinician's signature, which this build does not capture. The form is filed and the decision stays unrecorded.
  3. **No target dates are set at admission.** Unwritten care plan domains and never-done assessments already show as gaps on every screen, and a date would add a deadline nothing enforces.
  4. **Gender can be left not recorded.** It is four answers plus "not recorded", and "prefers not to say" counts as an answer, because somebody who declined was asked and somebody nobody has asked was not.
- **The setup wizard is offered after every registered manager's sign-in, not run once on the first** (AUTH-05). Nothing here records a sign-in, so "first" cannot be told from any other, and a flag would claim a history this build does not hold. After verifying, the registered manager chooses: **Set it up** or **Go to the dashboard**. The screen is not a welcome, because the organisation already has two homes and eighteen people. Signing out discards everything the wizard wrote, so each sign-in does start with the organisation unset by it; the repeated offer shows the build's state rather than nagging. Managers and the auditor go straight to the dashboard. The wizard's way out says "Back to the organisation" only when it was opened from that tab, and "Go to the dashboard" otherwise.
- **Setup wizard:** the five organisation fields its first step asks for (address, country, care setting, CQC number, primary contact) have no field until a screen needs one.
- **No job title on the invitation screen.** The PRD asks for one, and there is nowhere on a staff record to keep it.
- **Cancelling a session keeps attendance already recorded.** The PRD offers to remove it.
- **A session can be changed only before it starts**, because once it has begun its time is what attendance is recorded against.
- **The incident family message is a disclosure record, not a field on the manager's review**, and family access reads its basis from the consent rather than asking again.
- **A resuscitation or ADRT confirmation does not warn that staff on shift are notified** (FRONTEND_PRD §6.2 asks for that warning). Nothing in this build notifies anybody, so the warning would be a screen promising an act it does not perform, and the toast that follows, saying nobody on shift was notified, would contradict it. That makes the dialog wrong, not merely unfulfilled. The confirmation names the resident and what the change does; the toast names the home whose staff were not told.
- **Resident assignment changes nothing on any screen that counts gaps**, enforced by a guard, because a missing record must not become a mark against whoever was assigned.
- **`--status-caution` stays below 3:1** (PRD §7 asks 3:1 of a status boundary; the fill measures 2.75:1 on the surface). Decided 17/09/2026 in the Care Worker build, where a darker value was measured and declined: an orange mark carries no meaning alone, and that is acceptable only where no caution state is carried by colour alone. **That precondition is not established in this build**: the fill is drawn in 26 declarations across 17 feature stylesheets besides the status pill and the toast, and nobody has checked each for words beside it. Details in PROGRESS.md.
- **No personal dashboard.** The PRD has none, and the one that existed was built for care workers.

## Asked for by the PRD and not built

- The invitation and verification emails, the forgot-password flow and the lockout alert (no email).
- On the staff profile: changing a role, ending another person's sessions, and a "last active" column.
- Signing code confirmation when finalising a care plan domain.
- A root cause dropdown on incidents; the field is free text.
- The inspection pack's generation and download, report export, and the cross-site consolidated report.
- Changing who is invited to a session once it is planned.
- Changing a role on the staff profile (listed above).
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
