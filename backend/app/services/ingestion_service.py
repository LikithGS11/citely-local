import os
import re
import csv
import logging
from typing import List, Dict, Any

# Parsers
import fitz  # PyMuPDF
from docx import Document as DocxDocument
from docx.table import Table
from docx.text.paragraph import Paragraph
from pptx import Presentation
import openpyxl
from PIL import Image
import pytesseract

from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

# Formats the parsers can actually read. Legacy binary .doc/.xls are NOT supported
# by python-docx / openpyxl, so they are rejected at upload instead of failing later.
SUPPORTED_EXTENSIONS = {"pdf", "docx", "pptx", "xlsx", "csv", "txt", "md", "markdown", "png", "jpg", "jpeg"}


class IngestionError(Exception):
    """Parsing failed or produced no usable text. The document is marked FAILED
    with this message — it is never indexed as if it were content."""


class ParsedSection:
    def __init__(self, content: str, page_number: int = 1, section_title: str = "General"):
        self.content = content
        self.page_number = page_number
        self.section_title = section_title


class IngestionService:
    """
    Multi-format parsing, OCR extraction, text cleaning, and chunking.
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
        Parses a document file into sections with page numbers and titles.
        Raises IngestionError if the file can't be parsed or contains no text.
        """
        ext = file_type.lower().lstrip(".")
        if not os.path.exists(file_path):
            raise IngestionError(f"File not found on server: {os.path.basename(file_path)}")
        if ext not in SUPPORTED_EXTENSIONS:
            raise IngestionError(f"Unsupported file type '.{ext}'")

        parsers = {
            "pdf": self._parse_pdf,
            "docx": self._parse_docx,
            "pptx": self._parse_pptx,
            "xlsx": self._parse_excel,
            "csv": self._parse_csv,
            "png": self._parse_image_ocr,
            "jpg": self._parse_image_ocr,
            "jpeg": self._parse_image_ocr,
            "txt": self._parse_text,
            "md": self._parse_text,
            "markdown": self._parse_text,
        }
        try:
            sections = parsers[ext](file_path)
        except IngestionError:
            raise
        except Exception as e:
            raise IngestionError(f"Could not parse .{ext} file: {e}") from e

        sections = [sec for sec in sections if sec.content.strip()]
        if not sections:
            raise IngestionError(f"No readable text could be extracted from this .{ext} file")
        return sections

    def _parse_pdf(self, file_path: str) -> List[ParsedSection]:
        sections = []
        current_section_title = "Introduction"

        with fitz.open(file_path) as doc:
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
                        logger.warning(f"OCR failed on page {page_num + 1}: {ocr_err}")

                if not text:
                    continue

                cleaned_text = self.clean_text(text)
                # Check if page begins with a section heading (e.g., "1. Purpose", "Section 2:")
                for line in cleaned_text.split("\n")[:3]:
                    if self._is_heading(line):
                        current_section_title = line.strip()
                        break

                sections.append(ParsedSection(
                    content=cleaned_text,
                    page_number=page_num + 1,
                    section_title=current_section_title
                ))
        return sections

    def _parse_docx(self, file_path: str) -> List[ParsedSection]:
        doc = DocxDocument(file_path)
        sections: List[ParsedSection] = []
        current_title = "Document Overview"
        current_content: List[str] = []

        def flush():
            if current_content:
                # DOCX has no fixed pagination; location is carried by the section title.
                sections.append(ParsedSection(
                    content=self.clean_text("\n".join(current_content)),
                    page_number=1,
                    section_title=current_title
                ))

        # Walk the body in document order so tables stay inside the section they belong to
        for child in doc.element.body.iterchildren():
            tag = child.tag.rsplit("}", 1)[-1]
            if tag == "p":
                para = Paragraph(child, doc)
                text = para.text.strip()
                if not text:
                    continue
                style_name = para.style.name if para.style is not None else ""
                if style_name.startswith("Heading") or self._is_heading(text):
                    flush()
                    current_content = []
                    current_title = text[:255]
                else:
                    current_content.append(text)
            elif tag == "tbl":
                table = Table(child, doc)
                table_text = []
                for row in table.rows:
                    row_vals = [cell.text.strip().replace("\n", " ") for cell in row.cells if cell.text.strip()]
                    if row_vals:
                        table_text.append(" | ".join(row_vals))
                if table_text:
                    current_content.append("[Table]\n" + "\n".join(table_text))

        flush()
        return sections

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
        return sections

    def _parse_excel(self, file_path: str) -> List[ParsedSection]:
        wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
        sections = []
        try:
            for sheet_index, sheet_name in enumerate(wb.sheetnames):
                sheet = wb[sheet_name]
                rows_data = []
                for row in sheet.iter_rows(values_only=True):
                    non_empty = [str(val) for val in row if val is not None and str(val).strip()]
                    if non_empty:
                        rows_data.append(" | ".join(non_empty))
                if rows_data:
                    content = f"Spreadsheet Sheet: {sheet_name}\n\n" + "\n".join(rows_data)
                    sections.append(ParsedSection(
                        content=self.clean_text(content),
                        page_number=sheet_index + 1,
                        section_title=f"Sheet: {sheet_name}"[:255]
                    ))
        finally:
            wb.close()
        return sections

    def _parse_csv(self, file_path: str) -> List[ParsedSection]:
        rows_data = []
        with open(file_path, mode="r", encoding="utf-8", errors="replace", newline="") as f:
            for row in csv.reader(f):
                non_empty = [val.strip() for val in row if val.strip()]
                if non_empty:
                    rows_data.append(" | ".join(non_empty))
        return [ParsedSection(
            content=self.clean_text("\n".join(rows_data)),
            page_number=1,
            section_title="CSV Data"
        )]

    def _parse_image_ocr(self, file_path: str) -> List[ParsedSection]:
        try:
            with Image.open(file_path) as img:
                text = pytesseract.image_to_string(img)
        except pytesseract.TesseractNotFoundError as e:
            raise IngestionError("OCR engine (Tesseract) is not installed on the server") from e
        return [ParsedSection(content=self.clean_text(text), page_number=1, section_title="Image OCR Text")]

    def _parse_text(self, file_path: str) -> List[ParsedSection]:
        with open(file_path, mode="r", encoding="utf-8", errors="replace") as f:
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
            for snippet in self.text_splitter.split_text(sec.content):
                if len(snippet.strip()) < 15:
                    continue
                chunks.append({
                    "chunk_index": chunk_idx,
                    "content": snippet.strip(),
                    "page_number": sec.page_number,
                    "section_title": (sec.section_title or "")[:255],
                    "token_count": len(snippet.split())
                })
                chunk_idx += 1
        return chunks


ingestion_service = IngestionService()
