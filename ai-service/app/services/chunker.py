from langchain.text_splitter import RecursiveCharacterTextSplitter

def chunk_text(text: str) -> list:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,
        chunk_overlap=50,
        separators=["\n\n", "\n", ". ", " "]
    )
    return splitter.split_text(text)