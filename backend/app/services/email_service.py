"""Thin email helper. Sends via SMTP if configured; silently logs otherwise."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_smtp_config

logger = logging.getLogger(__name__)

def _smtp_send(cfg: dict, to_email: str, msg: MIMEMultipart) -> None:
    with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as smtp:
        smtp.ehlo()
        if cfg.get("use_tls", True):
            smtp.starttls()
            smtp.ehlo()
        # Strip display-name wrapper so login only gets the bare address
        user = cfg.get("user", "")
        password = cfg.get("password", "")
        if user and password:
            smtp.login(user.strip(), password.strip())
        smtp.sendmail(cfg["from"], [to_email], msg.as_string())


_ROLE_LABEL = {
    "admin": "Command Centre Admin",
    "operator": "Field Officer / Duty Dispatch",
    "viewer": "Police Review",
}


def send_approval_email(
    to_email: str,
    name: str,
    badge_id: str | None,
    role: str,
) -> None:
    cfg = get_smtp_config()
    if not cfg.get("host") or not cfg.get("user"):
        logger.info(
            "SMTP not configured — approval email NOT sent to %s (%s). "
            "Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env to enable.",
            to_email,
            name,
        )
        return

    subject = "DRISHTI · Access Approved — Bengaluru Traffic Police"
    role_label = _ROLE_LABEL.get(role, role)
    badge_line = f"<b>Badge ID:</b> {badge_id}" if badge_id else ""

    html = f"""
<!DOCTYPE html>
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
          <p style="font-size:13px;color:#9ba5b3;margin:0 0 6px 0;letter-spacing:1px;text-transform:uppercase;">Access Request</p>
          <h2 style="margin:0 0 24px 0;color:#f5f7fb;font-size:22px;font-weight:600;">Your access has been approved</h2>

          <table cellpadding="0" cellspacing="0" style="width:100%;background:#10141b;border:1px solid #252b35;border-radius:4px;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 8px 0;font-size:13px;"><b style="color:#e8a034;">Name:</b> <span style="color:#f5f7fb;">{name}</span></p>
              <p style="margin:0 0 8px 0;font-size:13px;">{badge_line}</p>
              <p style="margin:0;font-size:13px;"><b>Role:</b> <span style="color:#19b7a5;">{role_label}</span></p>
            </td></tr>
          </table>

          <p style="font-size:13px;color:#9ba5b3;line-height:1.7;margin:0 0 24px 0;">
            You can now log in to the DRISHTI Command &amp; Dispatch platform.
            Your account is active and you have been registered in the personnel registry.
          </p>

          <p style="font-size:11px;color:#505866;margin:0;border-top:1px solid #252b35;padding-top:16px;">
            If you did not request this access or believe this is an error, contact the Command Centre immediately.
            Do not share your credentials. — Bengaluru Traffic Police · DRISHTI Ops
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    text = (
        f"DRISHTI · Access Approved\n\n"
        f"Name: {name}\n"
        + (f"Badge ID: {badge_id}\n" if badge_id else "")
        + f"Role: {role_label}\n\n"
        f"Your access has been approved. Log in to DRISHTI.\n\n"
        f"— Bengaluru Traffic Police · DRISHTI Ops"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg["from"]
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        _smtp_send(cfg, to_email, msg)
        logger.info("Approval email sent to %s", to_email)
    except Exception as exc:
        logger.warning("Could not send approval email to %s: %s", to_email, exc)


def send_new_request_email(
    admin_email: str,
    applicant_name: str,
    applicant_email: str,
    badge_id: str | None,
    rank: str | None,
    unit_name: str | None,
    role: str,
) -> None:
    """Notify the admin that a new access request is waiting for review."""
    cfg = get_smtp_config()
    if not cfg.get("host") or not cfg.get("user"):
        logger.info("SMTP not configured — new-request notification NOT sent to admin.")
        return

    role_label = _ROLE_LABEL.get(role, role)
    badge_line = f"<p style='margin:0 0 8px 0;font-size:13px;'><b style='color:#e8a034;'>Badge ID:</b> <span style='color:#f5f7fb;'>{badge_id}</span></p>" if badge_id else ""
    rank_line  = f"<p style='margin:0 0 8px 0;font-size:13px;'><b style='color:#e8a034;'>Rank:</b> <span style='color:#f5f7fb;'>{rank}</span></p>" if rank else ""
    unit_line  = f"<p style='margin:0 0 8px 0;font-size:13px;'><b style='color:#e8a034;'>Unit / Station:</b> <span style='color:#f5f7fb;'>{unit_name}</span></p>" if unit_name else ""

    html = f"""
<!DOCTYPE html>
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
          <p style="font-size:13px;color:#9ba5b3;margin:0 0 6px 0;letter-spacing:1px;text-transform:uppercase;">Action Required</p>
          <h2 style="margin:0 0 24px 0;color:#f5f7fb;font-size:22px;font-weight:600;">New access request pending review</h2>

          <table cellpadding="0" cellspacing="0" style="width:100%;background:#10141b;border:1px solid #252b35;border-radius:4px;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 8px 0;font-size:13px;"><b style="color:#e8a034;">Name:</b> <span style="color:#f5f7fb;">{applicant_name}</span></p>
              <p style="margin:0 0 8px 0;font-size:13px;"><b style="color:#e8a034;">Email:</b> <span style="color:#f5f7fb;">{applicant_email}</span></p>
              {badge_line}
              {rank_line}
              {unit_line}
              <p style="margin:0;font-size:13px;"><b style="color:#e8a034;">Role:</b> <span style="color:#19b7a5;">{role_label}</span></p>
            </td></tr>
          </table>

          <p style="font-size:13px;color:#9ba5b3;line-height:1.7;margin:0 0 24px 0;">
            Log in to the DRISHTI Command Centre dashboard and navigate to
            <b style="color:#f5f7fb;">Access Requests</b> to approve or reject this application.
          </p>

          <p style="font-size:11px;color:#505866;margin:0;border-top:1px solid #252b35;padding-top:16px;">
            This is an automated notification from DRISHTI Ops. Do not reply to this email.
            — Bengaluru Traffic Police · DRISHTI System
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"DRISHTI · New Access Request — {applicant_name} ({role_label})"
    msg["From"]    = cfg["from"]
    msg["To"]      = admin_email
    msg.attach(MIMEText(
        f"New access request from {applicant_name} ({applicant_email})\n"
        f"Role: {role_label}\n"
        + (f"Badge: {badge_id}\n" if badge_id else "")
        + "\nLog in to DRISHTI and go to Access Requests to approve or reject.",
        "plain",
    ))
    msg.attach(MIMEText(html, "html"))

    try:
        _smtp_send(cfg, admin_email, msg)
        logger.info("New-request notification sent to admin %s for applicant %s", admin_email, applicant_email)
    except Exception as exc:
        logger.warning("Could not send new-request notification: %s", exc)


def send_rejection_email(
    to_email: str,
    name: str,
    reason: str,
) -> None:
    cfg = get_smtp_config()
    if not cfg.get("host") or not cfg.get("user"):
        logger.info("SMTP not configured — rejection email NOT sent to %s.", to_email)
        return

    subject = "DRISHTI · Access Request Update"
    html = f"""
<!DOCTYPE html>
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
          <div style="background:#1a0a0a;border:1px solid #e05252/30;border-radius:4px;padding:16px 20px;margin-bottom:24px;">
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
</html>
"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg["from"]
    msg["To"] = to_email
    msg.attach(MIMEText(f"DRISHTI - Access not approved.\n\nReason: {reason}", "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        _smtp_send(cfg, to_email, msg)
        logger.info("Rejection email sent to %s", to_email)
    except Exception as exc:
        logger.warning("Could not send rejection email to %s: %s", to_email, exc)
