#!/usr/bin/env python3
"""Parse English PDF quiz files into JS data modules."""
import json
import re
from pathlib import Path

import fitz

DESKTOP = Path(r"C:\Users\Administrator\Desktop")
DATA_DIR = Path(__file__).parent / "data"

PDFS = {
    "listening": DESKTOP / "英语听力.pdf",
    "reading": DESKTOP / "英语阅读理解.pdf",
    "vocabulary": DESKTOP / "英语词汇题.pdf",
}

VOCAB_PART_A_ANSWERS = {
    "Unit 1": ["B", "A", "A", "B", "B"],
    "Unit 4": ["A", "A", "B", "A", "B"],
    "Unit 5": ["B", "A", "B", "A", "A"],
    "Unit 8": ["A", "A", "B", "B", "A"],
}

VOCAB_PART_B_ANSWERS = {
    "Unit 1": ["B", "C", "A", "B", "A"],
    "Unit 4": ["B", "A", "C", "B", "A"],
    "Unit 5": ["B", "C", "B", "A", "C"],
    "Unit 8": ["C", "A", "B", "A", "C"],
}


def extract_pdf_text(path: Path) -> str:
    doc = fitz.open(path)
    return "\n".join(page.get_text() for page in doc)


def strip_page_noise(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"-- \d+ of \d+ --", "", text)
    text = re.sub(r"\n\d+\n", "\n", text)
    text = re.sub(r"^\d+\n", "", text)
    text = re.sub(r"[\u200b\ufeff]", "", text)
    return text


def clean_option_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text


def make_question(qid, qtype, chapter, stem, options, answer, explanation=""):
    return {
        "id": qid,
        "type": qtype,
        "difficulty": "适中",
        "stem": stem,
        "answer": answer,
        "options": options,
        "chapter": chapter,
        "explanation": explanation,
    }


def write_js(var_name: str, data: list, out_path: Path):
    out_path.write_text(
        f"window.{var_name} = {json.dumps(data, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )


def parse_options_from_lines(option_lines: list) -> list:
    blob = " ".join(option_lines)
    options = []
    for m in re.finditer(r"([A-D])\)\s*(.*?)(?=(?:[A-D]\)|$))", blob):
        txt = clean_option_text(m.group(2))
        if txt:
            options.append({"key": m.group(1), "text": txt})
    return options


def parse_listening(text: str) -> list:
    text = strip_page_noise(text)
    text = re.sub(r"^英语听力\s*", "", text)

    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    unit = ""
    section = ""
    qid = 0
    questions = []
    i = 0

    def is_meta(line: str) -> bool:
        return bool(
            re.match(r"^Unit\s*\d+$", line, re.I)
            or re.match(r"^Task\s", line, re.I)
            or re.match(r"^Passage\s", line, re.I)
        )

    while i < len(lines):
        line = lines[i]

        if re.match(r"^Unit\s*(\d+)$", line, re.I):
            unit = f"Unit{re.search(r'\d+', line).group()}"
            i += 1
            continue

        if re.match(r"^Task\s", line, re.I):
            section = line
            i += 1
            continue

        if re.match(r"^Passage\s", line, re.I):
            section = line
            i += 1
            continue

        q_m = re.match(r"^(\d+)\.\s*(.*)$", line)
        if not q_m:
            i += 1
            continue

        qnum = q_m.group(1)
        rest = q_m.group(2).strip()
        option_lines = []
        if rest:
            option_lines.append(rest)

        i += 1
        while i < len(lines):
            cur = lines[i]
            ans_m = re.match(r"^(正确答案|标准答案)[：:]\s*([A-D])", cur)
            if ans_m:
                answer = ans_m.group(2)
                options = parse_options_from_lines(option_lines)
                if options:
                    qid += 1
                    chapter = f"{unit} · {section}" if section else unit
                    questions.append(
                        make_question(
                            qid,
                            "单选题",
                            chapter,
                            f"听力题 {qnum}",
                            options,
                            answer,
                        )
                    )
                i += 1
                break

            if re.match(r"^(\d+)\.\s", cur) or is_meta(cur):
                break

            if re.match(r"^[A-D]\)", cur) or option_lines:
                option_lines.append(cur)
            i += 1

    return questions


def extract_reading_answer(stem: str) -> tuple[str, str]:
    patterns = [
        r"[（(]\s*([A-D])\s*[）)]\s*$",
        r"\s([A-D])\s+[\u4e00-\u9fff]",
        r"\s([A-D])\s*$",
    ]
    for pat in patterns:
        m = re.search(pat, stem)
        if m:
            answer = m.group(1)
            clean = stem[: m.start()].strip()
            clean = re.sub(r"[？?]\s*$", "?", clean)
            return clean, answer
    return stem, ""


def parse_reading(text: str) -> list:
    text = strip_page_noise(text)
    text = re.sub(r"^从中出两篇.*?\n", "", text)

    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    unit = ""
    passage = ""
    questions = []
    qid = 0
    i = 0

    while i < len(lines):
        line = lines[i]

        if re.match(r"^Unit\s*\d+$", line, re.I):
            unit = re.sub(r"\s+", "", line)
            i += 1
            continue

        if re.match(r"^Passage\s*\d+$", line, re.I):
            passage = re.sub(r"\s+", "", line)
            i += 1
            continue

        q_m = re.match(r"^(\d+)\.(.+)$", line)
        if not q_m:
            i += 1
            continue

        content_lines = [q_m.group(2).strip()]
        i += 1
        while i < len(lines):
            nxt = lines[i]
            if re.match(r"^\d+\.", nxt):
                break
            if re.match(r"^Passage\s*\d+$", nxt, re.I):
                break
            if re.match(r"^Unit\s*\d+$", nxt, re.I):
                break
            content_lines.append(nxt)
            i += 1

        rest = re.sub(r"\s+", " ", " ".join(content_lines)).strip()
        opt_pattern = re.compile(r"([A-D])[\.．]\s*(.+?)(?=(?:[A-D][\.．])|$)")
        first_opt = opt_pattern.search(rest)
        if not first_opt:
            continue

        stem_part = rest[: first_opt.start()].strip()
        stem_part, answer = extract_reading_answer(stem_part)

        options = []
        for om in opt_pattern.finditer(rest):
            opt_text = clean_option_text(om.group(2))
            if opt_text:
                options.append({"key": om.group(1), "text": opt_text})

        if not answer:
            inline = re.search(r"[（(]\s*([A-D])\s*[）)]", rest)
            if inline:
                answer = inline.group(1)

        if options and answer:
            qid += 1
            questions.append(
                make_question(
                    qid,
                    "单选题",
                    f"{unit} · {passage}",
                    stem_part,
                    options,
                    answer,
                )
            )

    return questions


def parse_vocab_part_a(lines: list, unit: str, part: str, start_qid: int) -> tuple[list, int]:
    questions = []
    qid = start_qid
    answers = VOCAB_PART_A_ANSWERS.get(unit, [])
    blob = re.sub(r"\s+", " ", " ".join(lines))

    qnum = 0
    for m in re.finditer(
        r"(\d+)\.\s*(.+?\([a-zA-Z]+/[a-zA-Z]+\)[^0-9]*)",
        blob,
    ):
        sentence = m.group(2).strip()
        pair_m = re.search(r"\(([a-zA-Z]+)/([a-zA-Z]+)\)", sentence)
        if not pair_m:
            continue
        w1, w2 = pair_m.group(1), pair_m.group(2)
        answer = answers[qnum] if qnum < len(answers) else "A"
        qnum += 1
        qid += 1
        questions.append(
            make_question(
                qid,
                "词汇选择",
                f"{unit} · {part}",
                sentence,
                [{"key": "A", "text": w1}, {"key": "B", "text": w2}],
                answer,
            )
        )
    return questions, qid


def parse_vocab_part_b(lines: list, unit: str, part: str, start_qid: int) -> tuple[list, int]:
    questions = []
    qid = start_qid
    manual = list(VOCAB_PART_B_ANSWERS.get(unit, []))
    manual_idx = 0

    blob = re.sub(r"\s+", " ", " ".join(lines))
    chunks = re.split(r"(?=\d+\.\s)", blob)

    for chunk in chunks:
        chunk = chunk.strip()
        m = re.match(r"^(\d+)\.\s*(.+)$", chunk)
        if not m:
            continue
        rest = m.group(2).strip()

        opt_pattern = re.compile(r"([A-C])[\.．]\s*(.+?)(?=(?:[A-C][\.．])|$)")
        first_opt = opt_pattern.search(rest)
        if not first_opt:
            continue

        stem = rest[: first_opt.start()].strip()
        stem = re.sub(r"_+", "______", stem)

        options = []
        answer = ""
        for om in opt_pattern.finditer(rest):
            key = om.group(1)
            txt = clean_option_text(om.group(2))
            prefix = rest[max(0, om.start() - 3) : om.start() + 2]
            if re.search(r"(?:^|\s)" + key + r"\.\s*$", prefix):
                answer = key
            options.append({"key": key, "text": txt})

        if not answer and manual_idx < len(manual):
            answer = manual[manual_idx]
            manual_idx += 1

        if options and answer:
            qid += 1
            questions.append(
                make_question(qid, "单选题", f"{unit} · {part}", stem, options, answer)
            )

    return questions, qid


def parse_vocab_part_c(lines: list, unit: str, part: str, start_qid: int) -> tuple[list, int]:
    questions = []
    qid = start_qid
    parsed = []
    i = 0
    while i < len(lines):
        line = re.sub(r"\s+", " ", lines[i].strip())
        m = re.match(r"^(\d+)\.\s*(.+)$", line)
        if m:
            body = m.group(2).strip()
            words = body.split()
            if words and re.match(r"^[a-zA-Z]+$", words[-1]) and "______" in body:
                sentence = " ".join(words[:-1])
                answer_word = words[-1]
            elif "______" in body or "___" in body:
                sentence = body
                answer_word = ""
                j = i + 1
                while j < len(lines):
                    nxt = lines[j].strip()
                    if re.match(r"^\d+\.", nxt):
                        break
                    if re.match(r"^[a-zA-Z][a-zA-Z']*$", nxt):
                        answer_word = nxt
                        i = j
                        break
                    j += 1
            else:
                i += 1
                continue

            if sentence and answer_word:
                sentence = re.sub(r"_+", "______", sentence)
                parsed.append((sentence, answer_word))
        i += 1

    all_answers = [a for _, a in parsed]
    for sentence, answer_word in parsed:
        qid += 1
        distractors = [w for w in all_answers if w.lower() != answer_word.lower()]
        pool = list(dict.fromkeys(distractors))[:3]
        while len(pool) < 3:
            pool.append(f"word{len(pool) + 1}")

        options = [{"key": "A", "text": answer_word}]
        for key, text in zip(["B", "C", "D"], pool):
            options.append({"key": key, "text": text})

        questions.append(
            make_question(qid, "词汇填空", f"{unit} · {part}", sentence, options, "A")
        )

    return questions, qid


def parse_vocabulary(text: str) -> list:
    text = strip_page_noise(text)
    text = re.sub(r"^英语词汇题.*?\n", "", text)

    questions = []
    qid = 0
    unit_parts = re.split(r"(Unit\s+\d+)", text, flags=re.I)

    idx = 1
    while idx < len(unit_parts):
        unit = re.sub(r"\s+", " ", unit_parts[idx]).strip()
        body = unit_parts[idx + 1] if idx + 1 < len(unit_parts) else ""
        idx += 2

        part_splits = re.split(r"([ABC])\s*部分", body, flags=re.I)
        pidx = 1
        while pidx < len(part_splits):
            part_label = part_splits[pidx].upper()
            part = f"{part_label} 部分"
            part_body = part_splits[pidx + 1] if pidx + 1 < len(part_splits) else ""
            pidx += 2

            lines = []
            for ln in part_body.split("\n"):
                ln = ln.strip()
                if not ln or re.match(r"^[ABC]\s*部分", ln, re.I):
                    continue
                lines.append(ln)

            if part_label == "A":
                qs, qid = parse_vocab_part_a(lines, unit, part, qid)
            elif part_label == "B":
                qs, qid = parse_vocab_part_b(lines, unit, part, qid)
            else:
                qs, qid = parse_vocab_part_c(lines, unit, part, qid)
            questions.extend(qs)

    return questions


def main():
    results = {}

    listening = parse_listening(extract_pdf_text(PDFS["listening"]))
    write_js("ENGLISH_LISTENING_DATA", listening, DATA_DIR / "english-listening.js")
    results["listening"] = len(listening)

    reading = parse_reading(extract_pdf_text(PDFS["reading"]))
    write_js("ENGLISH_READING_DATA", reading, DATA_DIR / "english-reading.js")
    results["reading"] = len(reading)

    vocabulary = parse_vocabulary(extract_pdf_text(PDFS["vocabulary"]))
    write_js("ENGLISH_VOCABULARY_DATA", vocabulary, DATA_DIR / "english-vocabulary.js")
    results["vocabulary"] = len(vocabulary)

    (DATA_DIR / "english-parse-stats.txt").write_text(
        "\n".join(f"{k}: {v} questions" for k, v in results.items()) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
