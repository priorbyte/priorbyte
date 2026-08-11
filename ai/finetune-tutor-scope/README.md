# Fine-tuning the Tutor to stay on-topic

**Why this exists**: the live Priorbyte Tutor answered "how to get a
girlfriend" with real dating advice instead of redirecting to academics.
The system prompt (`web/src/lib/model/prompts.ts`) already says the Tutor
should redirect off-topic questions, but instruction-following isn't
perfectly reliable, especially on smaller/quantized local models. This
fine-tunes a model specifically on that behavior so it holds up better than
prompt instructions alone.

**Scope note**: this targets **Llama 3.1 8B**, not the 31B Gemma model
running in LM Studio. A 31B model doesn't fit in 6GB VRAM for QLoRA
training (even 4-bit inference alone takes ~20GB) — 8B is what actually
fits and trains on this hardware. If you want the 31B model to have this
behavior too, the practical path is a code-level guardrail around it
instead (checking/overriding its output), not fine-tuning it locally.

## Setup

```cmd
cd ai\finetune-tutor-scope
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Unsloth needs a real CUDA GPU — confirm first:
```cmd
python -c "import torch; print(torch.cuda.is_available())"
```

## 1. Build the dataset

```cmd
python build_dataset.py
```

Writes `data/tutor_scope.jsonl` — 30 examples (20 off-topic redirects, 10
on-topic tutoring responses, kept roughly balanced so the model doesn't
overfit into refusing everything). This is a small seed set; add more
examples directly in `build_dataset.py`'s `OFF_TOPIC`/`ON_TOPIC` lists for
better generalization; more phrasings and more subjects both help.

## 2. Train

```cmd
python train.py
```

This QLoRA fine-tunes `unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit`, then
automatically merges and exports a ready-to-use GGUF file to
`out/gguf/`. Watch the printed loss — with only 30 examples it should drop
fast; if it's still dropping steadily by the last epoch, that's a sign more
data would help further.

## 3. Load it in LM Studio

1. Open LM Studio → the folder/import icon → **Import Model**.
2. Point it at the `.gguf` file inside `out/gguf/`.
3. Load it in the chat tab, test with the exact questions from
   `build_dataset.py`'s `OFF_TOPIC` list plus a few *new* off-topic phrasings
   it wasn't trained on directly — that's the real test of whether it
   generalized or just memorized the training examples.
4. If it holds up, point `LOCAL_MODEL_NAME` at this new model's identifier
   in LM Studio's server tab instead of the 31B one, for the Tutor
   specifically.

## Honest expectations

30 examples teaches a *behavior pattern* (redirect off-topic, engage
on-topic), which is a much easier fine-tuning target than teaching new
knowledge — but it can still fail to generalize to phrasings very different
from the training set. If it still slips through on a genuinely novel
off-topic question, that's a sign to add more varied examples to the
dataset and retrain, not necessarily a sign the approach doesn't work.
