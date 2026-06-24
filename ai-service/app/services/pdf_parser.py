import io
import pypdf

def parse_pdf(file_obj) -> str:
    text_parts = []
    if isinstance(file_obj, bytes):
        file_obj = io.BytesIO(file_obj)
        
    reader = pypdf.PdfReader(file_obj)
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)
    return "\n".join(text_parts)