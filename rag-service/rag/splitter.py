from typing import List, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

def split_documents(
    documents: List[Document],
    chunk_size: int = 1000,
    chunk_overlap: int = 200
) -> List[Document]:
    """
    Split loaded documents into overlapping chunks while preserving all page and project metadata.
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    
    split_docs = text_splitter.split_documents(documents)
    print(f"Split {len(documents)} page documents into {len(split_docs)} chunks")
    
    if split_docs:
        print(f"\n[Sample Chunk Preview]:")
        print(f"  Content: {split_docs[0].page_content[:150]}...")
        print(f"  Metadata: {split_docs[0].metadata}")
        
    return split_docs
