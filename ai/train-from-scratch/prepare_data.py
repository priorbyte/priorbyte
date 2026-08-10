"""
Turns everything in data/raw/*.txt into a character-level dataset.

Character-level tokenization is the simplest possible choice -- no subword
training step, no external tokenizer library, every unique character in
your corpus becomes one token. It costs some model efficiency (a subword
tokenizer would let the same parameter count go further) but keeps this
pipeline dependency-free and easy to reason about end to end.
"""

import json
from pathlib import Path

import numpy as np

RAW_DIR = Path(__file__).parent / "data" / "raw"
OUT_DIR = Path(__file__).parent / "data"
VAL_FRACTION = 0.1


def main() -> None:
    txt_files = sorted(RAW_DIR.glob("*.txt"))
    if not txt_files:
        raise SystemExit(
            f"No .txt files found in {RAW_DIR}. Add at least one text file and rerun."
        )

    text = ""
    for f in txt_files:
        text += f.read_text(encoding="utf-8", errors="ignore")

    print(f"Loaded {len(txt_files)} file(s), {len(text):,} characters total.")

    chars = sorted(set(text))
    vocab_size = len(chars)
    stoi = {ch: i for i, ch in enumerate(chars)}
    itos = {i: ch for i, ch in enumerate(chars)}
    print(f"Vocabulary size: {vocab_size} unique characters.")

    data = np.array([stoi[c] for c in text], dtype=np.uint16)
    split = int(len(data) * (1 - VAL_FRACTION))
    train_data, val_data = data[:split], data[split:]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    train_data.tofile(OUT_DIR / "train.bin")
    val_data.tofile(OUT_DIR / "val.bin")
    with open(OUT_DIR / "vocab.json", "w", encoding="utf-8") as f:
        json.dump({"stoi": stoi, "itos": itos}, f, ensure_ascii=False)

    print(f"Wrote train.bin ({len(train_data):,} tokens), val.bin ({len(val_data):,} tokens), vocab.json")


if __name__ == "__main__":
    main()
