# =====================================================================
#  Konfiguratsiya — ENV'dan sozlamalar (.env fayldan yuklanadi)
# =====================================================================
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./ipak.db")
    PORT: int = int(os.getenv("PORT", "4000"))

    # Auth / JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-almashtiring")
    # CORS — ruxsat etilgan domenlar (vergul bilan). Bo'sh -> hammaga (dev)
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "")
    JWT_ALG: str = os.getenv("JWT_ALG", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # AI (ko'p provayderli) — qaysi kalit bo'lsa, o'sha provayder ishlatiladi
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")          # mos (OpenAI-uslubdagi) custom
    AI_BASE_URL: str = os.getenv("AI_BASE_URL", "")        # custom uchun bazaviy URL
    AI_MODEL: str = os.getenv("AI_MODEL", "")             # bo'sh bo'lsa provayder standarti


settings = Settings()
