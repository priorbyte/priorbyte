"""
QLoRA fine-tunes Llama 3.1 8B on the tutor-scope dataset (data/tutor_scope.jsonl)
using Unsloth -- the standard, well-documented way to fine-tune on a 6GB card.
Sized deliberately: the 31B model discussed for Priorbyte's Tutor doesn't fit
in 6GB VRAM even for QLoRA training, so this targets the 8B model instead,
which does.

Run on the machine with the RTX 3050 (or better), after:
    pip install -r requirements.txt
    python build_dataset.py
"""

from datasets import load_dataset
from transformers import TrainingArguments
from trl import SFTTrainer
from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template

MAX_SEQ_LENGTH = 2048
BASE_MODEL = "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit"  # pre-quantized, Unsloth-optimized
OUTPUT_DIR = "out/lora-adapter"
GGUF_OUTPUT_DIR = "out/gguf"


def main() -> None:
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL,
        max_seq_length=MAX_SEQ_LENGTH,
        load_in_4bit=True,
    )

    tokenizer = get_chat_template(tokenizer, chat_template="llama-3.1")

    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",  # trades speed for VRAM -- needed at this size on 6GB
        random_state=1337,
    )

    dataset = load_dataset("json", data_files="data/tutor_scope.jsonl", split="train")

    def format_example(example):
        return {"text": tokenizer.apply_chat_template(example["messages"], tokenize=False)}

    dataset = dataset.map(format_example)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            warmup_steps=5,
            # 30 examples is a small, narrow behavioral dataset -- several
            # epochs over it is normal here, this isn't a from-scratch
            # language-learning run. Watch the loss; stop early (Ctrl+C,
            # the adapter still saves) if it bottoms out well before this.
            num_train_epochs=6,
            learning_rate=2e-4,
            fp16=False,
            bf16=True,
            logging_steps=1,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=1337,
            output_dir=OUTPUT_DIR,
        ),
    )

    trainer.train()

    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"LoRA adapter saved to {OUTPUT_DIR}")

    # Merge LoRA into the base weights and export straight to GGUF so LM
    # Studio / Ollama can load it directly -- no separate llama.cpp
    # conversion step needed.
    print("Exporting merged model to GGUF (q4_k_m)...")
    model.save_pretrained_gguf(GGUF_OUTPUT_DIR, tokenizer, quantization_method="q4_k_m")
    print(f"GGUF model at {GGUF_OUTPUT_DIR} -- import this file into LM Studio.")


if __name__ == "__main__":
    main()
