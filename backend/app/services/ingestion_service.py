import os
import re
import logging
from typing import List, Dict, Any, Tuple
from pathlib import Path

# Parsers
import fitz  # PyMuPDF
from docx import Document as DocxDocument
from pptx import Presentation
import openpyxl
import csv
from PIL import Image
import pytesseract

from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)


class ParsedSection:
    def __init__(self, content: str, page_number: int = 1, section_title: str = "General"):
        self.content = content
        self.page_number = page_number
        self.section_title = section_title


class IngestionService:
    """
    Production-grade multi-format parsing, OCR extraction, text cleaning, and semantic chunking service.
    """
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=150,
            separators=["\n\n", "\n", ". ", " ", ""],
            keep_separator=False
        )

    def parse_file(self, file_path: str, file_type: str) -> List[ParsedSection]:
        """
        Parses a document file and returns a list of sections with page numbers and titles.
        """
        ext = file_type.lower().lstrip(".")
        if not os.path.exists(file_path):
            logger.error(f"File not found at {file_path}")
            return []

        try:
            if ext == "pdf":
                return self._parse_pdf(file_path)
            elif ext in ["docx", "doc"]:
                return self._parse_docx(file_path)
            elif ext == "pptx":
                return self._parse_pptx(file_path)
            elif ext in ["xlsx", "xls"]:
                return self._parse_excel(file_path)
            elif ext == "csv":
                return self._parse_csv(file_path)
            elif ext in ["png", "jpg", "jpeg", "tiff", "bmp"]:
                return self._parse_image_ocr(file_path)
            elif ext in ["txt", "md", "markdown"]:
                return self._parse_text(file_path)
            else:
                logger.warning(f"Unsupported file extension {ext}, treating as plain text.")
                return self._parse_text(file_path)
        except Exception as e:
            logger.error(f"Error parsing file {file_path} of type {ext}: {e}")
            return [ParsedSection(content=f"Document parsing error or empty text: {e}", page_number=1, section_title="Error")]

    def _parse_pdf(self, file_path: str) -> List[ParsedSection]:
        sections = []
        doc = fitz.open(file_path)
        current_section_title = "Executive Summary / Introduction"

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text").strip()

            # If page text is almost empty, perform OCR for scanned PDFs
            if len(text) < 50:
                logger.info(f"Low text density on page {page_num + 1} of PDF. Attempting OCR...")
                try:
                    pix = page.get_pixmap(dpi=150)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    ocr_text = pytesseract.image_to_string(img)
                    if len(ocr_text.strip()) > len(text):
                        text = ocr_text.strip()
                except Exception as ocr_err:
                    logger.warning(f"OCR fallback failed on page {page_num + 1}: {ocr_err}")

            if not text:
                continue

            cleaned_text = self.clean_text(text)
            # Check if page begins with a section heading (e.g., "1. Purpose", "Section 2:")
            lines = cleaned_text.split("\n")
            for line in lines[:3]:
                if self._is_heading(line):
                    current_section_title = line.strip()
                    break

            sections.append(ParsedSection(
                content=cleaned_text,
                page_number=page_num + 1,
                section_title=current_section_title
            ))

        doc.close()
        return sections if sections else [ParsedSection("No readable text found in PDF document.", 1, "General")]

    def _parse_docx(self, file_path: str) -> List[ParsedSection]:
        doc = DocxDocument(file_path)
        sections = []
        current_title = "Document Overview"
        current_content = []

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue

            # Detect headings by style or formatting
            if para.style.name.startswith("Heading") or self._is_heading(text):
                if current_content:
                    sections.append(ParsedSection(
                        content=self.clean_text("\n".join(current_content)),
                        page_number=1,
                        section_title=current_title
                    ))
                    current_content = []
                current_title = text
            else:
                current_content.append(text)

        # Process tables inside docx
        for table in doc.tables:
            table_text = []
            for row in table.rows:
                row_vals = [cell.text.strip().replace("\n", " ") for cell in row.cells if cell.text.strip()]
                if row_vals:
                    table_text.append(" | ".join(row_vals))
            if table_text:
                current_content.append("\n[Table Data]:\n" + "\n".join(table_text))

        if current_content:
            sections.append(ParsedSection(
                content=self.clean_text("\n".join(current_content)),
                page_number=1,
                section_title=current_title
            ))

        return sections if sections else [ParsedSection("No text content extracted from DOCX.", 1, "General")]

    def _parse_pptx(self, file_path: str) -> List[ParsedSection]:
        prs = Presentation(file_path)
        sections = []
        for slide_num, slide in enumerate(prs.slides, start=1):
            texts = []
            title = f"Slide {slide_num}"
            for shape in slide.shapes:
                if not shape.has_text_frame:
                    continue
                text = shape.text_frame.text.strip()
                if not text:
                    continue
                if shape == slide.shapes.title:
                    title = text.split("\n")[0][:120]
                texts.append(text)
            if texts:
                sections.append(ParsedSection(
                    content=self.clean_text("\n".join(texts)),
                    page_number=slide_num,
                    section_title=title
                ))
        return sections if sections else [ParsedSection("No text content extracted from PPTX slides.", 1, "General")]

    def _parse_excel(self, file_path: str) -> List[ParsedSection]:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        sections = []
        for sheet_index, sheet_name in enumerate(wb.sheetnames):
            sheet = wb[sheet_name]
            rows_data = []
            for row in sheet.iter_rows(values_only=True):
                non_empty = [str(val) for val in row if val is not None and str(val).strip()]
                if non_empty:
                    rows_data.append(" | ".join(non_empty))
            if rows_data:
                content = f"Spreadsheet Sheet: {sheet_name}\n\n" + "\n".join(rows_data[:200])
                sections.append(ParsedSection(
                    content=self.clean_text(content),
                    page_number=sheet_index + 1,
                    section_title=f"Sheet: {sheet_name}"
                ))
        return sections if sections else [ParsedSection("Empty spreadsheet data.", 1, "Sheet 1")]

    def _parse_csv(self, file_path: str) -> List[ParsedSection]:
        rows_data = []
        with open(file_path, mode="r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            for row in reader:
                non_empty = [val.strip() for val in row if val.strip()]
                if non_empty:
                    rows_data.append(" | ".join(non_empty))
        content = "\n".join(rows_data[:500])
        return [ParsedSection(
            content=self.clean_text(content),
            page_number=1,
            section_title="CSV Data Grid"
        )]

    def _parse_image_ocr(self, file_path: str) -> List[ParsedSection]:
        try:
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img)
            cleaned = self.clean_text(text)
            if not cleaned:
                cleaned = "Image extracted text was empty or unintelligible."
        except Exception as e:
            logger.warning(f"OCR failed for image {file_path}: {e}")
            cleaned = "Scanned image text could not be processed."
        return [ParsedSection(content=cleaned, page_number=1, section_title="Scanned Image OCR Content")]

    def _parse_text(self, file_path: str) -> List[ParsedSection]:
        with open(file_path, mode="r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        return [ParsedSection(
            content=self.clean_text(text),
            page_number=1,
            section_title="Document Body"
        )]

    def clean_text(self, text: str) -> str:
        """
        Removes excess control characters, duplicate spacing, and cleans OCR artifacts.
        """
        text = re.sub(r'\r\n', '\n', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[ \t]{2,}', ' ', text)
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
        return text.strip()

    def _is_heading(self, line: str) -> bool:
        line = line.strip()
        if not line or len(line) > 80:
            return False
        # Matches patterns like "1. Purpose", "Section 2", "CHAPTER IV:", or all caps short titles
        if re.match(r'^(Section|CHAPTER|Article|Part|\d+\.)\s+[A-Z0-9]', line, re.IGNORECASE):
            return True
        if line.isupper() and len(line) > 3 and not line.endswith("."):
            return True
        return False

    def chunk_sections(self, sections: List[ParsedSection]) -> List[Dict[str, Any]]:
        """
        Splits sections into uniform chunks ready for embedding generation.
        """
        chunks = []
        chunk_idx = 0
        for sec in sections:
            if not sec.content.strip():
                continue
            split_texts = self.text_splitter.split_text(sec.content)
            for snippet in split_texts:
                if len(snippet.strip()) < 15:
                    continue
                chunks.append({
                    "chunk_index": chunk_idx,
                    "content": snippet.strip(),
                    "page_number": sec.page_number,
                    "section_title": sec.section_title,
                    "token_count": len(snippet.split())
                })
                chunk_idx += 1
        return chunks


ingestion_service = IngestionService()
