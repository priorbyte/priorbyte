"""
Quick smoke test proving the pipeline actually works end to end on a tiny
sample, with a tiny config sized to run fast on CPU. Not the real training
config (see train.py's Config for the real 6GB-GPU-sized defaults) -- this
just proves the code runs, loss goes down, and generation produces
something learned rather than random noise.
"""

from dataclasses import replace

import torch

from train import Config, estimate_loss, get_batch, load_split
from model import GPT
import json

cfg = Config(
    n_layer=2,
    n_head=2,
    n_embd=64,
    block_size=32,
    batch_size=8,
    max_steps=300,
    eval_interval=50,
    eval_iters=5,
    learning_rate=1e-3,
)

device = "cpu"
torch.manual_seed(cfg.seed)

with open("data/vocab.json", encoding="utf-8") as f:
    vocab = json.load(f)
vocab_size = len(vocab["stoi"])

train_data = load_split("train")
val_data = load_split("val")
print(f"train tokens: {len(train_data)}, val tokens: {len(val_data)}, vocab: {vocab_size}")

model = GPT(vocab_size, cfg.block_size, cfg.n_layer, cfg.n_head, cfg.n_embd, cfg.dropout).to(device)
print(f"params: {sum(p.numel() for p in model.parameters()):,}")

optimizer = torch.optim.AdamW(model.parameters(), lr=cfg.learning_rate, weight_decay=cfg.weight_decay)

for step in range(cfg.max_steps + 1):
    if step % cfg.eval_interval == 0:
        losses = estimate_loss(model, train_data, val_data, cfg, device)
        print(f"step {step:4d} | train {losses['train']:.4f} | val {losses['val']:.4f}")
    x, y = get_batch(train_data, cfg.block_size, cfg.batch_size, device)
    _, loss = model(x, y)
    optimizer.zero_grad(set_to_none=True)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.grad_clip)
    optimizer.step()

torch.save({"model_state": model.state_dict(), "config": cfg.__dict__, "vocab": vocab}, "out/smoke_ckpt.pt")
print("saved out/smoke_ckpt.pt")

# Generate from the trained smoke-test model
stoi, itos = vocab["stoi"], {int(k): v for k, v in vocab["itos"].items()}
encode = lambda s: [stoi[c] for c in s if c in stoi]
decode = lambda ids: "".join(itos[i] for i in ids)

model.eval()
idx = torch.tensor([encode("The ghost")], dtype=torch.long)
out = model.generate(idx, max_new_tokens=200, temperature=0.8, top_k=20)
print("\n--- generated ---")
print(decode(out[0].tolist()))
