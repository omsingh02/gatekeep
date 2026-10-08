# Gatekeep: product definition

> **Secure file delivery with receipts.**
> Send it. See who opened it. Take it back.

Gatekeep is a self-hosted, open-source product for people who send files that matter to people outside their organization. Every recipient gets their own access, every open and every denied attempt is on the record, and access can be taken back at any moment. That includes access mid-session.

## Who it's for

People and small teams who send **sensitive deliverables to clients**, and who need to know they arrived in the right hands:

- **Agencies and studios** delivering designs, footage and campaign assets
- **Consultants and freelancers** sending reports, proposals and contracts
- **Legal, finance, accounting and HR** sharing statements, contracts, payroll and case files
- **Anyone self-hosting** because the files shouldn't sit with a third party

### Two people use Gatekeep

| | Owner | Recipient |
|---|---|---|
| Who | The person running the instance and sending files | A client or colleague receiving them |
| Wants | Send quickly; know it was received; stay in control | Get the files without creating an account |
| Sees | The dashboard | A delivery page with the sender's name, then the files |
| Never sees | — | The words admin, owner, instance, grant or session |

## What makes it different

Most file-sharing links are **bearer links**: anyone holding the URL (and maybe one shared password) gets in, and the sender learns nothing. Gatekeep is built around **named recipients**:

1. **Each person has their own access.** Recipients prove who they are with a one-time code sent to their email, or with their own password. Access can be removed for one person without affecting anyone else.
2. **Receipts, not guesses.** Every open, preview, download and denied attempt is recorded with the person, time, IP and reason. The owner gets notified when it matters.
3. **Control after sending.** Set an end date and a download limit, or remove access at any time. Removing access ends an open session immediately.
4. **Yours.** It's self-hosted on your own Supabase and Vercel (or Docker), branded with your name, and MIT-licensed.

## Core objects

| Object | What it is |
|---|---|
| **File** | Something you uploaded. Files live in folders and are private until you deliver them. |
| **Delivery** | One or more files sent to one or more recipients through one link, with a title and an optional message. It's the unit you share, track and revoke. |
| **Recipient** | A person on a delivery, identified by email or username, with their own access method, end date and download limit. |
| **Anyone with the password** | Optional access to a delivery for people you don't name, protected by one password. |
| **Request** | A link that lets recipients upload files to you, with the same access controls. Uploaded files land in a folder you choose. |
| **Activity** | The record of everything that happened: opened, downloaded, denied (and why), code sent, uploaded, access removed. |

## Access methods

The owner chooses per recipient. **Email code is the default and the recommendation.** See [ACCESS-METHODS.md](ACCESS-METHODS.md).

- **Email code (recommended):** the recipient opens the link, gets a 6-digit code at their email address and is in. There are no passwords to create, send or lose, and it proves they control that inbox.
- **Password:** you set a password and send it separately. Use it when the recipient has no email address, when this instance can't send email, or when you deliberately want the secret on a second channel.

## Principles

1. **The recipient is a guest.** No accounts, no jargon, no dead ends. Every error says what to do next.
2. **Secure by default, not by configuration.** Owner-only dashboard, per-recipient access, no secrets in emails, nothing revealed before identity is proven.
3. **Every action leaves a receipt.** If it happened, it's in the activity log, and the owner can find it.
4. **Calm and consistent.** One design system ([DESIGN.md](DESIGN.md)), one vocabulary ([VOICE.md](VOICE.md)) and one way to do each thing.
5. **Self-hosting is a first-class experience**, not an afterthought. Setup is documented, defaults are safe, and a status page tells you what's misconfigured.

## What it is not

- Not a cloud drive or sync client: files aren't edited or synced.
- Not a team collaboration suite: there's one owner per instance (teams may come later).
- Not anonymous file dropping. Every recipient is either named or holds the password.

## v2 scope

| Area | Included |
|---|---|
| Foundation | Gatekeep Mono design system; one vocabulary; accessible components; monochrome brand |
| Deliveries | Many files per delivery; recipients per delivery; Download all (zip); delivery page for recipients |
| Access | Email code or password per recipient; "Which should I use?" helper; anyone-with-the-password access |
| Receipts | Activity feed with filters and CSV export; email notifications to the owner (opened, downloaded, denied) |
| Requests | Request links for receiving files, with the same access controls |
| Account and settings | Display name and organization (shown to recipients), branding, sharing defaults, notifications, change and reset password, system status |
| Emails | A light, consistent template: invite (no secrets), code, owner notifications, access ending, password reset |
| Self-hosting | Owner-only access, a branded instance homepage, a migration path from v1 links |

Later: delivery certificates, watermarked view-only previews, resumable large uploads, multiple owners and SSO, webhooks.
