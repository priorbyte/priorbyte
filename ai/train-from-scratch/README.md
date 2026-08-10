# Training a language model from zero

Honest scope, read this before running anything: this trains a genuinely
from-scratch transformer — no pretrained weights, the architecture and every
weight starts randomly initialized and learns only from whatever text you
feed it. That's a real, different thing from fine-tuning DeepSeek/Llama, and
it comes with a real tradeoff:

- **What this gives you**: a model you fully own and understand, trained
  entirely on data you choose, with zero dependency on anyone else's weights.
- **What this does NOT give you**: anything close to DeepSeek-R1 1.5B's
  quality. A laptop RTX 4050 training for hours-to-a-few-days will produce a
  small model (a few million parameters) that learns local structure —
  spelling, common word patterns, maybe short coherent phrases in a narrow
  domain — not fluent, general-purpose language understanding. Real
  from-scratch models that write fluently (even GPT-2-small, 124M params)
  were trained on GPU clusters for many GPU-days on tens of billions of
  tokens of text.

Use this for what it actually is: a real, working, fully-from-zero training
pipeline you can point at any text and watch learn — good for understanding
how this works and for narrow/toy use cases, not a drop-in replacement for
the DeepSeek/Llama models already wired into Priorbyte's `PriorbyteModel`
layer. Nothing here is meant to be deployed as Priorbyte's live model; it
does not implement `PriorbyteModel` and is not connected to the app.

## Setup (on the laptop with the RTX 4050)

```cmd
cd ai\train-from-scratch
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

This installs PyTorch with CUDA support. If `torch.cuda.is_available()`
prints `False` after install, you have the CPU-only build — reinstall from
https://pytorch.org/get-started/locally/ with the CUDA option matching your
driver version.

## 1. Prepare data

Put one or more `.txt` files in `data/raw/`, then run:

```cmd
python prepare_data.py
```

This concatenates everything in `data/raw/`, builds a character-level
vocabulary (simplest possible tokenizer — no external dependency, no
subword training step), and writes `data/train.bin`, `data/val.bin`, and
`data/vocab.json`.

More data = a better model, but even a single book-length text (a few MB)
is enough to see the model learn real structure.

## 2. Train

```cmd
python train.py
```

Default config (`train.py`'s `Config` class) targets a 6GB card:
6 layers, 6 heads, 384 embedding dim, 256-token context, batch size 32 —
roughly a 10M-parameter model. Checkpoints save to `out/ckpt.pt` every
`eval_interval` steps, so you can stop anytime (Ctrl+C) and still have a
usable checkpoint.

Watch `train_loss` / `val_loss` in the console — a healthy run starts
around 4-5 (roughly "random guessing over the vocabulary") and should fall
below 2 within the first few thousand steps on a small dataset.

## 3. Generate

```cmd
python generate.py --prompt "Once upon a time"
```

Loads `out/ckpt.pt` and samples a continuation. This is the actual proof
the model learned something — if output is still random characters after a
few thousand training steps, something's wrong (check the loss curve).

## Scaling this up later

If you want a noticeably better result without turning this into a
multi-month research project:
- More data (aim for tens of MB of text minimum for anything beyond toy
  quality).
- Bigger config (`n_layer`, `n_embd`) — but 6GB VRAM caps how far this goes
  before you hit out-of-memory; reduce `batch_size` first if you scale up
  the model.
- A subword tokenizer (e.g. training a BPE tokenizer) instead of
  character-level — meaningfully improves quality per parameter, but adds a
  real preprocessing step this minimal version deliberately skips for
  simplicity.
