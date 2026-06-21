import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

logger = logging.getLogger(__name__)
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg.rows import dict_row

from app.core.config import (
    get_database_url,
    get_jwt_access_token_expire_minutes,
    get_jwt_algorithm,
    get_jwt_secret_key,
)
from app.schemas import AuthUserResponse, LoginRequest, RegisterRequest, TokenResponse
from app.services.cache import cache, USERS_LIST

_VALID_RANKS = frozenset(
    ["Constable", "Head Constable", "ASI", "SI", "Inspector", "ACP", "DCP"]
)


def _coerce_rank(rank: str | None) -> str:
    if rank and rank in _VALID_RANKS:
        return rank
    return "Constable"

security = HTTPBearer(auto_error=False)


class AuthError(Exception):
    pass


class AuthService:
    def __init__(self) -> None:
        self.database_url = get_database_url()
        self._schema_checked = False

    @property
    def is_ready(self) -> bool:
        return bool(self.database_url)

    def register(self, payload: RegisterRequest) -> AuthUserResponse:
        self._require_database()
        normalized_email = payload.email.strip().lower()
        password_hash = self._hash_password(payload.password)

        try:
            import psycopg

            with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        insert into app_users (
                            name,
                            email,
                            role,
                            password_hash,
                            is_active,
                            approval_status,
                            badge_id,
                            rank,
                            unit_name
                        )
                        values (%s, %s, %s, %s, false, 'pending', %s, %s, %s)
                        returning
                            id,
                            name,
                            email,
                            role,
                            is_active,
                            approval_status,
                            badge_id,
                            rank,
                            unit_name,
                            rejection_reason,
                            created_at
                        """,
                        (
                            payload.name.strip(),
                            normalized_email,
                            payload.role,
                            password_hash,
                            payload.badge_id,
                            payload.rank,
                            payload.unit_name,
                        ),
                    )
                    user = cursor.fetchone()
        except Exception as exc:
            if "duplicate key" in str(exc).lower() or "unique" in str(exc).lower():
                raise AuthError("An account with this email already exists") from exc
            raise AuthError("Could not create account") from exc

        # Notify admin that a new request is waiting for review
        try:
            import os
            from app.services.email_service import send_new_request_email
            admin_email = os.getenv("ADMIN_EMAIL") or os.getenv("SMTP_USER")
            if admin_email:
                send_new_request_email(
                    admin_email     = admin_email,
                    applicant_name  = payload.name.strip(),
                    applicant_email = normalized_email,
                    badge_id        = payload.badge_id,
                    rank            = payload.rank,
                    unit_name       = payload.unit_name,
                    role            = payload.role,
                )
        except Exception as exc:
            # Non-fatal — registration still succeeds even if email fails
            import logging
            logging.getLogger(__name__).warning("Admin notification email failed: %s", exc)

        return self._user_response(user)

    def login(self, payload: LoginRequest) -> TokenResponse:
        self._require_database()
        normalized_email = payload.email.strip().lower()
        user_with_hash = self._get_user_by_email(normalized_email)

        if not user_with_hash:
            raise AuthError("Invalid email or password")

        if user_with_hash.get("approval_status") != "approved" or not user_with_hash.get("is_active"):
            if user_with_hash.get("approval_status") == "rejected":
                reason = user_with_hash.get("rejection_reason") or "Contact Command Centre for details"
                raise AuthError(f"Access request rejected: {reason}")
            raise AuthError("Account is pending Command Centre approval")

        if not self._verify_password(payload.password, user_with_hash["password_hash"]):
            raise AuthError("Invalid email or password")

        self._mark_login(str(user_with_hash["id"]))
        return self._token_response(user_with_hash)

    def get_user_from_token(self, token: str) -> AuthUserResponse:
        try:
            decoded = jwt.decode(
                token,
                get_jwt_secret_key(),
                algorithms=[get_jwt_algorithm()],
            )
            user_id = decoded.get("sub")
            jti      = decoded.get("jti")
        except jwt.PyJWTError as exc:
            raise AuthError("Invalid or expired token") from exc

        if not user_id:
            raise AuthError("Invalid token subject")

        # Redis blacklist check — token was explicitly logged out
        if jti:
            from app.services.token_blacklist import is_blacklisted
            if is_blacklisted(jti):
                raise AuthError("Token has been revoked — please log in again")

        user = self._get_user_by_id(user_id)
        if not user or not user.get("is_active") or user.get("approval_status") != "approved":
            raise AuthError("User is not active")

        return self._user_response(user)

    def logout(self, token: str) -> None:
        """Blacklist the token's JTI in Redis so it can never be reused."""
        try:
            decoded = jwt.decode(
                token,
                get_jwt_secret_key(),
                algorithms=[get_jwt_algorithm()],
            )
            jti = decoded.get("jti")
            exp = decoded.get("exp", 0)
            if jti:
                from app.services.token_blacklist import blacklist_token
                blacklist_token(jti, exp)
        except jwt.PyJWTError:
            pass  # expired token — nothing to blacklist, already useless

    def _token_response(self, user: dict[str, Any]) -> TokenResponse:
        user_response = self._user_response(user)
        token = self._create_access_token(user_response)
        return TokenResponse(access_token=token, user=user_response)

    @staticmethod
    def _hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    @staticmethod
    def _verify_password(password: str, password_hash: str) -> bool:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))

    @staticmethod
    def _create_access_token(user: AuthUserResponse) -> str:
        now        = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=get_jwt_access_token_expire_minutes())
        payload = {
            "sub":   str(user.id),
            "email": user.email,
            "role":  user.role,
            "jti":   str(uuid.uuid4()),   # unique token ID — used for Redis blacklist
            "exp":   expires_at,
            "iat":   now,
        }
        return jwt.encode(payload, get_jwt_secret_key(), algorithm=get_jwt_algorithm())

    @staticmethod
    def _user_response(user: dict[str, Any]) -> AuthUserResponse:
        return AuthUserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            is_active=user["is_active"],
            approval_status=user.get("approval_status", "approved"),
            badge_id=user.get("badge_id"),
            rank=user.get("rank"),
            unit_name=user.get("unit_name"),
            rejection_reason=user.get("rejection_reason"),
            created_at=user.get("created_at"),
        )

    def _get_user_by_email(self, email: str) -> dict[str, Any] | None:
        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        id,
                        name,
                        email,
                        role,
                        password_hash,
                        is_active,
                        approval_status,
                        badge_id,
                        rank,
                        unit_name,
                        rejection_reason,
                        created_at
                    from app_users
                    where lower(email) = lower(%s)
                    """,
                    (email,),
                )
                return cursor.fetchone()

    def _get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        id,
                        name,
                        email,
                        role,
                        is_active,
                        approval_status,
                        badge_id,
                        rank,
                        unit_name,
                        rejection_reason,
                        created_at
                    from app_users
                    where id = %s
                    """,
                    (user_id,),
                )
                return cursor.fetchone()

    def _mark_login(self, user_id: str) -> None:
        import psycopg

        with psycopg.connect(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "update app_users set last_login_at = now() where id = %s",
                    (user_id,),
                )

    def _require_database(self) -> None:
        if not self.database_url:
            raise AuthError("Database is not configured")
        self._ensure_access_request_schema()

    def _ensure_access_request_schema(self) -> None:
        if self._schema_checked:
            return

        import psycopg

        try:
            with psycopg.connect(self.database_url) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "alter table app_users add column if not exists rejection_reason text"
                    )
        except psycopg.OperationalError as exc:
            logger.error("DB connection failed: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="Database unavailable. Check your connection string or network.",
            ) from exc
        self._schema_checked = True

    def list_users(self) -> list[AuthUserResponse]:
        self._require_database()

        cached = cache.get(USERS_LIST)
        if cached is not None:
            return [AuthUserResponse(**item) for item in cached]

        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        id,
                        name,
                        email,
                        role,
                        is_active,
                        approval_status,
                        badge_id,
                        rank,
                        unit_name,
                        rejection_reason,
                        created_at
                    from app_users
                    order by
                        case approval_status
                            when 'pending' then 0
                            when 'approved' then 1
                            else 2
                        end,
                        created_at desc
                    """
                )
                rows = cursor.fetchall()

        cache.set(USERS_LIST, [dict(r) for r in rows], ttl=60)
        return [self._user_response(row) for row in rows]

    def approve_user(self, user_id: str, admin_id: str) -> AuthUserResponse:
        self._require_database()
        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    update app_users
                    set
                        approval_status = 'approved',
                        is_active = true,
                        approved_by_user_id = %s,
                        approved_at = now(),
                        rejection_reason = null
                    where id = %s
                    returning
                        id,
                        name,
                        email,
                        role,
                        is_active,
                        approval_status,
                        badge_id,
                        rank,
                        unit_name,
                        rejection_reason,
                        created_at
                    """,
                    (admin_id, user_id),
                )
                row = cursor.fetchone()
                if not row:
                    raise AuthError("User not found")

                # Auto-register in police_personnel so the officer is immediately
                # searchable and dispatchable without manual registry entry.
                if row.get("badge_id"):
                    cursor.execute(
                        """
                        insert into police_personnel (
                            badge_id, name, rank, unit_name, is_available, is_active,
                            created_by_user_id
                        )
                        values (%s, %s, %s, %s, true, true, %s)
                        on conflict (badge_id) do update
                            set name      = excluded.name,
                                rank      = excluded.rank,
                                unit_name = excluded.unit_name,
                                is_active = true
                        """,
                        (
                            row["badge_id"],
                            row["name"],
                            _coerce_rank(row.get("rank")),
                            row.get("unit_name") or "BTP",
                            admin_id,
                        ),
                    )

        cache.delete(USERS_LIST)

        # Fire-and-forget approval email — never blocks the HTTP response
        try:
            from app.services.email_service import send_approval_email
            send_approval_email(
                to_email=row["email"],
                name=row["name"],
                badge_id=row.get("badge_id"),
                role=row["role"],
            )
        except Exception:
            logger.warning("Approval email failed for user %s", user_id, exc_info=True)

        return self._user_response(row)

    def reject_user(self, user_id: str, admin_id: str, reason: str) -> AuthUserResponse:
        self._require_database()
        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    update app_users
                    set
                        approval_status = 'rejected',
                        is_active = false,
                        approved_by_user_id = %s,
                        approved_at = now(),
                        rejection_reason = %s
                    where id = %s
                    returning
                        id,
                        name,
                        email,
                        role,
                        is_active,
                        approval_status,
                        badge_id,
                        rank,
                        unit_name,
                        rejection_reason,
                        created_at
                    """,
                    (admin_id, reason.strip(), user_id),
                )
                row = cursor.fetchone()
        if not row:
            raise AuthError("User not found")

        cache.delete(USERS_LIST)

        # Notify officer of rejection
        try:
            from app.services.email_service import send_rejection_email
            send_rejection_email(
                to_email=row["email"],
                name=row["name"],
                reason=reason.strip(),
            )
        except Exception:
            logger.warning("Rejection email failed for user %s", user_id, exc_info=True)

        return self._user_response(row)


auth_service = AuthService()


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUserResponse:
    # Cookie takes priority; Bearer header is a fallback (e.g. API testing tools)
    token = request.cookies.get("access_token")
    if not token and credentials:
        token = credentials.credentials
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        return auth_service.get_user_from_token(token)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


def require_roles(*roles: str):
    def dependency(user: AuthUserResponse = Depends(get_current_user)) -> AuthUserResponse:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this resource",
            )
        return user

    return dependency
