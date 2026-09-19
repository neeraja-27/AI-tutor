import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from langchain_community.document_loaders import PyPDFLoader, PyMuPDFLoader
from langchain_core.documents import Document

def load_single_pdf(
    file_path: str,
    project_id: Optional[str] = None,
    material_id: Optional[str] = None,
    original_filename: Optional[str] = None
) -> List[Document]:
    """
    Load a single PDF and enrich pages with project, material, and source metadata.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found at: {file_path}")
    
    file_name = original_filename or path.name
    print(f"\nProcessing PDF: {file_name}")
    
    # Try PyMuPDFLoader first for speed & accurate layout, fallback to PyPDFLoader
    try:
        loader = PyMuPDFLoader(str(path))
        documents = loader.load()
    except Exception as e:
        print(f"PyMuPDFLoader failed, falling back to PyPDFLoader: {e}")
        loader = PyPDFLoader(str(path))
        documents = loader.load()
        
    for doc in documents:
        # Standardize metadata
        doc.metadata['source_file'] = file_name
        doc.metadata['file_type'] = 'pdf'
        if 'page' in doc.metadata:
            # Normalize 0-indexed page to 1-indexed for citations
            doc.metadata['page'] = int(doc.metadata['page']) + 1
        else:
            doc.metadata['page'] = 1
            
        if project_id:
            doc.metadata['projectId'] = str(project_id)
        if material_id:
            doc.metadata['materialId'] = str(material_id)
            
    print(f"  ✓ Successfully loaded {len(documents)} pages from {file_name}")
    return documents

def process_all_pdfs(
    pdf_directory: str,
    project_id: Optional[str] = None
) -> List[Document]:
    """
    Recursively process all PDF files in a directory.
    """
    all_documents = []
    pdf_dir = Path(pdf_directory)
    pdf_files = list(pdf_dir.glob("**/*.pdf"))
    
    print(f"Found {len(pdf_files)} PDF files to process in {pdf_directory}")
    
    for pdf_file in pdf_files:
        try:
            docs = load_single_pdf(str(pdf_file), project_id=project_id)
            all_documents.extend(docs)
        except Exception as e:
            print(f"  ✗ Error loading {pdf_file.name}: {e}")
            
    print(f"\nTotal documents loaded: {len(all_documents)}")
    return all_documents
