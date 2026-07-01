# =====================================================================
#  AI MARSHRUTI — eksport maslahatchisi + hujjat/shartnoma tahlili
# =====================================================================
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from app.security import get_current_user
from app.schemas import AdvisorRequest, DocAnalyzeRequest
from app.advisor import advise
from app.doc_analyzer import analyze_document
from app.doc_extract import extract_text, ExtractError
from app.llm import provider_status, LLMError

router = APIRouter()

_MAX_FILE = 10 * 1024 * 1024  # 10 MB


@router.get("/status")
async def ai_status(user: dict = Depends(get_current_user)):
    st = await provider_status()
    return {"ok": True, "provider": st["provider"], "configured": st["configured"], "source": st["source"]}


@router.post("/advisor")
async def ai_advisor(body: AdvisorRequest, user: dict = Depends(get_current_user)):
    try:
        res = await advise(user, body.question, body.preview)
    except LLMError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"ok": True, **res}


@router.post("/analyze")
async def ai_analyze(body: DocAnalyzeRequest, user: dict = Depends(get_current_user)):
    """Hujjat/shartnoma matnini AI mutaxassis tahlil qiladi."""
    try:
        res = await analyze_document(body.text, body.kind)
    except LLMError as e:
        raise HTTPException(status_code=503, detail=str(e))
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error"))
    return res


@router.post("/analyze-file")
async def ai_analyze_file(
    file: UploadFile = File(...),
    kind: str | None = Form(None),
    user: dict = Depends(get_current_user),
):
    """PDF/DOCX/TXT yuklab, matnini ajratib, AI tahlil qiladi."""
    data = await file.read()
    if len(data) > _MAX_FILE:
        raise HTTPException(status_code=413, detail="Fayl juda katta (maksimum 10 MB).")
    try:
        text = extract_text(file.filename, data)
    except ExtractError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not text.strip():
        raise HTTPException(status_code=400, detail="Fayldan matn chiqmadi (skaner/rasm bo'lishi mumkin).")
    try:
        res = await analyze_document(text, kind)
    except LLMError as e:
        raise HTTPException(status_code=503, detail=str(e))
    res["filename"] = file.filename
    res["chars"] = len(text)
    return res
