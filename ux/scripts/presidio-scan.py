#!/usr/bin/env python3
"""A second reader for the privacy read that is not a model (ARC-004 design 4, T-562).

Runs Microsoft Presidio's analyzer, with spaCy's small English model, over files
outside data/ and prints each hit as path:line:KIND, never the text it matched:

    python3 ux/scripts/presidio-scan.py [--min-score 0.5] [<path>...]

With no paths it takes the ledger's next list (node ux/scripts/privacy-ledger.mjs
next). Kinds: PERSON, LOCATION, DATE_TIME, PHONE_NUMBER, EMAIL_ADDRESS. A hit is
a line to look at with judgement, not a finding: most are invented examples or
the harness's own words. A path under data/ is skipped, never read; a file that
is not UTF-8 text (an image, a PDF) is skipped and counted, for the read to look
at itself.

Optional: nothing waits on it. Exit 0: ran (hits or none). Exit 3: Presidio or
the model is not installed here (pip install presidio-analyzer, then
python3 -m spacy download en_core_web_sm). Exit 2: could not run.
"""

import logging
import os
import subprocess
import sys

ENTITIES = ["PERSON", "LOCATION", "DATE_TIME", "PHONE_NUMBER", "EMAIL_ADDRESS"]
MODEL = "en_core_web_sm"
CHUNK_CHARS = 20000  # spaCy reads up to a million; smaller chunks keep memory flat
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def is_record(rel):
    return rel == "data" or rel.startswith("data/")


def chunks(text):
    """(first line number, text) pieces on line boundaries, each under CHUNK_CHARS where a line allows."""
    lines = text.split("\n")
    start, buf, size = 1, [], 0
    for i, line in enumerate(lines, 1):
        if buf and size + len(line) + 1 > CHUNK_CHARS:
            yield start, "\n".join(buf)
            start, buf, size = i, [], 0
        buf.append(line)
        size += len(line) + 1
    if buf:
        yield start, "\n".join(buf)


def line_of(piece, first, offset):
    return first + piece.count("\n", 0, offset)


def ledger_next():
    out = subprocess.run(["node", "ux/scripts/privacy-ledger.mjs", "next"], cwd=ROOT, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError("the ledger's next list could not be read")
    return [p for p in out.stdout.split("\n") if p and not p.startswith("privacy ledger:")]


def offline():
    """Nothing it reads reaches the web: the email check's domain list is the one
    tldextract ships, never fetched (it would otherwise ask publicsuffix.org)."""
    import tldextract
    import tldextract.tldextract as tx

    tx.TLD_EXTRACTOR = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)


def engine():
    logging.getLogger("presidio-analyzer").setLevel(logging.ERROR)
    offline()
    from presidio_analyzer import AnalyzerEngine
    from presidio_analyzer.nlp_engine import NlpEngineProvider

    nlp = NlpEngineProvider(nlp_configuration={
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "en", "model_name": MODEL}],
    }).create_engine()
    return AnalyzerEngine(nlp_engine=nlp, supported_languages=["en"])


def main(argv):
    min_score = 0.5
    paths = []
    it = iter(argv)
    for a in it:
        if a == "--min-score":
            min_score = float(next(it))
        else:
            paths.append(a)
    try:
        analyzer = engine()
    except (ImportError, OSError):
        print("presidio scan: Presidio or its English model is not installed here; nothing scanned", file=sys.stderr)
        return 3
    if not paths:
        paths = ledger_next()
    hits = skipped = scanned = 0
    for given in paths:
        rel = os.path.relpath(os.path.abspath(given), ROOT).replace(os.sep, "/")
        if rel.startswith("..") or is_record(rel):
            skipped += 1
            continue
        try:
            with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
                text = f.read()
        except (UnicodeDecodeError, OSError):
            skipped += 1
            continue
        scanned += 1
        seen = set()
        for first, piece in chunks(text):
            for r in analyzer.analyze(text=piece, language="en", entities=ENTITIES, score_threshold=min_score):
                key = (line_of(piece, first, r.start), r.entity_type)
                if key not in seen:
                    seen.add(key)
        for line, kind in sorted(seen):
            print(f"{rel}:{line}:{kind}")
        hits += len(seen)
    print(f"presidio scan: {scanned} files read, {hits} lines with a hit, {skipped} skipped (data/, outside, or not text)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:  # never the text: only what kind of failure
        print(f"presidio scan: could not run ({type(e).__name__})", file=sys.stderr)
        sys.exit(2)
