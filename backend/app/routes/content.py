from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
import shutil
import os

from app.db.session import get_db
from app.models.content import Content
from app.models.user import User
from app.utils.dependencies import require_role
from app.services.pdf_service import extract_text_from_pdf

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher"))
):
    file_path = f"{UPLOAD_DIR}/{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    extracted_text = extract_text_from_pdf(file_path)

    content = Content(
        teacher_id=current_user.id,
        file_path=file_path,
        extracted_text=extracted_text
    )

    db.add(content)
    db.commit()
    db.refresh(content)

    return {"content_id": content.id}