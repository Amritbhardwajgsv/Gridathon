import logging
import os
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.schemas import (
    AuthUserResponse,
    CitizenGrievanceCreateRequest,
    CitizenGrievanceListResponse,
    CitizenGrievanceResponse,
    DeploymentOrderCreateRequest,
    DeploymentOrderListResponse,
    DeploymentOrderResponse,
    DeploymentStatusUpdateRequest,
    FieldAssignmentListResponse,
    GrievanceStatusUpdateRequest,
    HealthResponse,
    ImpactPredictionRequest,
    ImpactPredictionResponse,
    IncidentPredictionRequest,
    IncidentPredictionResponse,
    LoginRequest,
    OperationsSummaryResponse,
    PersonnelLocationUpdateRequest,
    PersonnelLocationUpdateResponse,
    PolicePersonnelCreateRequest,
    PolicePersonnelListResponse,
    PolicePersonnelResponse,
    RegisterRequest,
    RejectUserRequest,
    SystemLogListResponse,
    TokenResponse,
    UserListResponse,
)
from app.core.config import get_cookie_secure, get_jwt_access_token_expire_minutes, get_mapmyindia_api_key
from app.services.auth_service import AuthError, auth_service, get_current_user, require_roles, security
from app.services.chat_service import chat_service
from app.services.deployment_service import deployment_service
from app.services.grievance_repository import GrievanceRepository, GrievanceRejectedError
from app.services.prediction_repository import PredictionRepository
from app.services.prediction_service import PredictionError, PredictionService
from app.services.resource_recommendation_service import resource_recommendation_service
from app.services.event_queue import event_queue

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("drishti")

prediction_service = PredictionService()
prediction_repository = PredictionRepository()
grievance_repository = GrievanceRepository()


# ---------------------------------------------------------------------------
# WebSocket chat connection manager
# ---------------------------------------------------------------------------

class _DeploymentChatManager:
    """In-process room-based WebSocket broadcast manager."""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, room: str) -> None:
        await ws.accept()
        self._rooms.setdefault(room, set()).add(ws)

    def disconnect(self, ws: WebSocket, room: str) -> None:
        self._rooms.get(room, set()).discard(ws)

    async def broadcast(self, room: str, payload: dict) -> None:
        dead: set[WebSocket] = set()
        for ws in list(self._rooms.get(room, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._rooms.get(room, set()).discard(ws)


_chat_mgr = _DeploymentChatManager()


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: object) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()
        try:
            response: Response = await call_next(request)
        except Exception:
            elapsed_ms = round((time.perf_counter() - start) * 1000)
            logger.exception("[%s] %s %s UNHANDLED %dms", request_id[:8], request.method, request.url.path, elapsed_ms)
            return Response(
                content='{"detail":"Internal server error"}',
                status_code=500,
                media_type="application/json",
                headers={"X-Request-ID": request_id},
            )
        elapsed_ms = round((time.perf_counter() - start) * 1000)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{elapsed_ms}ms"
        logger.info(
            "[%s] %s %s %s %dms",
            request_id[:8],
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: object) -> Response:
        try:
            response: Response = await call_next(request)
        except Exception:
            raise
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(self)"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window rate limiter: 120 requests / 60 s per IP. Health exempt."""

    _LIMIT  = 120
    _WINDOW = 60
    _EXEMPT = {"/health", "/docs", "/openapi.json", "/redoc"}
    _PRUNE_EVERY = 500   # prune stale IP entries every N requests

    def __init__(self, app: object) -> None:
        super().__init__(app)
        self._buckets: dict[str, list[float]] = {}
        self._request_count = 0

    def _prune(self, now: float) -> None:
        """Remove IP entries whose windows have fully expired to prevent unbounded growth."""
        stale = [ip for ip, ts in self._buckets.items() if not ts or now - ts[-1] >= self._WINDOW]
        for ip in stale:
            del self._buckets[ip]

    async def dispatch(self, request: Request, call_next: object) -> Response:
        if request.url.path in self._EXEMPT:
            return await call_next(request)

        client_ip = (request.client.host if request.client else None) or "unknown"
        now = time.time()

        self._request_count += 1
        if self._request_count % self._PRUNE_EVERY == 0:
            self._prune(now)

        bucket = self._buckets.get(client_ip, [])
        bucket = [t for t in bucket if now - t < self._WINDOW]

        if len(bucket) >= self._LIMIT:
            return Response(
                content='{"detail":"Rate limit exceeded. Retry after 60 seconds."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(self._WINDOW)},
            )

        bucket.append(now)
        self._buckets[client_ip] = bucket
        try:
            return await call_next(request)
        except Exception:
            raise


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.core.config import get_database_url
    db_url = get_database_url()
    event_queue.init(db_url)
    event_queue.start()
    event_queue.replay_pending()
    logger.info("DRISHTI backend starting — event queue ready (models load on first use)")
    yield
    event_queue.stop()
    logger.info("DRISHTI backend shutdown")


app = FastAPI(
    title="DRISHTI — Dynamic Resource Intelligence for Smart Highway and Traffic Intervention",
    version="2.0.0",
    description="Production API for Bengaluru Police traffic operations and event impact prediction.",
    lifespan=lifespan,
)

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001",
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestIDMiddleware)


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> Response:
    import psycopg

    if isinstance(exc, psycopg.OperationalError):
        logger.error("Database unreachable: %s", exc)
        return Response(
            content='{"detail":"Database unavailable. Check your DATABASE_URL or network."}',
            status_code=503,
            media_type="application/json",
        )
    logger.exception("Unhandled exception for %s %s", request.method, request.url.path)
    return Response(
        content='{"detail":"Internal server error"}',
        status_code=500,
        media_type="application/json",
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if prediction_service.is_ready else "not_ready",
        duration_model_loaded=prediction_service.duration_model is not None,
        impact_model_loaded=prediction_service.impact_model is not None,
        resource_model_loaded=resource_recommendation_service.resource_model is not None,
        learning_model_loaded=resource_recommendation_service.learning_model is not None,
        prediction_logging_enabled=prediction_repository.is_enabled,
    )


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post("/auth/register", response_model=AuthUserResponse, status_code=status.HTTP_201_CREATED, tags=["auth"])
def register(request: RegisterRequest) -> AuthUserResponse:
    try:
        return auth_service.register(request)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@app.post("/auth/login", response_model=TokenResponse, tags=["auth"])
def login(request: LoginRequest, response: Response) -> TokenResponse:
    try:
        token_response = auth_service.login(request)
        secure = get_cookie_secure()
        response.set_cookie(
            key="access_token",
            value=token_response.access_token,
            httponly=True,
            secure=secure,
            samesite="none" if secure else "lax",
            max_age=get_jwt_access_token_expire_minutes() * 60,
            path="/",
        )
        return token_response
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@app.get("/auth/me", response_model=AuthUserResponse, tags=["auth"])
def me(user: AuthUserResponse = Depends(get_current_user)) -> AuthUserResponse:
    return user


@app.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT, tags=["auth"])
def logout(
    request: Request,
    response: Response,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> None:
    """
    Blacklist the JWT (from cookie or Bearer header) in Redis and clear the
    auth cookie. Always returns 204 — never reveals whether the token was invalid.
    """
    token = request.cookies.get("access_token") or (credentials.credentials if credentials else None)
    if token:
        auth_service.logout(token)
    secure = get_cookie_secure()
    response.delete_cookie(
        key="access_token",
        path="/",
        secure=secure,
        httponly=True,
        samesite="none" if secure else "lax",
    )


# ---------------------------------------------------------------------------
# Admin — users
# ---------------------------------------------------------------------------

@app.get("/admin/users", response_model=UserListResponse, tags=["admin"])
def list_users(
    user: AuthUserResponse = Depends(require_roles("admin")),
) -> UserListResponse:
    return UserListResponse(items=auth_service.list_users())


@app.post("/admin/users/{user_id}/approve", response_model=AuthUserResponse, tags=["admin"])
def approve_user(
    user_id: str,
    user: AuthUserResponse = Depends(require_roles("admin")),
) -> AuthUserResponse:
    try:
        return auth_service.approve_user(user_id, str(user.id))
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@app.post("/admin/users/{user_id}/reject", response_model=AuthUserResponse, tags=["admin"])
def reject_user(
    user_id: str,
    request: RejectUserRequest,
    user: AuthUserResponse = Depends(require_roles("admin")),
) -> AuthUserResponse:
    try:
        return auth_service.reject_user(user_id, str(user.id), request.reason)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Admin — personnel
# ---------------------------------------------------------------------------

@app.post(
    "/admin/personnel",
    response_model=PolicePersonnelResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["admin"],
)
def create_personnel(
    request: PolicePersonnelCreateRequest,
    user: AuthUserResponse = Depends(require_roles("admin")),
) -> PolicePersonnelResponse:
    return deployment_service.create_personnel(request, str(user.id))


@app.delete("/admin/personnel/{personnel_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["admin"])
def remove_personnel(
    personnel_id: str,
    user: AuthUserResponse = Depends(require_roles("admin")),
) -> None:
    deployment_service.remove_personnel(personnel_id)


# ---------------------------------------------------------------------------
# Police — personnel
# ---------------------------------------------------------------------------

@app.get("/police/personnel", response_model=PolicePersonnelListResponse, tags=["police"])
def list_personnel(
    user: AuthUserResponse = Depends(require_roles("admin", "operator", "viewer")),
) -> PolicePersonnelListResponse:
    return PolicePersonnelListResponse(items=deployment_service.list_personnel())


# ---------------------------------------------------------------------------
# Police — deployments
# ---------------------------------------------------------------------------

@app.post(
    "/police/deployments",
    response_model=DeploymentOrderResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["police"],
)
def create_deployment_order(
    request: DeploymentOrderCreateRequest,
    user: AuthUserResponse = Depends(require_roles("admin", "operator")),
) -> DeploymentOrderResponse:
    try:
        order = deployment_service.create_order(request, str(user.id))
        event_queue.publish(
            "deployment.created",
            order.order_number,
            {
                "order_id"     : str(order.id),
                "order_number" : order.order_number,
                "grievance_id" : str(request.grievance_id) if request.grievance_id else None,
                "corridor"     : order.corridor,
                "zone"         : order.zone,
                "priority"     : order.priority,
                "status"       : order.status,
                "commander_id" : str(user.id),
            },
        )
        return order
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@app.get("/police/deployments", response_model=DeploymentOrderListResponse, tags=["police"])
def list_deployment_orders(
    user: AuthUserResponse = Depends(require_roles("admin", "operator", "viewer")),
) -> DeploymentOrderListResponse:
    return DeploymentOrderListResponse(items=deployment_service.list_orders())


@app.patch("/police/deployments/{order_id}/status", response_model=DeploymentOrderResponse, tags=["police"])
def update_deployment_status(
    order_id: str,
    request: DeploymentStatusUpdateRequest,
    user: AuthUserResponse = Depends(require_roles("admin", "operator")),
) -> DeploymentOrderResponse:
    try:
        order = deployment_service.update_order_status(order_id, request)
        event_queue.publish(
            "deployment.status_changed",
            order.order_number,
            {
                "order_id"    : str(order.id),
                "order_number": order.order_number,
                "new_status"  : order.status,
                "corridor"    : order.corridor,
                "zone"        : order.zone,
                "updated_by"  : str(user.id),
            },
        )
        return order
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Police — grievances
# ---------------------------------------------------------------------------

@app.get("/police/grievances", response_model=CitizenGrievanceListResponse, tags=["police"])
def list_citizen_grievances(
    user: AuthUserResponse = Depends(require_roles("admin", "operator", "viewer")),
) -> CitizenGrievanceListResponse:
    return CitizenGrievanceListResponse(items=grievance_repository.list_recent())


@app.patch("/police/grievances/{grievance_id}/status", response_model=CitizenGrievanceResponse, tags=["police"])
def update_grievance_status(
    grievance_id: str,
    request: GrievanceStatusUpdateRequest,
    user: AuthUserResponse = Depends(require_roles("admin", "operator")),
) -> CitizenGrievanceResponse:
    result = grievance_repository.update_status(grievance_id, request)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")
    return result


# ---------------------------------------------------------------------------
# Field
# ---------------------------------------------------------------------------

@app.post(
    "/field/personnel/{badge_id}/location",
    response_model=PersonnelLocationUpdateResponse,
    tags=["field"],
)
def update_personnel_location(
    badge_id: str,
    request: PersonnelLocationUpdateRequest,
) -> PersonnelLocationUpdateResponse:
    try:
        return deployment_service.update_location_by_badge(badge_id, request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@app.post("/field/me/location", response_model=PersonnelLocationUpdateResponse, tags=["field"])
def update_my_personnel_location(
    request: PersonnelLocationUpdateRequest,
    user: AuthUserResponse = Depends(require_roles("admin", "operator", "viewer")),
) -> PersonnelLocationUpdateResponse:
    if not user.badge_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logged-in user has no badge ID linked",
        )
    try:
        return deployment_service.update_location_by_badge(user.badge_id, request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@app.get("/field/me/assignments", response_model=FieldAssignmentListResponse, tags=["field"])
def my_field_assignments(
    user: AuthUserResponse = Depends(require_roles("admin", "operator", "viewer")),
) -> FieldAssignmentListResponse:
    if not user.badge_id:
        return FieldAssignmentListResponse(items=[])
    return FieldAssignmentListResponse(
        items=deployment_service.field_assignments_by_badge(user.badge_id)
    )


@app.get("/field/route", tags=["field"])
def field_route(
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    user: AuthUserResponse = Depends(require_roles("admin", "operator", "viewer")),
) -> dict:
    """Proxy to Mappls route API (key in URL path) with OSRM fallback."""
    import requests as _requests

    coords = f"{from_lng},{from_lat};{to_lng},{to_lat}"

    # ── 1. Mappls REST API (key in URL path, correct format) ──────────────────
    api_key = get_mapmyindia_api_key()
    if api_key:
        url = f"https://apis.mappls.com/advancedmaps/v1/{api_key}/route_adv/driving/{coords}"
        try:
            resp = _requests.get(
                url,
                params={"geometries": "geojson", "overview": "full", "steps": "false"},
                timeout=8,
            )
            resp.raise_for_status()
            data = resp.json()
            routes = data.get("routes") or []
            if routes:
                geometry  = routes[0].get("geometry", {})
                duration_s = routes[0].get("duration", 0)
                distance_m = routes[0].get("distance", 0)
                return {
                    "coordinates":      geometry.get("coordinates", []),
                    "duration_minutes": round(duration_s / 60, 1),
                    "distance_km":      round(distance_m / 1000, 2),
                }
        except Exception as exc:
            logger.warning("Mappls route API failed: %s", exc)

    # ── 2. OSRM demo server (no key needed, free for demos) ───────────────────
    try:
        osrm_url = f"http://router.project-osrm.org/route/v1/driving/{coords}"
        resp = _requests.get(
            osrm_url,
            params={"overview": "full", "geometries": "geojson"},
            timeout=8,
        )
        resp.raise_for_status()
        data   = resp.json()
        routes = data.get("routes") or []
        if routes:
            geometry   = routes[0].get("geometry", {})
            duration_s = routes[0].get("duration", 0)
            distance_m = routes[0].get("distance", 0)
            return {
                "coordinates":      geometry.get("coordinates", []),
                "duration_minutes": round(duration_s / 60, 1),
                "distance_km":      round(distance_m / 1000, 2),
            }
    except Exception as exc:
        logger.warning("OSRM route API failed: %s", exc)

    # ── 3. Straight-line last resort ──────────────────────────────────────────
    return {
        "coordinates":      [[from_lng, from_lat], [to_lng, to_lat]],
        "duration_minutes": None,
        "distance_km":      None,
        "fallback":         True,
    }


@app.post(
    "/field/me/report",
    response_model=CitizenGrievanceResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["field"],
    summary="Officer-filed complaint — reporter auto-filled from JWT",
)
def officer_file_grievance(
    request: CitizenGrievanceCreateRequest,
    user: AuthUserResponse = Depends(require_roles("admin", "operator", "viewer")),
) -> CitizenGrievanceResponse:
    # Merge the logged-in officer's identity into the complaint so the control
    # centre knows it came from a vetted field officer.
    from pydantic import TypeAdapter
    patched = request.model_copy(
        update={
            "reporter_name": request.reporter_name or f"{user.rank or ''} {user.name}".strip(),
        }
    )
    try:
        return grievance_repository.create(patched)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not submit field report",
        ) from exc


# ---------------------------------------------------------------------------
# Citizen
# ---------------------------------------------------------------------------

@app.post(
    "/citizen/grievances",
    response_model=CitizenGrievanceResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["citizen"],
)
def create_citizen_grievance(
    request: CitizenGrievanceCreateRequest,
    background_tasks: BackgroundTasks,
) -> CitizenGrievanceResponse:
    try:
        result = grievance_repository.create(request)
        # Gemini validation runs after the response is sent — citizen gets their
        # tracking ID instantly; Gemini marks the record if it fails.
        if request.description and len(request.description.strip()) >= 10:
            background_tasks.add_task(
                grievance_repository.validate_async,
                result.tracking_id,
                request.description,
            )
        return result
    except GrievanceRejectedError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "FIREWALL_REJECTED", "reason": str(exc)},
        ) from exc
    except Exception as exc:
        logger.exception("Grievance creation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not submit grievance",
        ) from exc


@app.get("/citizen/grievances/{tracking_id}", response_model=CitizenGrievanceResponse, tags=["citizen"])
def track_citizen_grievance(tracking_id: str) -> CitizenGrievanceResponse:
    grievance = grievance_repository.get_by_tracking_id(tracking_id)
    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracking token not found",
        )
    return grievance


# ---------------------------------------------------------------------------
# Operations
# ---------------------------------------------------------------------------

@app.get("/operations/summary", response_model=OperationsSummaryResponse, tags=["operations"])
def operations_summary(
    user: AuthUserResponse = Depends(require_roles("admin", "operator", "viewer")),
) -> OperationsSummaryResponse:
    return prediction_repository.operations_summary()


@app.get("/viewer/system-logs", response_model=SystemLogListResponse, tags=["operations"])
def system_logs(
    limit: int = Query(default=200, ge=1, le=500),
    user: AuthUserResponse = Depends(require_roles("admin", "viewer")),
) -> SystemLogListResponse:
    return SystemLogListResponse(items=prediction_repository.system_logs(limit))


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

@app.post("/predict-impact", response_model=ImpactPredictionResponse, tags=["prediction"])
def predict_impact(
    request: ImpactPredictionRequest,
    user: AuthUserResponse = Depends(require_roles("admin", "operator")),
) -> ImpactPredictionResponse:
    try:
        result = prediction_service.predict(request)
        prediction_repository.save_prediction(request, result, user_id=str(user.id))
        event_queue.publish(
            "prediction.created",
            f"{request.corridor or 'unknown'}-{uuid.uuid4().hex[:8]}",
            {
                "corridor"                  : request.corridor,
                "zone"                      : request.zone,
                "event_cause_grouped"       : request.event_cause_grouped,
                "predicted_duration_minutes": result.predicted_duration_minutes,
                "impact_level"              : result.impact_level,
                "operator_id"               : str(user.id),
            },
        )
        return result
    except PredictionError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post(
    "/predict/incident",
    response_model=IncidentPredictionResponse,
    tags=["prediction"],
    summary="ML incident prediction with LLM firewall — open to all",
)
def predict_incident(request: IncidentPredictionRequest) -> IncidentPredictionResponse:
    """
    Accepts a plain-language description (English or Kannada) + GPS coords,
    validates it through the LLM firewall, then returns duration estimate,
    priority, personnel count, and urgency from the trained XGBoost models.
    No authentication required — citizens and operators can both call this.
    """
    from app.services.incident_predictor import predict_incident as _predict
    try:
        result = _predict(
            description           = request.description,
            latitude              = request.latitude,
            longitude             = request.longitude,
            requires_road_closure = request.requires_road_closure,
            event_cause           = request.event_cause,
            veh_type              = request.veh_type,
            corridor              = request.corridor,
            police_station        = request.police_station,
            zone                  = request.zone,
        )
        return IncidentPredictionResponse(
            status   = result["status"],
            firewall = result["firewall"],
            estimated_duration_min = result.get("estimated_duration_min"),
            estimated_duration_hrs = result.get("estimated_duration_hrs"),
            priority               = result.get("priority"),
            personnel_to_deploy    = result.get("personnel_to_deploy"),
            urgency                = result.get("urgency"),
            detected_cause         = result.get("detected_cause"),
            detected_veh_type      = result.get("detected_veh_type"),
        )
    except Exception as exc:
        logger.exception("Incident prediction failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Deployment chat — REST history + WebSocket
# ---------------------------------------------------------------------------

@app.get("/police/deployments/{deployment_id}/messages", tags=["chat"])
def get_deployment_messages(
    deployment_id: str,
    user: AuthUserResponse = Depends(require_roles("admin", "operator", "viewer")),
) -> dict:
    """Fetch the last 100 chat messages for a deployment order."""
    messages = chat_service.get_messages(deployment_id)
    return {"items": messages}


@app.websocket("/ws/chat/{deployment_id}")
async def deployment_chat_ws(
    websocket: WebSocket,
    deployment_id: str,
    token: str | None = Query(None, description="JWT fallback — cookie is preferred"),
) -> None:
    """Real-time bidirectional chat between Command Centre and field officer."""
    # Cookie is sent automatically by the browser on the WS upgrade request.
    # The query-param token is kept as a fallback for non-browser clients.
    ws_token = websocket.cookies.get("access_token") or token
    if not ws_token:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    try:
        user = auth_service.get_user_from_token(ws_token)
    except AuthError:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await _chat_mgr.connect(websocket, deployment_id)
    logger.info("Chat WS connected: user=%s room=%s", user.name, deployment_id)

    # Push history on connect
    try:
        history = chat_service.get_messages(deployment_id)
        await websocket.send_json({"type": "history", "messages": history})
    except Exception:
        logger.warning("Chat history send failed", exc_info=True)
        await websocket.send_json({"type": "history", "messages": []})

    try:
        while True:
            data = await websocket.receive_json()
            text = (data.get("message") or "").strip()
            if not text:
                continue
            try:
                msg = chat_service.save_message(
                    deployment_id=deployment_id,
                    sender_id=str(user.id),
                    sender_name=user.name,
                    sender_role=user.role,
                    message=text,
                )
            except Exception:
                logger.error("Chat save failed", exc_info=True)
                continue
            await _chat_mgr.broadcast(deployment_id, {"type": "message", **msg})
    except WebSocketDisconnect:
        _chat_mgr.disconnect(websocket, deployment_id)
        logger.info("Chat WS disconnected: user=%s room=%s", user.name, deployment_id)
    except Exception:
        _chat_mgr.disconnect(websocket, deployment_id)
        logger.error("Chat WS error: room=%s", deployment_id, exc_info=True)
