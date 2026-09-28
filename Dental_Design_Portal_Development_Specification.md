# Dental Design Portal — Development Specification

## 1. Project Overview

Build a secure web application for a dental design service. Dental laboratories and dental practices must be able to create accounts, submit digital dental-design cases, upload large case files, follow progress, communicate with the design team, review completed work, download deliverables, and access invoices.

The internal design team must have a separate admin panel to receive cases, review files, assign work, update progress, request information, upload design versions, complete cases, and manage billing.

This is not a simple contact form. It is a case-management portal with a complete history for every client and every case.

### Primary goal

Replace scattered email and file-transfer workflows with one secure, trackable system from case submission to final delivery and invoicing.

### Core product principles

- Simple enough for a busy dental practice or laboratory to use without training.
- Every action, file, message, status change, and payment record belongs to a case.
- Clients can see progress without contacting the design team.
- Admin staff can manage the full workload from one dashboard.
- Files are private and only available to authorised users.
- The system keeps a reliable audit trail.
- Desktop-first for design staff, fully responsive for clients on mobile and tablet.

---

## 2. User Types and Permissions

### 2.1 Client organisation

A client organisation can be either:

- Dental laboratory
- Dental practice / dentist office

Each organisation has its own account and can contain more than one user.

### 2.2 Client Owner

The first approved user for an organisation becomes the Client Owner.

Permissions:

- Manage organisation details.
- Invite, edit, deactivate, and remove organisation users.
- Submit and edit cases before processing begins.
- View all cases belonging to the organisation.
- Upload files and send case messages.
- Download previews and completed files.
- Approve designs or request revisions.
- View statements and download invoices.
- View organisation activity relevant to their cases.

### 2.3 Client Staff

Permissions are configurable by the Client Owner:

- Submit cases.
- View only their own cases or all organisation cases.
- Upload and download case files.
- Comment and respond to requests.
- Approve work, if granted.
- View billing, if granted.

### 2.4 Designer / Production Staff

Permissions:

- View cases assigned to them.
- Review files and update production statuses.
- Add internal notes that clients cannot see.
- Send client-visible messages.
- Upload previews and completed deliverables.
- Record time or work completed if this feature is enabled.
- Cannot change global billing or user permissions unless granted separately.

### 2.5 Admin

Permissions:

- View and manage all clients, cases, files, messages, prices, invoices, and staff.
- Assign and reassign cases.
- Change case status, priority, due date, and billing details.
- Manage service types and prices.
- Upload deliverables and release them to clients.
- Generate invoices and statements.
- Manage notification templates and system settings.
- View audit logs and operational reports.

### 2.6 Super Admin

Has full Admin access plus:

- Create, edit, suspend, and delete internal staff accounts.
- Configure permissions and roles.
- Manage system-level settings, integrations, storage rules, and retention policies.
- Correct protected records with a mandatory audit reason.

---

## 3. Authentication and Account Onboarding

### Client registration

Registration fields:

- Organisation type: Dental Laboratory or Dental Practice
- Organisation name
- Registration / company number (optional)
- VAT / tax number (optional)
- Primary contact name
- Email address
- Phone number
- Billing email address
- Country
- Billing address
- Preferred currency
- Preferred language (future-ready)
- Password
- Acceptance of Terms, Privacy Policy, and data-processing terms

### Recommended onboarding process

1. User registers and verifies their email address.
2. Account enters `Pending Approval` if manual approval is enabled.
3. Admin approves the organisation.
4. The Client Owner completes organisation and billing details.
5. Client reaches the dashboard and can submit the first case.

### Authentication requirements

- Secure email and password login.
- Email verification.
- Forgot-password and password-reset flow.
- Optional or required two-factor authentication, configurable by role.
- Session management and logout from all devices.
- Rate limiting and temporary lockout after repeated failed attempts.
- Separate `/portal` and `/admin` entry points.
- Admin accounts must use two-factor authentication.
- Never allow public registration to create an Admin account.

---

## 4. Client Portal

### 4.1 Client dashboard

The dashboard must give the client a clear operational summary.

Example greeting:

> Welcome, Smile Dental Lab

Dashboard components:

- Primary `Submit New Case` button.
- Cases requiring client action.
- Open Cases count.
- Due Soon count.
- Awaiting Feedback count.
- Completed This Month count.
- Outstanding Balance, if billing is enabled.
- Recent cases with case number, patient initials, case type, due date, status, and progress.
- Recent notifications.
- Quick links to files, invoices, organisation users, and support.

Do not expose one client organisation's information to another organisation under any circumstances.

### 4.2 Cases list

Allow clients to:

- Search by portal case number, client case number, patient initials, dentist, or keyword.
- Filter by status, case type, date submitted, due date, priority, and assigned clinic or branch.
- Sort by newest, oldest, due date, and status.
- View active, completed, archived, and cancelled cases.
- Export a permitted case list to CSV or PDF in a later phase.

Table or card fields:

- Portal case number
- Client case number
- Patient initials
- Case type
- Submitted date
- Due date
- Current status
- Priority
- Latest activity
- Action required indicator

### 4.3 Case detail page

Each case has one permanent record with the following sections:

#### Case summary

- Portal case number
- Client case number
- Patient initials or approved de-identified reference
- Organisation
- Dentist / clinician
- Case type and requested service
- Software used
- Submitted date
- Requested due date
- Confirmed due date
- Priority
- Current status
- Assigned designer, if the business chooses to display this
- Revision count
- Billing status

#### Progress tracker

Display a clear visual timeline using client-friendly milestones:

1. Submitted
2. Under Review
3. In Design
4. Client Review, when required
5. Quality Check
6. Completed
7. Delivered

Show the current stage, completed stages, dates, and any action required from the client. Internal sub-statuses do not need to be shown to the client.

#### Case activity

Chronological activity feed containing:

- Submission confirmation
- Status changes
- Due-date changes
- Messages
- File uploads
- Preview releases
- Approval or revision requests
- Final file release
- Invoice creation and payment status

Client-visible and internal-only activities must be clearly separated by permissions.

#### Messages

- Case-specific conversation thread.
- Attachments supported.
- Client and admin can reply without starting a separate email chain.
- Email notifications link the user back to the secure case; sensitive attachments must not be included directly in email.
- Internal notes are visible only to authorised staff.

#### Files

Group files by purpose rather than showing one long list:

- Original Client Uploads
- Additional Information
- Design Previews
- Revision Files
- Final Deliverables
- Reports and Instructions

Each file displays:

- Original filename
- File type
- File size
- Version number
- Uploaded by
- Uploaded date and time
- File purpose
- Download availability
- Malware-scan state

Files uploaded after submission must not silently replace earlier files. Keep versions and mark the current version.

#### Approval and revisions

When a preview requires approval, the client can choose:

- `Approve Design`
- `Request Changes`

A revision request requires a written description and may include files or annotated images. Approval must record the user, date, time, approved version, and optional comment.

---

## 5. Submit a Case

Use a multi-step form with autosave. A client can save a draft and return later. Show upload progress and retain completed uploads if a later validation step fails.

### Step 1 — Client and laboratory information

Prefill known organisation data from the logged-in account.

- Organisation name
- Contact person
- Email address
- Phone number
- Branch / location, if applicable
- Purchase order number (optional)

### Step 2 — Patient and clinical reference

- Patient initials or de-identified patient reference
- Client laboratory case number
- Dentist / clinician name (optional)
- Practice name (optional)
- Upper, lower, or both arches
- Tooth numbers / region, where relevant

Avoid requesting a full patient name unless there is a clearly documented operational and legal need.

### Step 3 — Service and case details

Primary Case Type dropdown:

- Complete Denture
- Immediate Denture
- Partial Denture
- Implant Overdenture
- Rebase
- Repair
- Other

The Admin must be able to add, edit, price, activate, deactivate, and reorder case types without a code change.

Conditional case fields can include:

- Arch selection
- Design stage required
- Tooth setup details
- Implant system
- Material preference
- Shade
- Occlusion instructions
- Special requirements
- `Other` description

Only show fields relevant to the selected case type.

### Step 4 — Software and source data

Checkboxes:

- exocad
- 3Shape
- Other

If `Other` is selected, require its name and optional version.

### Step 5 — Dates and priority

- Requested due date
- Standard or Rush priority
- Optional reason for urgency

The requested date is not automatically guaranteed. Admin can confirm or propose a different due date. Rush service availability and fee must be configurable.

### Step 6 — Upload source files

Allow multiple files and drag-and-drop folder upload where supported.

Accepted file types can include:

- STL
- PLY
- OBJ
- 3MF
- DCM / DICOM package
- ZIP
- JPG / JPEG / PNG / HEIC photos
- Bite scans
- PDF

Requirements:

- File types, maximum individual size, total case size, and file count must be configurable.
- Support large, resumable uploads and clear per-file progress.
- Validate both file extension and MIME/content type.
- Run uploaded files through malware scanning before making them available.
- Store files privately, never in a public folder.
- Preserve the original filename but generate a safe internal storage key.
- Allow the uploader to label each file, such as Upper Scan, Lower Scan, Bite Scan, Photo, or Instructions.
- Clearly show upload failures and allow retry without restarting the form.

### Step 7 — Notes and confirmation

- Large notes field
- Optional acknowledgment that the submitted information is complete and de-identified where required
- Review all information and uploaded files before final submission
- Submit button must prevent accidental duplicate submission

### On successful submission

1. Generate a unique case number, for example `CAD-2026-00125`.
2. Save the form, uploads, submitting user, and timestamps.
3. Set status to `New` / client-facing `Submitted`.
4. Create the first case activity event.
5. Send a confirmation email to the submitting user and selected organisation contacts.
6. Notify the Admin team inside the application and by email.
7. Display a success screen linking to the new case.

Confirmation email should include:

- Case number
- Client case number
- Case type
- Submission date
- Requested due date
- A secure link to view the case

Do not attach sensitive case files to confirmation emails.

---

## 6. Status Model and Workflow

Use controlled statuses, not free text. Every status change must be time-stamped and added to the audit trail.

### Internal statuses

- Draft
- New
- In Review
- Information Required
- Accepted
- Scheduled
- Designing
- Preview Ready
- Awaiting Client Feedback
- Revision Requested
- Revising
- Quality Check
- Completed
- Delivered
- On Hold
- Cancelled
- Archived

### Recommended client-facing labels

| Internal status | Client-facing status | Client action |
|---|---|---|
| New / In Review | Under Review | None |
| Information Required | Information Required | Reply or upload files |
| Accepted / Scheduled | Accepted | None |
| Designing / Revising | In Design | None |
| Preview Ready / Awaiting Client Feedback | Client Review | Approve or request changes |
| Quality Check | Quality Check | None |
| Completed | Completed | Final checks or payment rules apply |
| Delivered | Delivered | Download files |
| On Hold | On Hold | Read reason and respond if requested |
| Cancelled | Cancelled | None |

### Main workflow

1. Client submits a case.
2. System generates the case number and confirms receipt.
3. Admin reviews case details and file completeness.
4. If information is missing, Admin requests it and the case enters `Information Required`.
5. Admin accepts the case, confirms the due date, sets priority, and assigns a designer.
6. Designer starts work and status changes to `Designing`.
7. If client approval is required, staff upload a preview and set `Awaiting Client Feedback`.
8. Client approves or requests changes.
9. Approved work enters `Quality Check`.
10. Staff upload final files and complete the case.
11. Final files are released according to the billing rules.
12. Client is notified and downloads the files.
13. Invoice is generated or the completed case is added to the monthly statement.
14. Case is eventually archived but remains searchable according to the retention policy.

### Important workflow rules

- Admin must be able to return a case to an earlier valid stage with a mandatory reason.
- A cancelled case remains in the audit history and is not hard-deleted.
- Completing a case does not automatically release files if payment-before-download is enabled.
- A revision creates a new design version; it does not overwrite the approved or previous version.
- Any status that requires client action must create a prominent notification.
- Overdue cases and cases due soon must be visually flagged.

---

## 7. Admin Panel

The Admin panel must be separate from the client interface and optimised for processing many cases efficiently.

### 7.1 Admin dashboard

Display:

- New cases today
- Unreviewed cases
- Cases requiring information
- Due today
- Due within the next 3 days
- Overdue cases
- Awaiting client feedback
- In quality check
- Completed today / this month
- Workload by designer
- Cases by status and priority
- Outstanding invoices or unbilled completed cases
- Recent activity and system alerts

### 7.2 Case management board

Provide both:

- Filterable table view for detailed administration.
- Kanban view grouped by status for production management.

Columns and filters:

- Case number
- Client organisation
- Client case number
- Patient initials
- Case type
- Assigned designer
- Received date
- Confirmed due date
- Status
- Priority
- Client action required
- Revision count
- Billing status
- Latest activity

Support saved filters such as `My Cases`, `Rush`, `Due Today`, `Unassigned`, `Waiting on Client`, and `Overdue`.

### 7.3 Admin case workspace

Admins and designers must be able to:

- Review all submitted details.
- Preview supported images and PDFs in the browser.
- Download source files individually or as a controlled ZIP package.
- Confirm file completeness.
- Set or change status, priority, confirmed due date, and assignment.
- Add internal notes.
- Send client-visible messages.
- Request missing information or replacement files.
- Upload design previews and final deliverables.
- Mark whether a file is internal, preview-only, or client-downloadable.
- Create file versions and release only the intended version.
- Record quality-control completion and reviewer.
- Approve the case for delivery.
- Add or adjust billable line items.
- Generate or associate an invoice.
- View the complete audit history.

### 7.4 Client management

Admin can:

- Search and view all client organisations.
- View organisation profile, users, cases, invoices, and activity.
- Approve, suspend, or reactivate an organisation.
- Add internal client notes.
- Set default currency, payment terms, price list, tax treatment, and download rules.
- Set organisation-specific pricing or discount rules.
- Impersonation should be avoided. If implemented for support, it must require elevated permission, display a permanent warning banner, and be fully audited.

### 7.5 Team and workload management

- Create designers and admin users.
- Assign roles and granular permissions.
- Show active case count and upcoming due dates per designer.
- Allow reassignment with a recorded reason.
- Optional capacity settings and automatic assignment in a later phase.

---

## 8. File Delivery and Version Control

### Final deliverable types

- STL
- 3MF
- OBJ or other enabled design formats
- Design report
- PDF instructions
- Images / previews
- ZIP package

### Delivery rules

- Final files are uploaded to the case, assigned a version, and explicitly released.
- Releasing files changes the case to `Delivered` only when all required delivery conditions are met.
- Client receives an in-app notification and an email containing a secure portal link.
- Downloads use short-lived authorised URLs; never expose permanent public links.
- Log who downloaded which file, with date and time.
- Admin can replace an incorrectly released deliverable by creating a new version and withdrawing the old version without deleting its audit record.
- Optional setting: prevent final download until payment is confirmed.
- Optional setting: package selected final files into one download.

---

## 9. Billing and Invoices

Billing must support either per-case invoicing or monthly consolidated invoicing per client.

### Price configuration

Admin can configure:

- Service / case type
- Base price
- Currency
- Tax rate
- Rush surcharge
- Included revision count
- Additional revision fee
- Organisation-specific price list or discount
- Effective-from date, so historical invoices do not change when pricing changes

### Case billing

Each case can contain billable line items:

- Service name
- Description
- Quantity
- Unit price
- Discount
- Tax
- Total

### Invoice flow

1. A completed case becomes ready to bill.
2. Admin reviews or confirms billable items.
3. System creates an individual invoice or adds the case to the client's monthly draft invoice.
4. Admin finalises the invoice.
5. Client receives a notification and can download a PDF invoice.
6. Payment state can be marked manually or updated through a future payment integration.

### Client billing area

Show:

- Current balance
- Draft / pending monthly charges
- Invoice number
- Invoice period and date
- Due date
- Amount
- Currency
- Status: Draft, Issued, Partially Paid, Paid, Overdue, Voided
- PDF download
- Related cases

Example monthly statement:

| Case | Service | Amount |
|---|---|---:|
| CAD-2026-00125 | Complete Denture | €55.00 |
| CAD-2026-00126 | Immediate Denture | €70.00 |
| CAD-2026-00127 | Partial Denture | €60.00 |
|  | **Total** | **€185.00** |

All financial values must be stored as integer minor units, such as cents, with an explicit currency code. Never use floating-point values for money.

---

## 10. Notifications and Automation

Support in-app and email notifications. SMS or WhatsApp can be considered later but must not be required for the first release.

### Notification events

- Account created / email verification
- Organisation approved or suspended
- Case submitted
- Case accepted and due date confirmed
- Information required
- New case message
- Case assigned to a designer, internal only
- Design started
- Preview ready
- Client approved design
- Client requested revision
- Case completed
- Files released
- Invoice issued
- Payment received
- Due date changed
- Case is due soon or overdue, internal alert

### Automation sequence

```text
Client submits case
→ Case number generated
→ Files securely stored and scanned
→ Confirmation sent
→ Admin reviews case
→ Designer assigned
→ Design begins
→ Preview and approval, when required
→ Quality check
→ Final files uploaded and released
→ Client notified
→ Invoice generated or case added to monthly billing
```

### Notification preferences

Users can choose which non-essential notifications they receive. Security, account, payment, and action-required messages cannot be fully disabled.

Notifications must be idempotent: retrying a background job must not send the same email or create the same invoice twice.

---

## 11. Search, Reporting, and Audit Trail

### Global admin search

Search by:

- Portal case number
- Client case number
- Organisation
- Patient initials / reference
- Dentist / clinician
- Invoice number
- Filename

### Reports

Initial reports:

- Cases received by day, week, or month
- Cases completed by period
- Average turnaround time
- On-time completion rate
- Cases by type
- Revision rate by type or client
- Workload by designer
- Revenue by month, client, and service
- Outstanding invoices
- Storage usage by client

### Audit trail

Record append-only events for:

- Login and relevant security events
- Case creation and field changes
- Status and due-date changes
- Assignments
- File uploads, releases, withdrawals, and downloads
- Messages and internal notes
- Approvals and revision requests
- Invoice changes and payment updates
- User, role, and permission changes

Each audit event should contain the actor, action, target, timestamp, and relevant before/after values. Do not expose security-sensitive audit details to ordinary client users.

---

## 12. Data Model

Use a relational database. Suggested core entities:

### Users

- id
- email
- name
- phone
- authentication state
- two-factor state
- last login
- created_at / updated_at

### Organisations

- id
- type: laboratory or practice
- name
- registration number
- tax number
- contact and billing details
- country
- default currency
- price list
- payment terms
- account status
- created_at / updated_at

### Organisation Memberships

- user_id
- organisation_id
- role
- granular permissions
- status

### Cases

- id
- generated case number
- organisation_id
- submitted_by
- client case number
- patient initials / de-identified reference
- dentist / clinician
- case type
- case-specific structured fields
- software used
- requested due date
- confirmed due date
- priority
- internal status
- client-facing status
- assigned staff member
- submission, completion, and delivery timestamps
- billing status
- archived_at

### Case Files

- id
- case_id
- uploader_id
- file category
- original filename
- private storage key
- MIME type
- size
- checksum
- malware scan status
- version number
- parent file / version group
- visibility
- release state and released_at
- created_at

### Case Messages

- id
- case_id
- author_id
- message body
- visibility: client or internal
- created_at / edited_at

### Case Activities

- id
- case_id
- actor_id or system actor
- event type
- client-visible summary
- internal metadata
- created_at

### Approvals and Revisions

- id
- case_id
- design version
- action: approved or changes requested
- user_id
- comment
- created_at

### Services and Price Lists

- service_id
- service name
- active state
- case form configuration
- price list and effective dates

### Invoices and Invoice Items

- invoice id and number
- organisation_id
- currency
- issue and due dates
- status
- subtotal, tax, total, and paid values in minor units
- invoice line items linked to cases where applicable
- PDF storage reference

### Notifications

- user_id
- type
- title and summary
- related case or invoice
- read_at
- delivery status

### Audit Events

- actor_id
- organisation_id, if applicable
- action
- resource type and id
- before and after metadata
- IP / session metadata where legally appropriate
- created_at

All organisation-owned records must carry an organisation relationship and be protected by server-side tenant isolation.

---

## 13. Security, Privacy, and Compliance

This portal may process dental case data and potentially personal information. Build privacy and security into the architecture from the beginning.

### Required controls

- Encrypt data in transit and at rest.
- Enforce server-side role-based access control on every protected operation.
- Use database-level tenant isolation where supported.
- Use private object storage with short-lived signed download links.
- Never rely only on hidden buttons or frontend checks for authorisation.
- Require two-factor authentication for Admin users.
- Scan uploads for malware and quarantine failed or pending files.
- Validate file content, size, and extension.
- Store secrets only in secure environment variables.
- Protect authentication and upload endpoints with rate limiting.
- Use CSRF protection where relevant and secure cookie settings.
- Log critical actions without logging passwords, file contents, or unnecessary health information.
- Back up database records and files and test restoration.
- Define retention periods and a secure deletion process.
- Provide data export and deletion workflows subject to legal retention obligations.
- Avoid placing patient names or clinical details in email subject lines and notification previews.
- Use generic portal links in email; require authentication to view case details or files.

### Privacy approach

- Collect the minimum patient information needed to perform the design service.
- Prefer initials or a client-generated case reference instead of full patient identity.
- Obtain professional legal advice to confirm applicable requirements, including POPIA for South African users and GDPR where EU personal data is processed.
- Do not market the platform as compliant with a specific healthcare law until the deployment, hosting, contracts, operating procedures, and technical controls have been formally assessed.

---

## 14. Recommended Technical Architecture

Claude may select equivalent technologies, but the implementation must support secure multi-tenant access and large file handling.

### Suggested stack

- Frontend and server: Next.js with TypeScript
- UI: Tailwind CSS plus an accessible component system
- Database: PostgreSQL
- Authentication: managed authentication with email verification, MFA, and secure sessions
- File storage: private S3-compatible object storage or equivalent
- Background jobs: reliable queue for email, file scanning, ZIP creation, invoice generation, and automation
- Email: transactional email provider with delivery logs
- PDF generation: server-side invoice templates
- Error monitoring and structured application logs

Supabase can provide PostgreSQL, authentication, row-level security, and storage for an MVP. For high-volume dental scan files, evaluate storage and egress costs before launch; large files may be better stored in dedicated S3-compatible object storage while keeping file metadata in PostgreSQL.

### Architecture requirements

- Client uploads should go directly to private object storage through authorised multipart or resumable upload sessions instead of passing large files through the web server.
- Server must verify that an authenticated user belongs to the case organisation before creating an upload session or download link.
- Background processes must be retry-safe.
- Separate development, staging, and production environments.
- Use database migrations and seed data.
- Use immutable identifiers internally; display generated human-friendly case and invoice numbers separately.
- Store timestamps in UTC and render them in the user's configured timezone.

---

## 15. UX and Visual Direction

### Overall direction

Create a modern, premium clinical interface: clean, calm, precise, and trustworthy. Use generous whitespace, strong information hierarchy, subtle depth, and restrained dental/medical visual cues. Avoid cartoon teeth, excessive gradients, and a generic Wix-dashboard appearance.

### Interface priorities

- The current case status and required next action must always be obvious.
- Use clear labels rather than unexplained icons.
- Use colour as a supporting status signal, never as the only signal.
- Keep case numbers easy to copy.
- Make large file upload progress impossible to miss.
- Confirm high-impact actions such as cancelling a case, releasing files, approving a design, or finalising an invoice.
- Provide useful empty states and error recovery.
- Meet WCAG 2.2 AA accessibility targets.
- Use responsive tables that become structured cards on small screens.

### Suggested navigation

Client portal:

- Dashboard
- Cases
- Submit New Case
- Files
- Billing
- Notifications
- Team
- Organisation Settings
- Support

Admin panel:

- Dashboard
- Cases
- Production Board
- Clients
- Team
- Billing
- Reports
- Notifications
- Audit Log
- Settings

---

## 16. Validation and Business Rules

- A submitted case must contain an organisation, client case number, patient reference, case type, requested due date, notes or required case details, and at least one required source file.
- Portal case numbers are unique and cannot be edited.
- Client case numbers need only be unique within the relevant client organisation unless configured otherwise.
- A due date cannot be confirmed in the past.
- Only authorised Admin roles can change confirmed due dates or prices after acceptance.
- Client edits after acceptance must create a change request or audited amendment; they must not silently alter production information.
- Final files cannot be released while malware scanning is pending or failed.
- A case cannot be marked Delivered unless at least one client-downloadable final file has been released, unless an Admin records an approved exception.
- Approval applies to an exact design version.
- Invoice totals are calculated by the server, not trusted from browser input.
- Deleted users do not remove their historical actions.
- Use soft deletion or archival for business records that must remain in the audit history.

---

## 17. MVP Scope — Launch First

Build the first production-ready release with:

- Client registration, login, email verification, and organisation approval.
- Client Owner and Client Staff roles.
- Admin and Designer roles.
- Client dashboard.
- Multi-step case submission with draft autosave.
- Large multi-file upload with private storage and progress.
- Automatic case-number generation.
- Client case list and detailed case record.
- Admin dashboard and filterable case table.
- Case assignment, priority, due date, and controlled statuses.
- Client messages and internal notes.
- File categories and basic version history.
- Preview approval and revision request workflow.
- Final file upload, release, and secure download.
- In-app and email notifications.
- Basic per-case billing fields and downloadable PDF invoices.
- Search and basic operational reporting.
- Audit trail.
- Responsive, accessible interface.

Do not build the MVP as disconnected static screens. All core actions must read from and write to the real data model with proper authorisation.

---

## 18. Later Phases

### Phase 2

- Monthly consolidated invoicing and statements.
- Online payments.
- Organisation-specific price lists and credit limits.
- Advanced reports and exports.
- Staff workload and capacity planning.
- Configurable case forms by service type.
- Saved views and bulk case actions.
- File preview improvements and annotations.

### Phase 3

- API integrations with dental laboratory or practice systems.
- Single sign-on for larger clients.
- Automated file validation for supported dental formats.
- SLA rules and escalation automation.
- Client branding or white-labelling.
- Multi-language interface.
- Multiple business entities, tax regions, and invoice sequences.
- Secure mobile push notifications.

---

## 19. Acceptance Criteria

The product is ready for its first controlled launch when:

1. A new dental laboratory or practice can register and be approved.
2. Its users can log in and cannot access another organisation's records or files.
3. A client can save a draft, upload large files, submit a case, and receive a case number and confirmation.
4. Admin can review, assign, prioritise, schedule, and update the case.
5. Missing information can be requested and supplied inside the case.
6. A designer can upload a preview and a client can approve it or request a revision.
7. Admin can upload and release final files securely.
8. The client can download authorised deliverables and the download is logged.
9. A billable case can produce a correct, downloadable invoice.
10. Status changes, approvals, important edits, and file actions appear in the audit trail.
11. Email retries do not create duplicate messages, cases, or invoices.
12. Core workflows pass desktop, tablet, mobile, permission, accessibility, and security testing.

---

## 20. Build Instructions for Claude

1. Begin by producing the database schema, permission matrix, route map, and component map.
2. Implement authentication and organisation isolation before case-management features.
3. Use reusable components and strict TypeScript types.
4. Build server-side validation for every mutation, even when the frontend already validates it.
5. Create a clear service layer for cases, files, messages, notifications, and invoices.
6. Keep status transitions in one controlled workflow module rather than scattering them across UI components.
7. Use transactions for multi-record actions such as submitting a case or finalising an invoice.
8. Add idempotency protection to case submission, notifications, file release, and invoice generation.
9. Include loading, empty, success, and error states for every main screen.
10. Seed realistic demo data for at least two client organisations and verify that neither can access the other's information.
11. Add automated tests for permissions, case transitions, uploads, approvals, delivery, and invoice totals.
12. Do not use placeholder buttons for MVP functionality. If a later-phase feature is visible, label it clearly as unavailable or omit it.
13. Never use real patient information in seed data, screenshots, logs, or tests.
14. Provide setup instructions, environment-variable documentation, migration commands, test commands, and deployment guidance.

---

## 21. Final Product Outcome

The finished platform must provide one reliable flow:

```text
Client login
→ Submit and upload case
→ Automatic case number and confirmation
→ Admin review and assignment
→ Design and case communication
→ Preview approval or revision
→ Quality check
→ Secure final-file release
→ Client download
→ Invoice or monthly statement
→ Searchable long-term case record
```

The client should always know what is happening, what is required from them, and where to find their files. The internal team should always know what is new, assigned, blocked, due, overdue, awaiting feedback, ready for quality control, completed, and ready to bill.
