import asyncio
import os
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.database import AsyncSessionLocal, init_db, engine
from app.core.security import get_password_hash
from app.core.config import settings
from app.models.all_models import User, Document, DocumentVersion, DocumentChunk, SupplierContract, PaymentHistory, DocumentStatus
from app.ai.embeddings import embedding_service
from app.services.ingestion_service import ingestion_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("seed_data")


async def seed_enterprise_data():
    logger.info("Initializing database tables & pgvector...")
    await init_db()

    async with AsyncSessionLocal() as db:
        try:
            # 1. Check if users already exist
            stmt_u = select(User).limit(1)
            if (await db.execute(stmt_u)).scalar_one_or_none():
                logger.info("Database is already seeded with users. Skipping base user seeding.")
            else:
                logger.info("Seeding enterprise user accounts across departments...")
                test_users = [
                    User(
                        email="admin@enterprise.ai",
                        hashed_password=get_password_hash("Enterprise2026!"),
                        full_name="Dr. Elena Vance (Chief AI Officer)",
                        role="admin",
                        department="General",
                        is_active=True
                    ),
                    User(
                        email="hr@enterprise.ai",
                        hashed_password=get_password_hash("Enterprise2026!"),
                        full_name="Marcus Sterling (VP Human Resources)",
                        role="manager",
                        department="HR",
                        is_active=True
                    ),
                    User(
                        email="finance@enterprise.ai",
                        hashed_password=get_password_hash("Enterprise2026!"),
                        full_name="Samantha Chen (Senior Financial Controller)",
                        role="manager",
                        department="Finance",
                        is_active=True
                    ),
                    User(
                        email="engineer@enterprise.ai",
                        hashed_password=get_password_hash("Enterprise2026!"),
                        full_name="Devon Taylor (Staff Infrastructure Engineer)",
                        role="viewer",
                        department="Engineering",
                        is_active=True
                    )
                ]
                db.add_all(test_users)
                await db.commit()
                logger.info("Successfully created 4 enterprise test users.")

            # 2. Seed Structured Supplier Contracts & Payment History (for SQL + RAG)
            stmt_sc = select(SupplierContract).limit(1)
            if not (await db.execute(stmt_sc)).scalar_one_or_none():
                logger.info("Seeding structured SQL tables (SupplierContracts & PaymentHistory)...")
                contracts = [
                    SupplierContract(
                        supplier_name="Supplier ABC",
                        contract_number="CNT-2026-ABC-09",
                        contract_start=datetime(2025, 1, 1, tzinfo=timezone.utc),
                        contract_end=datetime(2026, 12, 31, tzinfo=timezone.utc),
                        payment_terms_days=30,
                        penalty_clause_summary="Any payment delay exceeding 10 business days triggers a 2.5% monthly compound penalty interest rate on outstanding invoice balance plus collection fees.",
                        status="Active"
                    ),
                    SupplierContract(
                        supplier_name="Supplier XYZ",
                        contract_number="CNT-2026-XYZ-42",
                        contract_start=datetime(2025, 6, 1, tzinfo=timezone.utc),
                        contract_end=datetime(2026, 10, 15, tzinfo=timezone.utc),
                        payment_terms_days=45,
                        penalty_clause_summary="Delays up to 14 days incur a 1% grace fee before SLA review.",
                        status="Active"
                    )
                ]
                db.add_all(contracts)
                await db.flush()

                payments = [
                    PaymentHistory(
                        invoice_number="INV-2026-089",
                        supplier_name="Supplier ABC",
                        amount_usd=45000.00,
                        due_date=datetime.now(timezone.utc) - timedelta(days=15),
                        paid_date=None,
                        status="Delayed",
                        delay_days=15
                    ),
                    PaymentHistory(
                        invoice_number="INV-2026-042",
                        supplier_name="Supplier XYZ",
                        amount_usd=12500.00,
                        due_date=datetime.now(timezone.utc) - timedelta(days=7),
                        paid_date=None,
                        status="Delayed",
                        delay_days=7
                    ),
                    PaymentHistory(
                        invoice_number="INV-2026-011",
                        supplier_name="Supplier ABC",
                        amount_usd=88000.00,
                        due_date=datetime.now(timezone.utc) - timedelta(days=60),
                        paid_date=datetime.now(timezone.utc) - timedelta(days=61),
                        status="Paid",
                        delay_days=0
                    )
                ]
                db.add_all(payments)
                await db.commit()
                logger.info("Successfully seeded SupplierContracts & PaymentHistory tables.")

            # 3. Seed Realistic Enterprise Documents & Vector Index
            stmt_doc = select(Document).limit(1)
            if not (await db.execute(stmt_doc)).scalar_one_or_none():
                logger.info("Creating realistic enterprise knowledge base (HR SOPs, Legal Contracts, Warehouse Guides)...")
                sample_docs = [
                    {
                        "title": "HR Maternity & Parental Leave Policy SOP",
                        "department": "HR",
                        "confidentiality": "Confidential",
                        "tags": "benefits,leave,maternity,parental,policy",
                        "owner_id": 2,
                        "content": (
                            "HR SOP-2026: MATERNITY AND PARENTAL LEAVE POLICY\n\n"
                            "Section 1: Purpose & Eligibility\n"
                            "This Standard Operating Procedure defines the maternity, paternity, and parental leave entitlements for all regular full-time employees of Enterprise AI Inc. To be eligible for fully paid leave, employees must have completed at least 6 months of continuous active service prior to the expected date of birth or adoption placement.\n\n"
                            "Section 2: Benefit Allocation & Paid Weeks\n"
                            "1. Primary Caregivers / Maternity Leave: Eligible full-time employees are entitled to 16 weeks of fully paid base salary maternity leave. During these 16 weeks, all medical and dental benefits remain active with employer contributions maintained at 100%.\n"
                            "2. Secondary Caregivers / Paternity & Partner Leave: Eligible secondary caregivers are granted up to 4 weeks of fully paid leave, to be taken within the first 12 months following birth or adoption.\n"
                            "3. Extended Unpaid Leave: Employees may request an additional 12 weeks of unpaid job-protected leave. Written notification must be submitted to the HR Benefits team via the Employee Portal at least 30 calendar days before leave commencement.\n\n"
                            "Section 3: Return to Work Integration\n"
                            "Upon completion of parental leave, employees are guaranteed reinstatement to their exact prior position or a substantially equivalent position with identical pay grade and seniority accrual."
                        )
                    },
                    {
                        "title": "Supplier ABC Master Agreement 2026",
                        "department": "Finance",
                        "confidentiality": "Confidential",
                        "tags": "contract,supplier,penalty,legal,procurement",
                        "owner_id": 3,
                        "content": (
                            "MASTER PROCUREMENT AGREEMENT - SUPPLIER ABC\n\n"
                            "Section 1: Parties & Scope of Agreement\n"
                            "This Master Agreement is entered into by and between Enterprise AI Inc. (Buyer) and Supplier ABC Logistics (Vendor). This contract covers high-grade server hardware components and expedited global freight delivery.\n\n"
                            "Section 4.2: Late Payment Terms & Penalty Interest Clause\n"
                            "Invoices submitted by Supplier ABC are due and payable Net 30 days from the invoice issuance date. If Buyer fails to settle an undisputed invoice within the Net 30 timeframe:\n"
                            "1. Any payment delay exceeding 10 business days past the due date shall automatically incur a 2.5% monthly compound penalty interest rate assessed against the total outstanding balance.\n"
                            "2. Furthermore, if an invoice remains delinquent for more than 45 calendar days, Supplier ABC reserves the right to suspend ongoing shipments and seek recovery of all legal collection costs.\n\n"
                            "Section 8: Term & Termination\n"
                            "This agreement remains in active effect through December 31, 2026. Either party may terminate with 60 days written notice upon material breach."
                        )
                    },
                    {
                        "title": "Warehouse Receiving & Quality Inspection Guide",
                        "department": "Operations",
                        "confidentiality": "Internal",
                        "tags": "warehouse,receiving,quality,sop,inspection,cold storage",
                        "owner_id": 1,
                        "content": (
                            "WAREHOUSE OPERATIONS: RECEIVING & QUALITY INSPECTION SOP\n\n"
                            "Section 1: Dock Arrival & Unloading Protocol\n"
                            "Upon arrival at the regional logistics distribution hub, dock receiving staff must inspect the delivery truck seal before breaking. Unloading staff must verify the physical pallet count against the official Bill of Lading (BOL) and inspect exterior stretch wrap for tears or moisture damage.\n\n"
                            "Section 2: Quality Inspection Checklist & Sampling\n"
                            "A mandatory randomized 10% carton inspection must be completed within 4 business hours of unloading. Quality Control inspectors must verify SKU numbers, lot expiration dates, and barcode scannability.\n\n"
                            "Section 3: Cold Storage & Temperature Sensitive Transfer Requirements\n"
                            "All perishable components or pharmaceutical grade server thermal pastes marked with temperature sensitivity requirements must NOT remain on the ambient loading dock. They must be transferred immediately to Cold Storage Zone B, which is strictly maintained at 2°C to 8°C, within 30 minutes of unloading. Any temperature deviation above 10°C triggers a mandatory QC quarantine hold.\n\n"
                            "Section 4: Discrepancy & Damage Logging\n"
                            "If damaged goods or quantity discrepancies are detected, receiving clerks must immediately log a Discrepancy Notice in the Enterprise ERP portal and attach digital photo evidence."
                        )
                    }
                ]

                for sdoc in sample_docs:
                    # Save a text representation to uploads folder
                    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                    safe_filename = f"seed_{timestamp_str}_{sdoc['title'].replace(' ', '_')}.txt"
                    fpath = os.path.join(settings.UPLOAD_DIR, safe_filename)
                    with open(fpath, "w", encoding="utf-8") as f:
                        f.write(sdoc["content"])

                    doc_obj = Document(
                        title=sdoc["title"],
                        department=sdoc["department"],
                        owner_id=sdoc["owner_id"],
                        confidentiality_level=sdoc["confidentiality"],
                        tags=sdoc["tags"],
                        current_version_number=1,
                        status=DocumentStatus.READY.value
                    )
                    db.add(doc_obj)
                    await db.flush()

                    ver_obj = DocumentVersion(
                        document_id=doc_obj.id,
                        version_number=1,
                        file_path=fpath,
                        file_name=safe_filename,
                        file_size_bytes=len(sdoc["content"]),
                        file_type="txt",
                        content_summary=sdoc["content"][:300] + "..."
                    )
                    db.add(ver_obj)
                    await db.flush()

                    # Chunk and generate embeddings
                    split_texts = ingestion_service.text_splitter.split_text(sdoc["content"])
                    embeddings = embedding_service.encode_batch(split_texts)

                    for idx, snippet in enumerate(split_texts):
                        chunk = DocumentChunk(
                            document_id=doc_obj.id,
                            version_id=ver_obj.id,
                            chunk_index=idx,
                            content=snippet,
                            section_title=sdoc["title"].split(" - ")[0],
                            page_number=1,
                            token_count=len(snippet.split()),
                            embedding=embeddings[idx] if idx < len(embeddings) else None,
                            metadata_json={"source": "seed"}
                        )
                        db.add(chunk)

                await db.commit()
                logger.info("Successfully seeded 3 enterprise knowledge documents with pgvector embeddings!")

        except Exception as e:
            await db.rollback()
            logger.error(f"Error during enterprise database seeding: {e}")
            raise e


if __name__ == "__main__":
    asyncio.run(seed_enterprise_data())
