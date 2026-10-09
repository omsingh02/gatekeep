# Voice and vocabulary

How Gatekeep speaks, in the dashboard, on recipient pages, in emails and in docs. See [PRODUCT.md](PRODUCT.md) for what the product is and [DESIGN.md](DESIGN.md) for how it looks.

### Principles
1. **Say what happened, to what, and what's next.** For example, "Removed Maya's access to Q3 deck.pdf", not "Access revoked successfully".
2. **Plain words over system words.** Write about people and files, not identifiers, grants, records or sessions.
3. **Calm and specific.** No exclamation marks, no "Oops", no blame ("you entered an invalid…").
4. **Confident about security, never theatrical.** "Only people you add can open this file." Avoid "secure!!", "military-grade" and similar.
5. **The recipient is a guest.** Recipient-facing copy assumes they don't know what Gatekeep is, and never mentions owners, admins or instances.
6. **One word per concept, everywhere.** See the glossary.

### Formatting rules

| Rule | Do | Don't |
|---|---|---|
| Sentence case for headings, buttons, labels, tabs, table headers, menu items and dialog titles | "Give access", "Download limit", "Recent activity" | "Grant New Access", "Max Downloads (Optional)", "CREATED AT" |
| Uppercase only via CSS (`text-transform`), never in the source string | `<th>Created</th>` styled uppercase | `<th>CREATED AT</th>` |
| Buttons are verb + object, and specific | "Remove access", "Delete file", "Copy invite" | "Submit", "OK", "Confirm", "Delete All" |
| No "successfully", "Please" or "Are you sure" | "Folder created" | "Folder created successfully" |
| Mark optional fields with "Optional" helper text, not "(Optional)" in the label | Label "Download limit", helper "Optional" | "Max Downloads (Optional)" |
| Use the ellipsis character "…" for in-progress states | "Uploading…" | "Uploading...", "Granting Access..." |
| American English, matching existing code and docs | organize, canceled | organise, cancelled |
| No emoji or status glyphs in text; let icons do it | (icon) "Gave access to 4 people" | "✓ Successfully granted access to 4 users" |
| Dates are absolute plus relative where useful | "Ends Oct 14 · in 6 days" | "Expires Oct 14, 07:43 AM" (in one place) vs "Expires in 6 days" (in another) |
| Numbers: digits, pluralised correctly | "1 open", "3 opens" | "1 views", "Accessed 1 times" |
| Sign in / sign out are two words (verb); the page is "Sign in" | "Sign out" | "Login", "Log in", "Sign Out" |
| Never expose internals | "Something went wrong on our side." | "Failed to generate file URL", "Session token required", "Invalid short code" |

### Glossary: one term per concept

| Concept | Use | Never |
|---|---|---|
| Person running the dashboard | **you** in the UI; **owner** in docs. Recipients see the owner's display name ("Maya Chen from Northwind") | admin, user, Admin Panel |
| Something uploaded | **file** | upload (noun), document, asset |
| Container | **folder**; the top level is **All files** | directory, Root, Home |
| Files sent to people through one link | **delivery** ("New delivery", "Deliveries", "Delivered to 3 people") | share, transfer, package, grant |
| Its URL | **link** ("Copy link") | short link, short code, share link, URL in UI |
| A named person on a delivery | **recipient** in lists; **person/people** in sentences ("Add 3 people") | user, identifier, member, viewer |
| How a recipient proves it's them | **access method**: **email code** or **password** | verification type, auth mode, OTP (except in docs) |
| The 6-digit code | **code** ("We sent a code to m•••@acme.co") | OTP, token, PIN |
| The owner's second sign-in step | **two-factor sign-in**; the code comes from an **authenticator app**; the text version of the QR code is the **setup key** | 2FA, MFA, TOTP, factor, AAL, OTP app, secret |
| Unnamed access protected by one password | **Anyone with the password** | public link, public access, public share |
| Permission in verbs | **give access**, **remove access** | grant, revoke, ACL |
| The message to a recipient | **invite** | notification, access details |
| Recipient's action to get in | **open** the delivery; **unlock** only for password entry | verify, authenticate, access |
| A successful view | **opened** ("Opened 2h ago", "12 opens") | viewed, accessed |
| A file leaving | **download**; **Download all** for the zip | export, fetch |
| When access stops | **ends** ("Access ends Oct 14", "Ended") | expires, expiration, expiry (except in docs) |
| Cap on downloads | **download limit** ("3 of 5 downloads") | max downloads, limit reached |
| Asking clients for files | **request** ("Request files", "Requests") | upload link, file drop, reverse share |
| History of events | **activity** | access log, audit log (fine in marketing/docs), analytics (only the page with charts) |
| A failed attempt | **denied**, with a human reason ("Wrong password", "Not on this delivery", "Access had ended") | no_access_grant, invalid_session |
| Owner alerts | **notifications** ("Email me when someone opens a delivery") | alerts, webhooks (until they exist) |

### Error messages

Every error says **what happened** and **what to do next**, in the user's terms:

- "That email, username or password doesn't match. Check what you were sent and try again." Not "Invalid password".
- "Your access to this delivery has ended. Ask Maya Chen for a new invite." Not "Access expired".
- "We couldn't upload contract.pdf. Check your connection and try again." Not "Upload failed: 500".

Never show internal names (tokens, sessions, short codes, database fields) or vendor messages verbatim.
