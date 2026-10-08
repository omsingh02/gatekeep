# Email code or password?

When you add someone to a delivery, you choose how they prove it's them. **Use an email code unless one of the cases below applies.**

## Email code (recommended)

The recipient opens your link and enters their email address. Gatekeep sends a 6-digit code to that address, valid for 10 minutes. They enter it and they're in.

**Why it's the default**
- There's no password to make up, send or lose.
- It proves the person controls that email address, so the activity log names a verified person.
- Nothing secret travels in the invite. A forwarded invite is useless without access to the inbox.
- Recipients can come back later on any device. They just request a new code.

**Requires:** email sending is configured (`RESEND_API_KEY` and `EMAIL_FROM`). Without it, the option is unavailable and Gatekeep says why.

## Password

You set a password for the recipient and give it to them yourself.

**Use a password when:**
1. **The recipient has no email address you can use.** You only know them by a username, or their mail is filtered so codes arrive late or not at all.
2. **This instance can't send email.** Email sending isn't configured, and you don't want to set it up.
3. **You want a second channel on purpose.** For very sensitive files, you send the link by email and the password another way (in person, by phone or by text message). Someone who gets into the recipient's inbox then still doesn't have both.
4. **It's "anyone with the password" access.** It's not tied to a person, so there's no inbox to send a code to.

**Rules that keep passwords safe**
- Each recipient gets their own password. Gatekeep generates one, and you can change it.
- **The password is never put in the invite email.** Copy it from the invite panel and send it on a different channel.
- At least 8 characters. Repeated wrong attempts are throttled.

## Quick guide

| Situation | Use |
|---|---|
| You know the recipient's email (most cases) | **Email code** |
| The recipient only has a username, or can't receive email | Password |
| Email sending isn't set up on this instance | Password |
| Very sensitive file, and you want the secret on a second channel | Password (send it by phone or in person) |
| You don't know who will open it (share with a group) | Anyone with the password |

## The "Which should I use?" helper

The same decision appears in the product as a short interactive helper: in the FAQ on the website, and as "Help me choose" in the share dialog. It asks at most three questions:

1. **Do you know each recipient's email address?** If no, use a password.
2. **Can this Gatekeep send email?** If no, use a password, and here's how to set email up. The dashboard answers this automatically from the system status.
3. **Do you want the secret to travel on a different channel than the link?** If yes, use a password and send it separately. If no, use an email code.

The result is a single recommendation with one sentence explaining why, and a button to apply it.
