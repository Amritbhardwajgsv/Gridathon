"""Email helper using Resend HTTP API (works on Render free tier).
SMTP is blocked by Render — Resend sends via HTTP so no port restrictions apply.

Required env var: RESEND_API_KEY
Optional:         SMTP_FROM (display sender address, defaults to onboarding@resend.dev)
"""
import logging
import os

logger = logging.getLogger(__name__)

_ROLE_LABEL = {
    "admin":    "Command Centre Admin",
    "operator": "Field Officer / Duty Dispatch",
    "viewer":   "Police Review",
}


def _get_client():
    import resend
    key = os.getenv("RESEND_API_KEY", "")
    if not key:
        return None
    resend.api_key = key
    return resend


def _from_address() -> str:
    return os.getenv("SMTP_FROM") or "DRISHTI Ops <onboarding@resend.dev>"


# ─── New access request → notify admin ────────────────────────────────────────

def send_new_request_email(
    admin_email: str,
    applicant_name: str,
    applicant_email: str,
    badge_id: str | None,
    rank: str | None,
    unit_name: str | None,
    role: str,
) -> None:
    r = _get_client()
    if not r:
        logger.info("RESEND_API_KEY not set — new-request notification skipped.")
        return

    role_label = _ROLE_LABEL.get(role, role)
    rows = ""
    if badge_id:  rows += f"<tr><td style='padding:6px 0;color:#9ba5b3;font-size:13px;'>Badge ID</td><td style='padding:6px 0;color:#f5f7fb;font-size:13px;'>{badge_id}</td></tr>"
    if rank:      rows += f"<tr><td style='padding:6px 0;color:#9ba5b3;font-size:13px;'>Rank</td><td style='padding:6px 0;color:#f5f7fb;font-size:13px;'>{rank}</td></tr>"
    if unit_name: rows += f"<tr><td style='padding:6px 0;color:#9ba5b3;font-size:13px;'>Unit / Station</td><td style='padding:6px 0;color:#f5f7fb;font-size:13px;'>{unit_name}</td></tr>"

    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0c0f;font-family:monospace,sans-serif;color:#dce2ea;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#141820;border:1px solid #252b35;border-radius:6px;overflow:hidden;">
      <tr style="background:#0a0c0f;border-bottom:2px solid #e8a034;">
        <td style="padding:18px 28px;">
          <span style="color:#e8a034;font-weight:bold;font-size:15px;letter-spacing:3px;">DRISHTI</span>
          <span style="color:#707987;font-size:11px;margin-left:8px;">BLR-OPS · Command Centre</span>
        </td>
      </tr>
      <tr><td style="padding:32px 28px;">
        <p style="font-size:12px;color:#9ba5b3;margin:0 0 6px 0;letter-spacing:1px;text-transform:uppercase;">Action Required</p>
        <h2 style="margin:0 0 24px 0;color:#f5f7fb;font-size:22px;font-weight:600;">New access request pending review</h2>
        <table cellpadding="0" cellspacing="0" style="width:100%;background:#10141b;border:1px solid #252b35;border-radius:4px;margin-bottom:24px;padding:16px 20px;">
          <tr><td colspan="2" style="padding-bottom:8px;"><b style="color:#e8a034;font-size:13px;">Applicant details</b></td></tr>
          <tr><td style="padding:6px 0;color:#9ba5b3;font-size:13px;width:140px;">Name</td><td style="padding:6px 0;color:#f5f7fb;font-size:13px;">{applicant_name}</td></tr>
          <tr><td style="padding:6px 0;color:#9ba5b3;font-size:13px;">Email</td><td style="padding:6px 0;color:#f5f7fb;font-size:13px;">{applicant_email}</td></tr>
          {rows}
          <tr><td style="padding:6px 0;color:#9ba5b3;font-size:13px;">Role</td><td style="padding:6px 0;color:#19b7a5;font-size:13px;">{role_label}</td></tr>
        </table>
        <p style="font-size:13px;color:#9ba5b3;line-height:1.7;margin:0 0 24px 0;">
          Log in to the DRISHTI Command Centre and go to <b style="color:#f5f7fb;">Access Requests</b> to approve or reject.
        </p>
        <p style="font-size:11px;color:#505866;margin:0;border-top:1px solid #252b35;padding-top:16px;">
          Automated notification — Bengaluru Traffic Police · DRISHTI Ops
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""

    try:
        r.Emails.send({
            "from":    _from_address(),
            "to":      [admin_email],
            "subject": f"DRISHTI · New Access Request — {applicant_name} ({role_label})",
            "html":    html,
        })
        logger.info("New-request notification sent to admin %s", admin_email)
    except Exception as exc:
        logger.warning("Could not send new-request notification: %s", exc)


# ─── Approval email → notify officer ──────────────────────────────────────────

def send_approval_email(
    to_email: str,
    name: str,
    badge_id: str | None,
    role: str,
) -> None:
    r = _get_client()
    if not r:
        logger.info("RESEND_API_KEY not set — approval email skipped for %s.", to_email)
        return

    role_label = _ROLE_LABEL.get(role, role)
    badge_line = f"<tr><td style='padding:6px 0;color:#9ba5b3;font-size:13px;width:120px;'>Badge ID</td><td style='padding:6px 0;color:#f5f7fb;font-size:13px;'>{badge_id}</td></tr>" if badge_id else ""

    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0c0f;font-family:monospace,sans-serif;color:#dce2ea;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#141820;border:1px solid #252b35;border-radius:6px;overflow:hidden;">
      <tr style="background:#0a0c0f;border-bottom:2px solid #e8a034;">
        <td style="padding:18px 28px;">
          <span style="color:#e8a034;font-weight:bold;font-size:15px;letter-spacing:3px;">DRISHTI</span>
          <span style="color:#707987;font-size:11px;margin-left:8px;">BLR-OPS · Karnataka State Police</span>
        </td>
      </tr>
      <tr><td style="padding:32px 28px;">
        <p style="font-size:12px;color:#9ba5b3;margin:0 0 6px 0;letter-spacing:1px;text-transform:uppercase;">Access Request</p>
        <h2 style="margin:0 0 24px 0;color:#f5f7fb;font-size:22px;font-weight:600;">Your access has been approved</h2>
        <table cellpadding="0" cellspacing="0" style="width:100%;background:#10141b;border:1px solid #252b35;border-radius:4px;margin-bottom:24px;padding:16px 20px;">
          <tr><td style="padding:6px 0;color:#9ba5b3;font-size:13px;width:120px;">Name</td><td style="padding:6px 0;color:#f5f7fb;font-size:13px;">{name}</td></tr>
          {badge_line}
          <tr><td style="padding:6px 0;color:#9ba5b3;font-size:13px;">Role</td><td style="padding:6px 0;color:#19b7a5;font-size:13px;">{role_label}</td></tr>
        </table>
        <p style="font-size:13px;color:#9ba5b3;line-height:1.7;margin:0 0 24px 0;">
          You can now log in to the DRISHTI Command &amp; Dispatch platform. Your account is active.
        </p>
        <p style="font-size:11px;color:#505866;margin:0;border-top:1px solid #252b35;padding-top:16px;">
          Do not share your credentials. — Bengaluru Traffic Police · DRISHTI Ops
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""

    try:
        r.Emails.send({
            "from":    _from_address(),
            "to":      [to_email],
            "subject": "DRISHTI · Access Approved — Bengaluru Traffic Police",
            "html":    html,
        })
        logger.info("Approval email sent to %s", to_email)
    except Exception as exc:
        logger.warning("Could not send approval email to %s: %s", to_email, exc)


# ─── Rejection email → notify officer ─────────────────────────────────────────

def send_rejection_email(
    to_email: str,
    name: str,
    reason: str,
) -> None:
    r = _get_client()
    if not r:
        logger.info("RESEND_API_KEY not set — rejection email skipped for %s.", to_email)
        return

    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0c0f;font-family:monospace,sans-serif;color:#dce2ea;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#141820;border:1px solid #252b35;border-radius:6px;overflow:hidden;">
      <tr style="background:#0a0c0f;border-bottom:2px solid #e05252;">
        <td style="padding:18px 28px;">
          <span style="color:#e8a034;font-weight:bold;font-size:15px;letter-spacing:3px;">DRISHTI</span>
          <span style="color:#707987;font-size:11px;margin-left:8px;">BLR-OPS · Karnataka State Police</span>
        </td>
      </tr>
      <tr><td style="padding:32px 28px;">
        <h2 style="margin:0 0 16px 0;color:#f5f7fb;font-size:22px;font-weight:600;">Access request not approved</h2>
        <p style="font-size:13px;color:#9ba5b3;margin:0 0 16px 0;">Hello {name},</p>
        <div style="background:#1a0a0a;border:1px solid rgba(224,82,82,0.3);border-radius:4px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0;font-size:13px;color:#f6c5c5;">{reason}</p>
        </div>
        <p style="font-size:12px;color:#505866;margin:0;border-top:1px solid #252b35;padding-top:16px;">
          Contact the Command Centre if you believe this is an error. — Bengaluru Traffic Police · DRISHTI Ops
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""

    try:
        r.Emails.send({
            "from":    _from_address(),
            "to":      [to_email],
            "subject": "DRISHTI · Access Request Update",
            "html":    html,
        })
        logger.info("Rejection email sent to %s", to_email)
    except Exception as exc:
        logger.warning("Could not send rejection email to %s: %s", to_email, exc)
