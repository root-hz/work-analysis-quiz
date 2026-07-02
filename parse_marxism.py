#!/usr/bin/env python3
"""Parse extracted Marxism doc text into quiz JSON/JS."""
import re
import json

INPUT = r"C:\Users\Administrator\Projects\work-analysis-quiz\extracted_doc.txt"
OUTPUT = r"C:\Users\Administrator\Projects\work-analysis-quiz\data\marxism-questions.js"
STATS = r"C:\Users\Administrator\Projects\work-analysis-quiz\parse_stats.txt"

with open(INPUT, "r", encoding="utf-8") as f:
    text = f.read()

# Normalize whitespace but keep structure markers
text = text.replace("\r\n", "\n").replace("\r", "\n")
text = re.sub(r"\s+", " ", text)

CHAPTER_PATTERNS = [
    (r"导论", "导论"),
    (r"第一章[^第]*", "第一章 世界的物质性及发展规律"),
    (r"第二章[^第]*", "第二章 实践与认识及其发展规律"),
    (r"第三章[^第]*", "第三章 人类社会及其发展规律"),
    (r"第四章[^第]*", "第四章 资本主义的本质及规律"),
    (r"第五章[^第]*", "第五章 资本主义的发展及其趋势"),
    (r"第六章[^第]*", "第六章 社会主义的发展及其规律"),
]

TYPE_PATTERNS = [
    (r"一、单选题", "单选题"),
    (r"二、多选题", "多选题"),
    (r"一、单项选择题", "单选题"),
    (r"二、多选题", "多选题"),
    (r"一、单选题", "单选题"),
]

def split_chapters(raw: str):
    """Split text into chapter sections."""
    markers = []
    for pat, name in CHAPTER_PATTERNS:
        for m in re.finditer(pat, raw):
            markers.append((m.start(), name))
    markers.sort(key=lambda x: x[0])
    sections = []
    for i, (pos, name) in enumerate(markers):
        end = markers[i + 1][0] if i + 1 < len(markers) else len(raw)
        sections.append((name, raw[pos:end]))
    return sections

def split_types(chapter_text: str):
    """Split chapter into type sections."""
    markers = []
    for pat, name in TYPE_PATTERNS:
        for m in re.finditer(pat, chapter_text):
            markers.append((m.start(), name))
    markers.sort(key=lambda x: x[0])
    if not markers:
        return [("单选题", chapter_text)]
    sections = []
    for i, (pos, name) in enumerate(markers):
        end = markers[i + 1][0] if i + 1 < len(markers) else len(chapter_text)
        sections.append((name, chapter_text[pos:end]))
    return sections

def parse_options(block: str):
    """Extract options A-D from remaining text after stem."""
    options = []
    # Option delimiter is letter + dot; option text may contain Chinese punctuation like 、
    opt_pattern = re.compile(r"([A-H])[\.．、](.+?)(?=[A-H][\.．、]|$)")
    for m in opt_pattern.finditer(block):
        key = m.group(1)
        txt = m.group(2).strip()
        if txt:
            options.append({"key": key, "text": txt})
    return options

def parse_questions(section_text: str, qtype: str, chapter: str, start_id: int):
    questions = []
    qid = start_id

    # Find question starts: digit + dot + content + (answer)
    q_pattern = re.compile(
        r"(\d+)[\.．](.+?)[（(]\s*([A-D]+)\s*[）)]"
    )
    matches = list(q_pattern.finditer(section_text))
    for i, m in enumerate(matches):
        num = int(m.group(1))
        stem_raw = m.group(2).strip()
        answer = m.group(3).upper()

        # Text after this match until next question
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(section_text)
        after = section_text[start:end].strip()

        # Stem may contain embedded options in some malformed entries - clean stem
        stem = stem_raw
        options = parse_options(after)

        # If no options found, try parsing from stem (some questions inline options)
        if not options:
            # Check if stem ends with option-like content
            inline_opts = parse_options(stem_raw)
            if inline_opts:
                # stem is before first option
                first_opt = re.search(r"[A-H][\.．、]", stem_raw)
                if first_opt:
                    stem = stem_raw[: first_opt.start()].strip()
                    options = parse_options(stem_raw[first_opt.start() :])
            else:
                # Judgment-style or missing - skip if truly no options
                pass

        if not options and qtype != "判断题":
            # Try harder: split after answer marker in full match context
            full = section_text[m.start() : end]
            opt_part = re.sub(r"^\d+[\.．].+?[（(][A-D]+[）)]", "", full).strip()
            options = parse_options(opt_part)

        if not options:
            continue

        # Normalize multi answer letters sorted
        if qtype == "多选题":
            answer = "".join(sorted(set(answer)))

        questions.append({
            "id": qid,
            "type": qtype,
            "stem": stem,
            "answer": answer,
            "options": options,
            "chapter": chapter,
        })
        qid += 1

    return questions, qid

all_questions = []
qid = 1
stats = {"chapters": {}, "types": {"单选题": 0, "多选题": 0}, "failed": []}

for chapter_name, chapter_text in split_chapters(text):
    stats["chapters"][chapter_name] = {"单选题": 0, "多选题": 0}
    for qtype, type_text in split_types(chapter_text):
        qs, qid = parse_questions(type_text, qtype, chapter_name, qid)
        all_questions.extend(qs)
        stats["types"][qtype] = stats["types"].get(qtype, 0) + len(qs)
        stats["chapters"][chapter_name][qtype] = stats["chapters"][chapter_name].get(qtype, 0) + len(qs)

# Write JS
with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write("window.MARXISM_QUIZ_DATA = ")
    json.dump(all_questions, f, ensure_ascii=False, indent=2)
    f.write(";\n")

with open(STATS, "w", encoding="utf-8") as f:
    f.write(f"Total questions: {len(all_questions)}\n")
    f.write(json.dumps(stats, ensure_ascii=False, indent=2))
    if all_questions:
        f.write("\n\nSample first:\n")
        f.write(json.dumps(all_questions[0], ensure_ascii=False, indent=2))
        f.write("\n\nSample multi:\n")
        for q in all_questions:
            if q["type"] == "多选题":
                f.write(json.dumps(q, ensure_ascii=False, indent=2))
                break

print("DONE", len(all_questions))
