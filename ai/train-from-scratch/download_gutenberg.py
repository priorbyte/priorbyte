"""
Downloads a small curated set of public-domain books from Project Gutenberg
into data/raw/, as real training volume for the from-scratch model. All
titles here are confirmed out of copyright and freely redistributable --
Gutenberg's plain-text mirrors are the standard, legal source for exactly
this kind of language-modeling dataset (the original nanoGPT project used
the same source for its larger runs).

Strips Gutenberg's boilerplate header/footer (licensing text, not the book
itself) so the model trains on actual prose, not legal disclaimers.
"""

import re
import urllib.request
from pathlib import Path

OUT_DIR = Path(__file__).parent / "data" / "raw"

BOOKS = {
    "pride_and_prejudice.txt": "https://www.gutenberg.org/files/1342/1342-0.txt",
    "sherlock_holmes.txt": "https://www.gutenberg.org/files/1661/1661-0.txt",
    "frankenstein.txt": "https://www.gutenberg.org/files/84/84-0.txt",
    "alice_in_wonderland.txt": "https://www.gutenberg.org/files/11/11-0.txt",
    "dracula.txt": "https://www.gutenberg.org/files/345/345-0.txt",
}

START_MARKER = re.compile(r"\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*", re.DOTALL)
END_MARKER = re.compile(r"\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*", re.DOTALL)


def strip_boilerplate(text: str) -> str:
    text = START_MARKER.split(text, maxsplit=1)[-1]
    text = END_MARKER.split(text, maxsplit=1)[0]
    return text.strip()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total_chars = 0

    for filename, url in BOOKS.items():
        dest = OUT_DIR / filename
        print(f"Downloading {filename} ...")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")

        cleaned = strip_boilerplate(raw)
        dest.write_text(cleaned, encoding="utf-8")
        total_chars += len(cleaned)
        print(f"  -> {len(cleaned):,} characters")

    print(f"\nDone. {len(BOOKS)} books, {total_chars:,} characters total in {OUT_DIR}")
    print("Next: python prepare_data.py")


if __name__ == "__main__":
    main()
