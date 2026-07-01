# =====================================================================
#  IPAK YO'LI CRM — BACKEND (FastAPI)
#  health (liveness + readiness) + katalog marshruti.
#  Auth (4) va entity API'lar (5) keyingi qadamlarda ulanadi.
# =====================================================================
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

from app.config import settings
from app.db import pool, health_check, table_counts
from app.routers import catalog, auth, lots, rfqs, companies, pools, orders, ai, admin, leads, market, map


# React CRM (SPA) — topilmagan yo'llarni index.html ga qaytaradi (React Router)
class SPAStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup — pool ochish
    try:
        await pool.open()
    except Exception as e:  # noqa: BLE001
        print(f"  DB pool ochishda xato: {e}")
    h = await health_check()
    print("\n  Ipak Yo'li CRM backend (FastAPI)")
    print(f"  →  http://localhost:{settings.PORT}")
    print("  DB: ulandi" if h["ok"] else f"  DB: ULANMADI — {h.get('error')}")
    if not settings.DATABASE_URL:
        print("  Ogohlantirish: DATABASE_URL yo'q — .env tekshiring")
    print("")
    yield
    # shutdown — pool yopish
    await pool.close()


app = FastAPI(title="Ipak Yo'li CRM", version="0.1.0", lifespan=lifespan)


# --- CORS: ALLOWED_ORIGINS domenlaridan brauzer chaqiruvi (mobil/native uchun shart emas) ---
_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=bool(_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- liveness: server tirikmi (bazaga bog'liq emas) ---
@app.get("/health")
async def health():
    return {"ok": True, "service": "ipak-crm", "time": datetime.now(timezone.utc).isoformat()}


# --- readiness: baza javob beradimi + seed yuklanganmi ---
@app.get("/health/db")
async def health_db():
    h = await health_check()
    if not h["ok"]:
        return JSONResponse(status_code=503, content={"ok": False, "db": h})
    try:
        counts = await table_counts()
    except Exception:  # noqa: BLE001
        counts = None
    return {"ok": True, "db": h, "counts": counts}


# --- katalog (faqat o'qish) ---
app.include_router(catalog.router, prefix="/api/catalog", tags=["catalog"])

# --- auth (ro'yxat, kirish, joriy foydalanuvchi) ---
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

# --- entity API'lar (5-qadam) ---
app.include_router(lots.router, prefix="/api/lots", tags=["lots"])
app.include_router(rfqs.router, prefix="/api/rfqs", tags=["rfqs"])
app.include_router(companies.router, prefix="/api/companies", tags=["companies"])
app.include_router(pools.router, prefix="/api/pools", tags=["pools"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(leads.router, prefix="/api/leads", tags=["leads"])
app.include_router(market.router, prefix="/api/market", tags=["market"])
app.include_router(map.router, prefix="/api/map", tags=["map"])


# --- React CRM statik build (agar mavjud bo'lsa) — /api dan keyin ulanadi ---
# Docker'da backend CRM'ni ham beradi: /api/* -> API, qolgani -> React SPA
_frontend_dist = os.getenv("FRONTEND_DIST", "/app/frontend/dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", SPAStaticFiles(directory=_frontend_dist, html=True), name="crm")
    print(f"  CRM statik: {_frontend_dist}")
else:
    print("  CRM statik: yo'q (faqat API rejimi)")


# --- bir xil JSON xato shakli ---
@app.exception_handler(StarletteHTTPException)
async def http_exc_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"ok": False, "error": exc.detail})


@app.exception_handler(Exception)
async def generic_exc_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"ok": False, "error": str(exc)})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT)
