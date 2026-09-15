import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { StatesRoute } from '@/dev/StatesRoute'
import { ResidentsRoute } from '@/features/residents/ResidentsRoute'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { GeneralInformationTab } from '@/features/residents/GeneralInformationTab'
import { NeedsTab } from '@/features/residents/NeedsTab'
import { CarePlanTab } from '@/features/care-plan/CarePlanTab'
import { DomainEditorRoute } from '@/features/care-plan/DomainEditorRoute'
import { VersionHistoryRoute } from '@/features/care-plan/VersionHistoryRoute'
import { ImportantPeopleTab } from '@/features/residents/ImportantPeopleTab'
import { FuturePlansTab } from '@/features/residents/FuturePlansTab'
import { AssessmentFormRoute } from '@/features/risk/AssessmentFormRoute'
import { AssessmentListTab } from '@/features/risk/AssessmentListTab'
import { NotesTab } from '@/features/notes/NotesTab'
import { NoteDetail } from '@/features/notes/NoteDetail'
import { MarChartRoute } from '@/features/medications/MarChartRoute'
import { MedicationsTab } from '@/features/medications/MedicationsTab'
import { PrescriptionsTab } from '@/features/medications/PrescriptionsTab'
import { MedicationsRoute } from '@/features/medications/MedicationsRoute'
import { OmissionsRoute } from '@/features/medications/OmissionsRoute'
import { RegisterRoute } from '@/features/medications/RegisterRoute'
import { RegisterLedgerRoute } from '@/features/medications/RegisterLedgerRoute'
import { RoundRoute } from '@/features/medications/RoundRoute'
import { CycleRoute } from '@/features/medications/CycleRoute'
import { InterimRoute } from '@/features/medications/InterimRoute'
import { HandoverRoute } from '@/features/handover/HandoverRoute'
import { IncidentDetailRoute } from '@/features/incidents/IncidentDetailRoute'
import { IncidentLogRoute } from '@/features/incidents/IncidentLogRoute'
import { RiskQueueRoute } from '@/features/risk/RiskQueueRoute'
import { ReviewQueueRoute } from '@/features/reviews/ReviewQueueRoute'
import { WholePlanReviewRoute } from '@/features/reviews/WholePlanReviewRoute'
import { CarePlanQueueRoute } from '@/features/care-plan/CarePlanQueueRoute'
import { GoalQueueRoute } from '@/features/goals/GoalQueueRoute'
import { ActivityCalendarRoute } from '@/features/activities/ActivityCalendarRoute'
import { ConsentDashboardRoute } from '@/features/consent/ConsentDashboardRoute'
import { FamilyQueueRoute } from '@/features/family/FamilyQueueRoute'
import { FamilyTab } from '@/features/family/FamilyTab'
import { ConsentTab } from '@/features/consent/ConsentTab'
import { CapacityGateRoute } from '@/features/consent/CapacityGateRoute'
import { WithdrawalRoute } from '@/features/consent/WithdrawalRoute'
import { DocumentsTab } from '@/features/documents/DocumentsTab'
import { ExpiryQueueRoute } from '@/features/documents/ExpiryQueueRoute'
import { OrganisationLibraryRoute } from '@/features/documents/OrganisationLibraryRoute'
import { DocumentViewerRoute } from '@/features/documents/DocumentViewerRoute'
import { ComplianceOverviewRoute } from '@/features/compliance/ComplianceOverviewRoute'
import { KeyQuestionRoute } from '@/features/compliance/KeyQuestionRoute'
import { InspectionPackRoute } from '@/features/compliance/InspectionPackRoute'
import { NotificationsRoute } from '@/features/compliance/NotificationsRoute'
import { DashboardRoute } from '@/features/dashboard/DashboardRoute'
import { ReportIndexRoute } from '@/features/reports/ReportIndexRoute'
import { ReportViewRoute } from '@/features/reports/ReportViewRoute'
import { TeamListRoute } from '@/features/team/TeamListRoute'
import { StaffDetailRoute } from '@/features/team/StaffDetailRoute'
import { PermissionMatrixRoute } from '@/features/team/PermissionMatrixRoute'
import { ActivityLogRoute } from '@/features/team/ActivityLogRoute'
import { GroupOverviewRoute } from '@/features/group/GroupOverviewRoute'
import { SettingsRoute } from '@/features/group/SettingsRoute'
import { SettingsShellRoute } from '@/features/settings/SettingsShellRoute'
import { SetupWizardRoute } from '@/features/settings/SetupWizardRoute'
import { AdmissionRoute } from '@/features/residents/AdmissionRoute'
import { AttendanceRoute } from '@/features/activities/AttendanceRoute'
import { PlanDrawerRoute } from '@/features/activities/PlanDrawerRoute'
import { GoalsTab } from '@/features/goals/GoalsTab'
import { GoalDetailRoute } from '@/features/goals/GoalDetailRoute'
import { GoalFormRoute } from '@/features/goals/GoalFormRoute'
import { ReportIncidentRoute } from '@/features/incidents/ReportIncidentRoute'
import { CareNotesRoute } from '@/features/notes/CareNotesRoute'
import { SignInRoute } from '@/features/auth/SignInRoute'
import { SignOutRoute } from '@/features/auth/SignOutRoute'
import { VerifyRoute } from '@/features/auth/VerifyRoute'
import { InvitationRoute } from '@/features/auth/InvitationRoute'
import { InvitationIndexRoute } from '@/features/auth/InvitationIndexRoute'
import { InvitationAccessRoute } from '@/features/auth/InvitationAccessRoute'
import { MyPermissionsRoute } from '@/features/me/MyPermissionsRoute'
import { RequireSignIn } from './session/RequireSignIn'
import { NotFound } from './NotFound'

/**
 * Routing. React Router 7, data router API. PRD §3.1.
 *
 * A route is registered by the phase that builds its screen, never before.
 * Stubbing the unbuilt modules now would mean shipping placeholder screens,
 * which CLAUDE.md §6 forbids; the sidebar already tells the user they are
 * coming, which is the honest version of the same information. So the table
 * below grows phase by phase, and what is in it is what exists.
 *
 * `/` redirects to /residents. /dev/states is never deleted — it is how the
 * Evidence Invariant is checked visually at the end of every phase.
 *
 * **Four routes sit outside the shell and outside the gate**: signing in,
 * accepting an invitation, seeing what that invitation would give you, and
 * signing out. The first three are reached before anybody has said who they
 * are, so there is no sidebar and no site switcher on them; the fourth is an
 * authentication screen too, and it is the one place in the build where an
 * action destroys work. Everything else redirects to `/sign-in` until somebody
 * has signed in and chosen a home.
 */
export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInRoute /> },
  { path: '/invitation', element: <InvitationIndexRoute /> },
  { path: '/invitation/:staffId', element: <InvitationRoute /> },
  { path: '/invitation/:staffId/access', element: <InvitationAccessRoute /> },
  /*
   * Phase 19. Verification sits between the credentials and the session, for
   * both paths into the product: accepting an invitation and signing in. It is
   * outside the shell and outside the gate like the others, because it is
   * reached before anybody has said who they are.
   */
  { path: '/verify/:staffId', element: <VerifyRoute /> },
  { path: '/sign-out', element: <SignOutRoute /> },
  {
    path: '/',
    element: (
      <RequireSignIn>
        <AppShell />
      </RequireSignIn>
    ),
    children: [
      // Phase 12. The Dashboard is the front door, built here rather than
      // earlier because a dashboard over three modules would have been rebuilt
      // twice (PRD §8). It shares the compliance module's machinery and shares
      // none of its figures.
      { index: true, element: <DashboardRoute /> },
      { path: 'residents', element: <ResidentsRoute /> },
      /*
       * **`/me` is gone and `/me/permissions` is the account page.** The
       * dashboard it used to be was built for somebody working a shift: the
       * next round with a button to open it, a shift pill, what they flagged
       * and were waiting on. Care workers do not sign into this platform and
       * an Admin does not run a medication round, and AM v2.0 has no personal
       * dashboard at all. Three of its four sections duplicated the site
       * Dashboard or inverted a queue that already exists; the fourth was an
       * account page, and it is here.
       *
       * It stays outside every module deliberately. The auditor has no access
       * to Settings, so an account page living there would lock them out of
       * their own access.
       */
      { path: 'me/permissions', element: <MyPermissionsRoute /> },
      // Phase 16. Admission is the only screen in the build that creates a
      // resident, and what it creates is a person and a set of gaps.
      { path: 'residents/new', element: <AdmissionRoute /> },
      { path: 'care-notes', element: <CareNotesRoute /> },
      { path: 'handover', element: <HandoverRoute /> },
      // Phase 4. The log and the detail land with their references; the report
      // form is reached from both, and from the Incidents sidebar item once
      // that lands with the log.
      { path: 'incidents', element: <IncidentLogRoute /> },
      { path: 'risk-assessments', element: <RiskQueueRoute /> },
      // Phase 7. Two queues over one projection: what has a review date on it,
      // and what has never been written at all. Different claims, and each
      // names the other rather than counting the other's population twice.
      { path: 'reviews', element: <ReviewQueueRoute /> },
      { path: 'care-plans', element: <CarePlanQueueRoute /> },
      // Phase 8. The queue leads on goals whose date passed with nothing said.
      { path: 'goals', element: <GoalQueueRoute /> },
      // Phase 9. The calendar is the module; a session is reached from a block
      // on it, and its plan from the session.
      { path: 'activities', element: <ActivityCalendarRoute /> },
      // Phase 10. The dashboard is the queue; one consent is reached from a
      // row, and the capacity gate stands in front of recording it.
      { path: 'consent', element: <ConsentDashboardRoute /> },
      // Phase 26. The queue leads on residents who agreed to the Family Portal
      // and have nobody named; who is named is a tab on the resident.
      { path: 'family', element: <FamilyQueueRoute /> },
      // Phase 11. The organisation library is the module; expiry tracking is
      // the queue under it, and a resident's own library is a profile tab.
      { path: 'documents', element: <OrganisationLibraryRoute /> },
      // A document whose metadata is real opens; a broken reference still says
      // it cannot, which is a different message for a different thing.
      { path: 'documents/:documentId', element: <DocumentViewerRoute /> },
      { path: 'documents/expiry', element: <ExpiryQueueRoute /> },
      // Phase 12. The overview is the module; a Key Question is reached from a
      // row on it, and the pack and the notifications queue from its head.
      { path: 'compliance', element: <ComplianceOverviewRoute /> },
      { path: 'compliance/pack', element: <InspectionPackRoute /> },
      { path: 'compliance/notifications', element: <NotificationsRoute /> },
      { path: 'compliance/:keyQuestion', element: <KeyQuestionRoute /> },
      // Phase 13. Eight reports; the seven questions that would have been a
      // compliance check with a table under it open from that check instead.
      { path: 'reports', element: <ReportIndexRoute /> },
      { path: 'reports/:reportId', element: <ReportViewRoute /> },
      /*
       * The administrative area, under one sidebar item.
       *
       * Team, homes and the build's figures were three top-level entries.
       * They are tabs here because they are all configuration rather than
       * care, and every screen keeps its own URL underneath so nothing that
       * was reachable stopped being reachable.
       */
      {
        path: 'settings',
        element: <SettingsShellRoute />,
        children: [
          { index: true, element: <TeamListRoute /> },
          { path: 'permissions', element: <PermissionMatrixRoute /> },
          { path: 'activity', element: <ActivityLogRoute /> },
          { path: 'homes', element: <GroupOverviewRoute /> },
          { path: 'figures', element: <SettingsRoute /> },
          { path: 'team/:staffId', element: <StaffDetailRoute /> },
          // Phase 23. Reached from the Settings tab, and refused by the shell
          // for anybody who does not hold `set_up_organisation`.
          { path: 'setup', element: <SetupWizardRoute /> },
        ],
      },
      { path: 'activities/:activityId', element: <AttendanceRoute /> },
      { path: 'activities/:activityId/plan', element: <PlanDrawerRoute /> },
      { path: 'incidents/new', element: <ReportIncidentRoute /> },
      { path: 'incidents/:incidentId', element: <IncidentDetailRoute /> },
      {
        // Two screens under one sidebar item: the record of what was missed,
        // and the act of recording. A layout route keeps the strip that moves
        // between them mounted, and keeps one declaration of what the module
        // contains for the reachability guard to check.
        path: 'medications',
        element: <MedicationsRoute />,
        children: [
          { index: true, element: <OmissionsRoute /> },
          { path: 'round', element: <RoundRoute /> },
          { path: 'register', element: <RegisterRoute /> },
          // The intake path: a cycle from the pharmacy, and a prescription that
          // arrived between cycles. Neither creates a prescription.
          { path: 'cycle', element: <CycleRoute /> },
          { path: 'interim', element: <InterimRoute /> },
          // Reached from a row on the register, the way a note detail is
          // reached from the timeline — not from the tab strip.
          { path: 'register/:medicationId', element: <RegisterLedgerRoute /> },
        ],
      },
      {
        // A layout route, so the subject header stays mounted across every
        // tab rather than being rebuilt by each one. §2.4.
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [
          { index: true, element: <GeneralInformationTab /> },
          { path: 'needs', element: <NeedsTab /> },
          { path: 'people', element: <ImportantPeopleTab /> },
          { path: 'future-plans', element: <FuturePlansTab /> },
          {
            // Two readings of the same drugs: what was recorded, and what was
            // prescribed. A layout route so the profile's subject header stays
            // mounted across both (§2.4).
            path: 'medications',
            element: <MedicationsTab />,
            children: [
              { index: true, element: <MarChartRoute /> },
              { path: 'prescriptions', element: <PrescriptionsTab /> },
            ],
          },
          {
            // Phase 5. The list is the tab; one assessment is reached from a
            // row, the way a note detail is reached from the timeline.
            path: 'risk-assessments',
            element: <AssessmentListTab />,
          },
          {
            // Phase 6. The domain list is the tab, the editor is reached from
            // a row, and the history from the editor. Each step is reachable
            // from the one before it — a route with no way in is not built,
            // however green its tests are (§8).
            path: 'care-plan',
            element: <CarePlanTab />,
          },
          {
            // Before the dynamic segment it would otherwise match. React
            // Router ranks static above dynamic, so the order here is for the
            // reader rather than the router — but a reader who sees
            // `:domainId` first will assume `review` is one.
            path: 'care-plan/review',
            element: <WholePlanReviewRoute />,
          },
          { path: 'care-plan/:domainId', element: <DomainEditorRoute /> },
          {
            path: 'care-plan/:domainId/history',
            element: <VersionHistoryRoute />,
          },
          {
            path: 'risk-assessments/:templateId',
            element: <AssessmentFormRoute />,
          },
          {
            // Phase 8. The tab is the list, the form is reached from it, and
            // one goal from a row — the shape the care plan tab settled.
            path: 'goals',
            element: <GoalsTab />,
          },
          { path: 'goals/new', element: <GoalFormRoute /> },
          { path: 'goals/:goalId', element: <GoalDetailRoute /> },
          {
            // Phase 10. The tab lists all eight; the gate is reached from a
            // row, and the withdrawal from a consent that has been given.
            path: 'consent',
            element: <ConsentTab />,
          },
          { path: 'consent/:consentType', element: <CapacityGateRoute /> },
          // Phase 26. Who may see this resident's updates. The consent that
          // authorises it stays on the Consent tab, which owns it.
          { path: 'family', element: <FamilyTab /> },
          { path: 'consent/:consentType/withdraw', element: <WithdrawalRoute /> },
          { path: 'documents', element: <DocumentsTab /> },
          { path: 'notes', element: <NotesTab /> },
          { path: 'notes/:noteId', element: <NoteDetail /> },
        ],
      },
      {
        // Not deleted after Phase 0. This is how the Evidence Invariant is
        // checked visually in every later review. PRD §6.1.
        path: 'dev/states',
        element: <StatesRoute />,
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
