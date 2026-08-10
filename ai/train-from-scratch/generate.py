"""Loads out/ckpt.pt and samples a continuation from a prompt."""

import argparse
from pathlib import Path

import torch

from model import GPT

OUT_DIR = Path(__file__).parent / "out"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", type=str, default="\n")
    parser.add_argument("--max-new-tokens", type=int, default=300)
    parser.add_argument("--temperature", type=float, default=0.8)
    parser.add_argument("--top-k", type=int, default=40)
    args = parser.parse_args()

    ckpt_path = OUT_DIR / "ckpt.pt"
    if not ckpt_path.exists():
        raise SystemExit(f"No checkpoint at {ckpt_path} -- run train.py first.")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    # weights_only=False is safe here specifically because this checkpoint
    # was written by train.py on this same machine, not downloaded from
    # anywhere untrusted -- PyTorch's warning is a blanket one about
    # `torch.load` in general, not a finding about this file.
    checkpoint = torch.load(ckpt_path, map_location=device, weights_only=False)

    cfg = checkpoint["config"]
    vocab = checkpoint["vocab"]
    stoi = vocab["stoi"]
    itos = {int(k): v for k, v in vocab["itos"].items()}

    model = GPT(
        vocab_size=len(stoi),
        block_size=cfg["block_size"],
        n_layer=cfg["n_layer"],
        n_head=cfg["n_head"],
        n_embd=cfg["n_embd"],
        dropout=0.0,
    ).to(device)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    encode = lambda s: [stoi[c] for c in s if c in stoi]
    decode = lambda ids: "".join(itos[i] for i in ids)

    idx = torch.tensor([encode(args.prompt)], dtype=torch.long, device=device)
    out = model.generate(
        idx, max_new_tokens=args.max_new_tokens, temperature=args.temperature, top_k=args.top_k
    )
    print(decode(out[0].tolist()))


if __name__ == "__main__":
    main()
