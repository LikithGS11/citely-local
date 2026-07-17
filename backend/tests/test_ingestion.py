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
