# MSME Risk AI — Secure Authentication, Email Verification & Analyst Approval Workflow

This document details the architecture, state machines, administrative controls, and deployment instructions for the upgraded authentication and analyst approval system.

---

## 1. Architectural Overview & Roles

The platform implements backend-enforced Role-Based Access Control (RBAC) across three distinct roles:

- **`USER` (MSME Business Owner):** Can register an account and enter enterprise details. Access is granted immediately once email ownership is verified.
- **`ANALYST` (Credit Risk Analyst):** Can submit an application detailing qualifications, financial analysis experience, and institutional affiliation. Access to the Analyst Review Workspace remains locked until **both** email verification and explicit administrator approval are completed.
- **`ADMIN` (System Administrator):** Configured securely via CLI/environment variables. Has exclusive authority to approve, reject (with required reason), suspend, or reactivate analyst applications.

```
+---------------------------------------------------------------------------------------------------+
|                                  AUTHENTICATION & APPROVAL FLOW                                   |
+---------------------------------------------------------------------------------------------------+

     [ MSME User Registration ]                             [ Credit Risk Analyst Application ]
                  |                                                          |
                  v                                                          v
    (Account created via Backend)                             (Account created via Backend)
                  |                                                          |
                  v                                                          v
    [ PENDING_EMAIL_VERIFICATION ]                             [ PENDING_EMAIL_VERIFICATION ]
                  |                                                          |
   User clicks link in inbox                                  Analyst clicks link in inbox
                  |                                                          |
                  v                                                          v
    [ ACTIVE / EMAIL VERIFIED ]                                [ PENDING_ADMIN_APPROVAL ]
                  |                                                          |
      Access to /dashboard                                   Analyst sees pending review screen;
                                                             cannot access underwriting endpoints
                                                                             |
                                                            Administrator reviews dossier in
                                                            Admin Portal (/admin/analysts)
                                                                             |
                                                   +-------------------------+-------------------------+
                                                   |                                                   |
                                                   v                                                   v
                                          [ APPROVED / ACTIVE ]                                   [ REJECTED ]
                                                   |                                                   |
                                        Repeated, unlimited logins                       Applicant sees rejection
                                        to Analyst Workspace (/analyst)                  reason and contact notice
```

---

## 2. Analyst State Machine

Analyst accounts progress through the following authoritative states managed in PostgreSQL and validated by backend token claims:

| State | Email Verified | Admin Approved | Accessible Portals | API Behavior |
|---|---|---|---|---|
| `pending_email_verification` | No | No | `/verify-email` | 403: Email verification required |
| `pending_admin_approval` | Yes | No | `/verify-email` | 403: Application awaiting administrator approval |
| `approved` / `active` | Yes | Yes | `/analyst` | 200: Full underwriting access granted |
| `rejected` | Yes / No | Rejected | None | 403: Application not approved (shows reason) |
| `suspended` | Yes | Suspended | None | 403: Account currently unavailable |

### Guaranteed Repeated Logins After Approval
Once an administrator approves an analyst:
- The backend sets `approval_status = "approved"` in PostgreSQL and custom claims on Firebase.
- On every subsequent login, `/api/users/me` and the `require_analyst` dependency confirm `approval_status in ["approved", "active"]`.
- The analyst logs in and out freely without re-requesting approval.

---

## 3. Duplicate Account Detection

Before account creation, both PostgreSQL and the Firebase Authentication service are checked:
- Endpoint: `POST /api/users/check-email`
- If an account exists, registration is halted and the user is shown:
  > *"An account with this email already exists. Please sign in or reset your password."*
- Direct action buttons are provided: **Sign In Now**, **Forgot Password?**, and **Resend Verification Email**.

---

## 4. Initial Administrator Provisioning

Per enterprise security requirements, admin privileges can **never** be obtained via public registration or client-side parameters. Backdoor accounts and demo seeding have been completely disabled.

### Initial Administrator Configuration
- Environment Variables in `backend/.env`:
  ```ini
  INITIAL_ADMIN_EMAIL=jayaseelang177@gmail.com
  # Note: Do NOT store the password in plaintext in git or committed files!
  ```

### Provisioning Command (CLI)
Run the automated script in the backend virtual environment:

```powershell
cd c:\Users\unkno\Downloads\project-mini\backend
.\venv\Scripts\Activate.ps1
python scripts/provision_initial_admin.py
```

1. The script securely prompts for the administrator password using `getpass` (hidden input).
2. It validates the password security policy (min 8 characters, alphanumeric).
3. It creates or updates the Firebase user and sets the custom claim `{"role": "admin"}`.
4. It upserts the user in PostgreSQL with `role="admin"` and `approval_status="active"`.
5. It writes an immutable audit record to `audit_logs`.

---

## 5. Admin Portal: Analyst Access Requests

Located at `/admin/analysts` under the **Analyst Access Requests** tab:

1. **KPI Counters & Badge:** Displays real-time counts of pending applications, active underwriters, and review queues.
2. **Filters & Search:** Quick-filter by *All*, *Pending*, *Approved*, *Rejected*, or *Suspended*, with instant search across name, email, and institution.
3. **Application Dossier Drawer:** Inspect applicant credentials, institution, years of credit analysis experience, and specific application justification.
4. **Approve Action:** Confirmation dialog verifies intent, updates database and Firebase claims, and logs the acting admin ID.
5. **Reject Action:** Prompts for a **mandatory rejection reason**, records the decision, and surfaces the reason to the applicant.
6. **Suspension & Reactivation:** Allows administrators to temporarily revoke or reinstate an existing analyst's privileges at any time.

---

## 6. Verification & Test Execution Results

### Backend Automated Test Suite
- Test File: `backend/tests/test_auth_registration_approval.py`
  - `test_check_email_availability`: Verified duplicate account detection.
  - `test_msme_user_registration_success`: Verified enterprise user onboarding.
  - `test_analyst_registration_submits_pending_approval`: Verified analyst pending state.
  - `test_duplicate_email_registration_rejected`: Verified 409 conflict with exact prompt text.
  - `test_cannot_self_assign_admin_role_during_registration`: Verified prevention of privilege escalation.
  - `test_analyst_approval_state_machine_and_repeated_logins`: Verified approval, repeated sign-ins, suspension, and reactivation.
  - `test_rejection_requires_reason`: Verified mandatory rejection reason.
- **Full Backend Suite Status:** **64 tests passed in 24.78s (0 failures)**.

### Frontend Quality & Production Build
- `npm run lint`: **0 errors**.
- `npm run build`: **Built in 10.69s (0 errors)**.
  - Generated code-split chunks: `VerifyEmail-CT06m7UM.js`, `AdminAnalysts-LXg5GbHf.js`, `Register-Bs5lBX-U.js`.
