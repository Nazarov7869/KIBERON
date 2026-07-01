# =====================================================================
#  RUXSAT MATRITSASI — entity x amal -> ruxsat etilgan rollar
#  Rol darajasidagi himoya shu yerda; qator darajasidagi egalik (o'z loti/
#  o'z RFQ'si) marshrut ichida tekshiriladi.
# =====================================================================
from fastapi import Depends, HTTPException

from app.security import get_current_user

ALL_ROLES = {"exporter", "importer", "logistics", "warehouse", "embassy", "super_admin"}

MATRIX: dict[str, dict[str, set[str]]] = {
    "lot": {
        "create": {"exporter"},
        "read":   ALL_ROLES,                       # mavjud lotlarni ko'rish
        "update": {"exporter", "super_admin"},     # + qator egaligi marshrutda
        "delete": {"exporter", "super_admin"},
        "quality": {"warehouse", "super_admin"},   # ombor sifat nazorati (passed/rejected)
    },
    "rfq": {
        "create": {"importer"},
        "read":   ALL_ROLES,
        "update": {"importer", "super_admin"},
        "delete": {"importer", "super_admin"},
    },
    "company": {
        "list":     {"super_admin"},
        "verify":   {"super_admin"},
        "read_own": {"exporter"},
    },
    "pool": {
        "create":   {"super_admin", "importer"},
        "read":     ALL_ROLES,
        "enter":    {"exporter"},                  # lotni poolga qo'shish
        "allocate": {"super_admin", "importer"},   # + egalik (rfq) marshrutda
    },
    "order": {
        "create":  {"super_admin", "importer"},
        "read":    ALL_ROLES,                       # qator bo'yicha filtrlanadi
        "confirm": {"super_admin", "importer"},     # escrowga pul qo'yish
        "cancel":  {"super_admin", "importer"},
        "ship":    {"super_admin", "logistics"},    # avans chiqishi
        "deliver": {"super_admin", "logistics"},    # balans + komissiya
    },
    "lead": {
        "create": {"super_admin", "embassy"},       # tashqi xaridor/talab kiritish
        "read":   {"super_admin", "embassy", "exporter"},  # eksportyor talabni ko'radi
        "update": {"super_admin", "embassy"},       # + egalik (o'z leadi) marshrutda
        "delete": {"super_admin", "embassy"},
    },
}


def allowed(role: str, entity: str, action: str) -> bool:
    return role in MATRIX.get(entity, {}).get(action, set())


def require_perm(entity: str, action: str):
    """Rol matritsaga ko'ra ruxsatga ega bo'lishini talab qiladi (Depends)."""
    async def dependency(user: dict = Depends(get_current_user)) -> dict:
        if not allowed(user["role"], entity, action):
            raise HTTPException(
                status_code=403,
                detail=f"Ruxsat yo'q: {entity}.{action} (rol: {user['role']})",
            )
        return user

    return dependency
