"""Turn a structured question paper into a printable PDF.

Uses PyMuPDF, which is already part of the RAG service dependencies.
The renderer only draws the questions it is given. It does not call a model.
"""

import os
from typing import Any, Dict, List, Optional

try:
    import pymupdf as fitz
except ImportError:  # PyMuPDF older than the pymupdf module name
    import fitz

A4 = fitz.paper_rect("a4")

NAVY = (0.11, 0.20, 0.38)
INK = (0.12, 0.15, 0.20)
MUTED = (0.36, 0.41, 0.48)
RULE = (0.75, 0.78, 0.83)
PANEL = (0.96, 0.97, 0.98)
KEY_FILL = (0.42, 0.16, 0.14)

FONT_CANDIDATES = {
    "regular": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ],
    "bold": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ],
    "italic": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
    ],
}

BASE14 = {"regular": "helv", "bold": "hebo", "italic": "heit"}


def _total_marks(paper: Dict[str, Any]) -> int:
    total = 0
    found = False
    for section in paper.get("sections") or []:
        for question in section.get("questions") or []:
            total += int(question.get("marks") or 0)
            found = True
    if found:
        return total
    return int(paper.get("total_marks") or 0)


def format_duration(minutes: int) -> str:
    minutes = max(0, int(minutes or 0))
    hours, mins = divmod(minutes, 60)
    parts = []
    if hours:
        parts.append(f"{hours} Hour" + ("s" if hours != 1 else ""))
    if mins or not parts:
        parts.append(f"{mins} Minute" + ("s" if mins != 1 else ""))
    return " ".join(parts)


def _first_existing(paths: List[str]) -> Optional[str]:
    for path in paths:
        if path and os.path.isfile(path):
            return path
    return None


def _clean(value: Any) -> str:
    text = " ".join(str(value or "").replace("\x00", " ").split())
    return text


class ExamPdfBuilder:
    def __init__(self):
        self.doc = fitz.open()
        self.page = None
        self.y = 0.0
        self.margin = 48
        self.footer_reserve = 40
        self.width = float(A4.width)
        self.height = float(A4.height)
        self.content_width = self.width - (self.margin * 2)
        self.faces = self._load_faces()

    def _load_faces(self) -> Dict[str, Dict[str, Any]]:
        faces = {}
        for kind, builtin in BASE14.items():
            path = _first_existing(FONT_CANDIDATES[kind])
            if path:
                faces[kind] = {
                    "name": kind,
                    "file": path,
                    "measure": fitz.Font(fontfile=path),
                }
            else:
                faces[kind] = {
                    "name": builtin,
                    "file": None,
                    "measure": fitz.Font(builtin),
                }
        return faces

    def _install_fonts(self):
        for face in self.faces.values():
            if face["file"]:
                self.page.insert_font(fontname=face["name"], fontfile=face["file"])

    def _width(self, text: str, size: float, kind: str = "regular") -> float:
        return self.faces[kind]["measure"].text_length(text, fontsize=size)

    def _wrap(self, text: str, size: float, max_width: float, kind: str = "regular") -> List[str]:
        text = _clean(text)
        if not text:
            return [""]
        lines: List[str] = []
        current = ""
        for word in text.split(" "):
            if self._width(word, size, kind) > max_width:
                if current:
                    lines.append(current)
                    current = ""
                chunk = ""
                for char in word:
                    trial = chunk + char
                    if self._width(trial, size, kind) <= max_width:
                        chunk = trial
                    else:
                        if chunk:
                            lines.append(chunk)
                        chunk = char
                current = chunk
                continue
            trial = word if not current else f"{current} {word}"
            if self._width(trial, size, kind) <= max_width:
                current = trial
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines or [""]

    def _new_page(self):
        continued = self.page is not None
        self.page = self.doc.new_page(width=self.width, height=self.height)
        self._install_fonts()
        self.y = self.margin
        if continued:
            self._running_header()

    def _ensure(self, needed: float):
        limit = self.height - self.footer_reserve
        if self.page is None or self.y + needed > limit:
            self._new_page()

    def _hline(self, color=NAVY, width=1.0):
        self.page.draw_line(
            fitz.Point(self.margin, self.y),
            fitz.Point(self.width - self.margin, self.y),
            color=color,
            width=width,
        )

    def _write(self, text: str, size: float, kind: str, color, x: float, max_width: float) -> float:
        """Write wrapped text. Returns the baseline of the first line."""
        lines = self._wrap(text, size, max_width, kind)
        line_h = size * 1.42
        first_baseline = None
        for line in lines:
            self._ensure(line_h)
            baseline = self.y + size
            if first_baseline is None:
                first_baseline = baseline
            self.page.insert_text(
                fitz.Point(x, baseline),
                line,
                fontname=self.faces[kind]["name"],
                fontsize=size,
                color=color,
            )
            self.y = baseline + (size * 0.46)
        return first_baseline or self.y

    def _centered(self, text: str, size: float, kind: str, color):
        for line in self._wrap(text, size, self.content_width, kind):
            line_h = size * 1.4
            self._ensure(line_h)
            baseline = self.y + size
            line_width = self._width(line, size, kind)
            x = (self.width - line_width) / 2
            self.page.insert_text(
                fitz.Point(x, baseline),
                line,
                fontname=self.faces[kind]["name"],
                fontsize=size,
                color=color,
            )
            self.y = baseline + (size * 0.42)

    def _running_header(self):
        title = getattr(self, "running_title", "Question Paper")
        self.page.insert_text(
            fitz.Point(self.margin, self.y + 9),
            title[:90],
            fontname=self.faces["italic"]["name"],
            fontsize=8.5,
            color=MUTED,
        )
        self.y += 16
        self._hline(RULE, 0.6)
        self.y += 12

    def _draw_masthead(self, paper: Dict[str, Any]):
        self._hline(NAVY, 1.6)
        self.y += 4
        self._hline(NAVY, 0.5)
        self.y += 14
        self._centered("QUESTION PAPER", 11, "bold", NAVY)
        self.y += 4
        self._centered(_clean(paper.get("title")) or "Question Paper", 16, "bold", INK)
        subject = _clean(paper.get("subject"))
        if subject:
            self.y += 2
            self._centered(subject, 11, "regular", MUTED)
        grounded = _clean(paper.get("grounded_in"))
        if grounded:
            self.y += 3
            self._centered(grounded, 8.5, "italic", MUTED)
        self.y += 8
        self._hline(NAVY, 0.5)
        self.y += 3
        self._hline(NAVY, 1.6)
        self.y += 14

    def _draw_meta(self, paper: Dict[str, Any]):
        box_h = 28
        self._ensure(box_h + 8)
        rect = fitz.Rect(self.margin, self.y, self.width - self.margin, self.y + box_h)
        self.page.draw_rect(rect, color=(0.82, 0.85, 0.90), fill=PANEL, width=0.7)
        baseline = self.y + 18
        left = f"Time: {format_duration(paper.get('duration_minutes') or 0)}"
        right = f"Maximum Marks: {_total_marks(paper)}"
        self.page.insert_text(
            fitz.Point(self.margin + 10, baseline),
            left,
            fontname=self.faces["bold"]["name"],
            fontsize=10,
            color=INK,
        )
        right_w = self._width(right, 10, "bold")
        self.page.insert_text(
            fitz.Point(self.width - self.margin - 10 - right_w, baseline),
            right,
            fontname=self.faces["bold"]["name"],
            fontsize=10,
            color=INK,
        )
        self.y += box_h + 14

    def _draw_instructions(self, instructions: List[str]):
        items = [_clean(item) for item in instructions if _clean(item)]
        if not items:
            return
        self._write("Instructions", 11, "bold", NAVY, self.margin, self.content_width)
        self.y += 3
        for index, item in enumerate(items, start=1):
            self._write(f"{index}.  {item}", 10, "regular", INK, self.margin, self.content_width)
            self.y += 1
        self.y += 8

    def _draw_section(self, section: Dict[str, Any], show_answers: bool):
        questions = section.get("questions") or []
        if not questions:
            return
        each = int(section.get("marks_each") or questions[0].get("marks") or 0)
        total = sum(int(q.get("marks") or each) for q in questions)
        self.y += 6
        self._ensure(52)
        self._hline(RULE, 0.8)
        self.y += 10
        self._centered(f"SECTION {section.get('id') or ''}".strip(), 12, "bold", NAVY)
        self.y += 1
        self._centered(_clean(section.get("title")) or "Questions", 11, "bold", INK)
        self._centered(f"({len(questions)} × {each} = {total} Marks)", 9.5, "italic", MUTED)
        self.y += 8

        for question in questions:
            if show_answers:
                self._draw_answer(question)
            else:
                self._draw_question(question)

    def _draw_question(self, question: Dict[str, Any]):
        number = str(question.get("number"))
        marks = f"[{int(question.get('marks') or 0)}]"
        number_w = 26
        marks_w = self._width(marks, 10, "bold") + 8
        text_x = self.margin + number_w
        first_width = self.content_width - number_w - marks_w
        rest_width = self.content_width - number_w
        prompt_lines = self._wrap(question.get("prompt") or "", 11, first_width, "regular")
        # Rewrap continuation lines to the wider measure, keeping the first line short for the marks.
        if len(prompt_lines) > 1:
            remainder = _clean(question.get("prompt") or "")
            first = prompt_lines[0]
            if remainder.startswith(first):
                remainder = remainder[len(first):].strip()
                prompt_lines = [first] + (self._wrap(remainder, 11, rest_width, "regular") if remainder else [])

        line_h = 11 * 1.42
        self._ensure(line_h)
        baseline = self.y + 11
        self.page.insert_text(
            fitz.Point(self.margin, baseline),
            f"{number}.",
            fontname=self.faces["bold"]["name"],
            fontsize=11,
            color=INK,
        )
        self.page.insert_text(
            fitz.Point(self.width - self.margin - self._width(marks, 10, "bold"), baseline),
            marks,
            fontname=self.faces["bold"]["name"],
            fontsize=10,
            color=NAVY,
        )
        self.page.insert_text(
            fitz.Point(text_x, baseline),
            prompt_lines[0],
            fontname=self.faces["regular"]["name"],
            fontsize=11,
            color=INK,
        )
        self.y = baseline + (11 * 0.46)
        for line in prompt_lines[1:]:
            self._ensure(line_h)
            baseline = self.y + 11
            self.page.insert_text(
                fitz.Point(text_x, baseline),
                line,
                fontname=self.faces["regular"]["name"],
                fontsize=11,
                color=INK,
            )
            self.y = baseline + (11 * 0.46)

        options = question.get("options") or []
        if options:
            self.y += 3
            for index, option in enumerate(options):
                label = chr(ord("A") + index)
                self._write(
                    f"({label})   {_clean(option)}",
                    10.5,
                    "regular",
                    INK,
                    text_x,
                    rest_width,
                )
                self.y += 1

        parts = question.get("parts") or []
        if parts:
            self.y += 2
            for index, part in enumerate(parts):
                label = chr(ord("a") + index)
                self._write(
                    f"({label})  {_clean(part)}",
                    10.5,
                    "regular",
                    INK,
                    text_x,
                    rest_width,
                )
                self.y += 1
        self.y += 9

    def _draw_answer(self, question: Dict[str, Any]):
        number = str(question.get("number"))
        answer = _clean(question.get("answer")) or "—"
        explanation = _clean(question.get("explanation"))
        text_x = self.margin + 26
        line_h = 10.5 * 1.4
        self._ensure(line_h + 4)
        baseline = self.y + 10.5
        self.page.insert_text(
            fitz.Point(self.margin, baseline),
            f"{number}.",
            fontname=self.faces["bold"]["name"],
            fontsize=10.5,
            color=INK,
        )
        if question.get("type") == "mcq":
            body = f"({answer})"
            if explanation:
                body = f"({answer})  {explanation}"
        else:
            body = f"{answer} {explanation}".strip() if explanation else answer
        # Start the answer on the same line as its number.
        self.y = baseline - 10.5
        self._write(body, 10.5, "regular", INK, text_x, self.content_width - 26)
        self.y += 6

    def _draw_end_mark(self, label: str):
        # Keep a short closing line on the current page. Do not open a blank page for it.
        if self.y + 24 > self.height - self.footer_reserve:
            return
        self.y += 8
        self._centered(label, 9, "italic", MUTED)
        self.y += 4

    def _draw_answer_key(self, paper: Dict[str, Any]):
        self._new_page()
        box_h = 46
        self._ensure(box_h)
        rect = fitz.Rect(self.margin, self.y, self.width - self.margin, self.y + box_h)
        self.page.draw_rect(rect, color=KEY_FILL, fill=KEY_FILL, width=0)
        self.page.insert_text(
            fitz.Point(self.margin + 12, self.y + 20),
            "ANSWER KEY",
            fontname=self.faces["bold"]["name"],
            fontsize=13,
            color=(1, 1, 1),
        )
        self.page.insert_text(
            fitz.Point(self.margin + 12, self.y + 36),
            "For the instructor. Keep this section separate from the student paper.",
            fontname=self.faces["regular"]["name"],
            fontsize=9,
            color=(1, 0.94, 0.92),
        )
        self.y += box_h + 14
        for section in paper.get("sections") or []:
            self._draw_section(section, show_answers=True)
        self._draw_end_mark("— End of Answer Key —")

    def _stamp_footers(self):
        total = self.doc.page_count
        for index, page in enumerate(self.doc, start=1):
            y = self.height - 26
            page.draw_line(
                fitz.Point(self.margin, y - 8),
                fitz.Point(self.width - self.margin, y - 8),
                color=RULE,
                width=0.6,
            )
            page.insert_text(
                fitz.Point(self.margin, y),
                "AI Learning Companion",
                fontname=self.faces["regular"]["name"],
                fontsize=8,
                color=MUTED,
            )
            label = f"{index} / {total}"
            label_w = self._width(label, 8, "regular")
            page.insert_text(
                fitz.Point((self.width - label_w) / 2, y),
                label,
                fontname=self.faces["regular"]["name"],
                fontsize=8,
                color=MUTED,
            )
            right = "Question Paper"
            right_w = self._width(right, 8, "regular")
            page.insert_text(
                fitz.Point(self.width - self.margin - right_w, y),
                right,
                fontname=self.faces["regular"]["name"],
                fontsize=8,
                color=MUTED,
            )

    def build(self, paper: Dict[str, Any]) -> bytes:
        self.running_title = (_clean(paper.get("title")) or "Question Paper")[:90]
        self._new_page()
        self._draw_masthead(paper)
        self._draw_meta(paper)
        self._draw_instructions(paper.get("instructions") or [])
        for section in paper.get("sections") or []:
            self._draw_section(section, show_answers=False)
        self._draw_end_mark("— End of Question Paper —")
        if paper.get("include_answer_key"):
            self._draw_answer_key(paper)
        self._stamp_footers()
        if hasattr(self.doc, "subset_fonts"):
            try:
                self.doc.subset_fonts()
            except Exception as exc:
                print(f"Font subsetting skipped: {exc}")
        try:
            data = self.doc.tobytes(deflate=True, garbage=3)
        except Exception:
            data = self.doc.tobytes()
        self.doc.close()
        return data


def render_question_paper(paper: Dict[str, Any]) -> bytes:
    return ExamPdfBuilder().build(paper)
