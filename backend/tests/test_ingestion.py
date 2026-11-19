import pytest
import tempfile
import os
from app.services.ingestion_service import IngestionService, ParsedSection

def test_ingestion_text_file_parsing_and_chunking():
    service = IngestionService()
    sample_text = """
    Enterprise Knowledge Intelligence SOP Section 1: Introduction
    The purpose of this document is to outline security clearance rules across enterprise units.
    
    Section 2: Payment Penalties and Supplier Contracts
    Any payment delay exceeding 10 business days will incur a 2.5% monthly compound penalty interest rate assessed against the total balance.
    """
    
    with tempfile.NamedTemporaryFile(mode="w+", suffix=".txt", delete=False) as f:
        f.write(sample_text)
        temp_path = f.name
        
    try:
        sections = service.parse_file(temp_path, "txt")
        assert len(sections) >= 1
        assert "Enterprise Knowledge Intelligence SOP" in sections[0].content
        assert "2.5% monthly compound penalty" in sections[0].content
        
        chunks = service.chunk_sections(sections)
        assert len(chunks) >= 1
        for chunk in chunks:
            assert len(chunk["content"]) > 0
            assert chunk["section_title"] is not None
            assert chunk["token_count"] > 0
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

def test_chunk_metadata_extraction():
    service = IngestionService()
    sections = [
        ParsedSection(content="Late Payment Terms. All invoices submitted by suppliers are due Net 30 days.", page_number=4, section_title="Section 4.2: Late Payment Terms")
    ]
    chunks = service.chunk_sections(sections)
    assert len(chunks) == 1
    assert chunks[0]["section_title"] == "Section 4.2: Late Payment Terms"
    assert chunks[0]["page_number"] == 4


def test_parse_failure_raises_instead_of_indexing_error_text(tmp_path):
    from app.services.ingestion_service import IngestionError
    service = IngestionService()
    bad = tmp_path / "broken.pdf"
    bad.write_bytes(b"this is not a pdf")
    with pytest.raises(IngestionError):
        service.parse_file(str(bad), "pdf")


def test_empty_file_raises(tmp_path):
    from app.services.ingestion_service import IngestionError
    service = IngestionService()
    empty = tmp_path / "empty.txt"
    empty.write_text("   \n  ")
    with pytest.raises(IngestionError):
        service.parse_file(str(empty), "txt")


def test_legacy_doc_format_rejected(tmp_path):
    from app.services.ingestion_service import IngestionError, SUPPORTED_EXTENSIONS
    assert "doc" not in SUPPORTED_EXTENSIONS and "xls" not in SUPPORTED_EXTENSIONS
    f = tmp_path / "old.doc"
    f.write_bytes(b"\xd0\xcf\x11\xe0")
    with pytest.raises(IngestionError):
        IngestionService().parse_file(str(f), "doc")


def test_docx_tables_stay_in_their_section(tmp_path):
    from docx import Document as DocxDocument
    d = DocxDocument()
    d.add_heading("Section 1: Fees", level=1)
    d.add_paragraph("The fee schedule follows.")
    t = d.add_table(rows=1, cols=2)
    t.rows[0].cells[0].text = "Late fee"
    t.rows[0].cells[1].text = "2.5%"
    d.add_heading("Section 2: Termination", level=1)
    d.add_paragraph("Either party may terminate with 30 days notice.")
    path = tmp_path / "c.docx"
    d.save(str(path))

    sections = IngestionService().parse_file(str(path), "docx")
    fees = next(s for s in sections if s.section_title == "Section 1: Fees")
    assert "Late fee | 2.5%" in fees.content
    term = next(s for s in sections if s.section_title == "Section 2: Termination")
    assert "Late fee" not in term.content
