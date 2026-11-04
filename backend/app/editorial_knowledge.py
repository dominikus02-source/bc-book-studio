from pathlib import Path

KB_ROOT = Path(__file__).resolve().parents[2] / 'docs' / 'knowledge-base'
KB_VERSION = '1.0.0'

def load_editorial_guidance():
    names = ['MASTER_EDITORIAL_HANDBOOK.md', 'AGENT_OPERATING_PROTOCOL.md', 'SOURCE_AND_FACT_VERIFICATION.md', 'BOOK_WRITING_STANDARDS.md']
    sections = []
    for name in names:
        path = KB_ROOT / name
        if not path.is_file():
            raise RuntimeError('Missing editorial knowledge: ' + name)
        sections.append(path.read_text(encoding='utf-8'))
    text = '\n\n'.join(sections)
    if len(text) > 16000:
        raise RuntimeError('Editorial context exceeds token budget')
    return text
