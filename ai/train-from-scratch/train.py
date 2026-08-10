"""
Training loop for the from-scratch GPT in model.py. Defaults are sized for a
6GB laptop GPU (RTX 4050-class) -- roughly a 10M-parameter model. Adjust the
Config below if you have more/less VRAM; if you hit a CUDA out-of-memory
error, lower batch_size first, then n_embd/n_layer.
"""

import json
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

from model import GPT

DATA_DIR = Path(__file__).parent / "data"
OUT_DIR = Path(__file__).parent / "out"


@dataclass
class Config:
    # Model size
    n_layer: int = 6
    n_head: int = 6
    n_embd: int = 384
    block_size: int = 256
    dropout: float = 0.1

    # Training
    batch_size: int = 32
    max_steps: int = 5000
    learning_rate: float = 3e-4
    weight_decay: float = 0.1
    grad_clip: float = 1.0

    # Bookkeeping
    eval_interval: int = 250
    eval_iters: int = 50
    seed: int = 1337


def load_split(name: str) -> np.ndarray:
    return np.memmap(DATA_DIR / f"{name}.bin", dtype=np.uint16, mode="r")


def get_batch(data: np.ndarray, block_size: int, batch_size: int, device: str):
    ix = torch.randint(len(data) - block_size - 1, (batch_size,))
    x = torch.stack([torch.from_numpy(data[i : i + block_size].astype(np.int64)) for i in ix])
    y = torch.stack([torch.from_numpy(data[i + 1 : i + 1 + block_size].astype(np.int64)) for i in ix])
    return x.to(device), y.to(device)


@torch.no_grad()
def estimate_loss(model: GPT, train_data, val_data, cfg: Config, device: str) -> dict[str, float]:
    model.eval()
    out = {}
    for name, data in (("train", train_data), ("val", val_data)):
        losses = torch.zeros(cfg.eval_iters)
        for i in range(cfg.eval_iters):
            x, y = get_batch(data, cfg.block_size, cfg.batch_size, device)
            _, loss = model(x, y)
            losses[i] = loss.item()
        out[name] = losses.mean().item()
    model.train()
    return out


def main() -> None:
    cfg = Config()
    torch.manual_seed(cfg.seed)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")
    if device == "cpu":
        print("WARNING: no CUDA GPU detected -- training will be much slower.")

    vocab_path = DATA_DIR / "vocab.json"
    if not vocab_path.exists():
        raise SystemExit("Run prepare_data.py first -- data/vocab.json not found.")
    with open(vocab_path, encoding="utf-8") as f:
        vocab = json.load(f)
    vocab_size = len(vocab["stoi"])

    train_data = load_split("train")
    val_data = load_split("val")
    print(f"Train tokens: {len(train_data):,} | Val tokens: {len(val_data):,} | Vocab: {vocab_size}")

    model = GPT(
        vocab_size=vocab_size,
        block_size=cfg.block_size,
        n_layer=cfg.n_layer,
        n_head=cfg.n_head,
        n_embd=cfg.n_embd,
        dropout=cfg.dropout,
    ).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {n_params:,}")

    optimizer = torch.optim.AdamW(
        model.parameters(), lr=cfg.learning_rate, weight_decay=cfg.weight_decay
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    best_val_loss = float("inf")
    t0 = time.time()

    for step in range(cfg.max_steps + 1):
        if step % cfg.eval_interval == 0:
            losses = estimate_loss(model, train_data, val_data, cfg, device)
            elapsed = time.time() - t0
            print(
                f"step {step:5d} | train loss {losses['train']:.4f} | "
                f"val loss {losses['val']:.4f} | {elapsed:.0f}s elapsed"
            )
            if losses["val"] < best_val_loss:
                best_val_loss = losses["val"]
                torch.save(
                    {
                        "model_state": model.state_dict(),
                        "config": cfg.__dict__,
                        "vocab": vocab,
                    },
                    OUT_DIR / "ckpt.pt",
                )

        x, y = get_batch(train_data, cfg.block_size, cfg.batch_size, device)
        _, loss = model(x, y)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.grad_clip)
        optimizer.step()

    print(f"Done. Best val loss: {best_val_loss:.4f}. Checkpoint at {OUT_DIR / 'ckpt.pt'}")


if __name__ == "__main__":
    main()
