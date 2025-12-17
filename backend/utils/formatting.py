import re

def clean_spacing(text: str) -> str:
    """
    Safe, minimal sanitizer:
    - fixes common broken word splits (small whitelist)
    - preserves newlines and Markdown structure
    - does NOT collapse whitespace or remove newlines
    """
    if not text:
        return text

    # 1) Fix a small, safe list of known broken splits (whitelist)
    fixes = {
        r"\bur ination\b": "urination",
        r"\bUn int ended\b": "Unintended",
        r"\bBl urred\b": "Blurred",
        r"\bFat igue\b": "Fatigue",
        r"\bIns ulin\b": "Insulin",
        r"\bstrong ly\b": "strongly",
        r"\bsedent ary\b": "sedentary",
        r"\bhe aling\b": "healing",
        r"\bslow -he aling\b": "slow-healing",
    }
    for pat, repl in fixes.items():
        text = re.sub(pat, repl, text, flags=re.IGNORECASE)

    # 2) Ensure space after punctuation when missing (but keep newlines)
    text = re.sub(r'([.,!?;:])(?=[A-Za-z0-9])', r'\1 ', text)

    # 3) Normalize repeated blank lines to at most two
    text = re.sub(r'\n{3,}', '\n\n', text)

    # keep leading/trailing newlines intact for markdown rendering, but trim extra spaces
    return text.strip()
