"""生成本站中文变量字体子集；仅构建时下载官方源，网页运行时不联网。

准备：python3 -m venv /tmp/outsider-fonts
      /tmp/outsider-fonts/bin/pip install -r scripts/font-requirements.txt
生成：/tmp/outsider-fonts/bin/python scripts/subset-fonts.py
需要 Node.js 22.18 或更新版本读取源码字符；可设置 FONT_NODE 指定可执行文件。
"""

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.request import urlopen

from fontTools import subset, version
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "src/assets/fonts"
COMMIT = "2894aab31764f10f29c421bdfd2340d3b382d384"
SOURCE_URL = f"https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
LICENSE_URL = f"https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/notosanssc/OFL.txt"
SOURCE_GIT_BLOB = "fb0637bafbcd804fe32152370a1225990745b4bc"
FONT_FILENAME = "noto-sans-sc-site-wght.woff2"
LATIN_SOURCES = [
    "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
    "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
    "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
    "@fontsource/ibm-plex-sans-condensed/files/ibm-plex-sans-condensed-latin-600-normal.woff2",
    "@fontsource/ibm-plex-sans-condensed/files/ibm-plex-sans-condensed-latin-700-normal.woff2",
]


def download(url: str) -> bytes:
    with urlopen(url, timeout=60) as response:
        return response.read()


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    cache = Path(tempfile.gettempdir()) / "outsider-01-font-source"
    cache.mkdir(exist_ok=True)
    source_path = cache / f"{COMMIT}-NotoSansSC.ttf"
    if not source_path.exists():
        source_path.write_bytes(download(SOURCE_URL))
    original = source_path.read_bytes()
    blob = hashlib.sha1(f"blob {len(original)}\0".encode() + original).hexdigest()
    if blob != SOURCE_GIT_BLOB:
        raise ValueError("源字体校验失败；请勿使用来源不明或变化后的字体。")

    corpus = json.loads(subprocess.check_output([
        os.environ.get("FONT_NODE", "node"), str(ROOT / "scripts/font-corpus.ts")
    ], cwd=ROOT, text=True))
    characters = corpus["characters"]
    codepoints = {ord(character) for character in characters}
    font = TTFont(source_path, recalcTimestamp=False)
    missing = codepoints - set(font.getBestCmap())
    if missing:
        raise ValueError(f"官方源字体缺少字符：{''.join(chr(cp) for cp in sorted(missing))}")

    options = subset.Options()
    options.flavor = "woff2"
    options.recalc_timestamp = False
    options.layout_features = ["kern", "liga", "clig", "locl"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17, 25]
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=codepoints)
    worker.subset(font)
    instantiateVariableFont(font, {"wght": (400, 900)}, inplace=True)
    font.flavor = "woff2"
    font.save(OUTPUT / FONT_FILENAME)

    # 记录实际生成字体的 cmap 和变量轴，不把输入字符清单冒充验证结果。
    produced = TTFont(OUTPUT / FONT_FILENAME, recalcTimestamp=False)
    coverage = sorted(cp for cp in produced.getBestCmap() if cp in codepoints)
    if set(coverage) != codepoints:
        raise ValueError("字体生成后缺字，停止更新清单。")
    data = (OUTPUT / FONT_FILENAME).read_bytes()
    latin_files = []
    for relative in LATIN_SOURCES:
        original_latin = ROOT / "node_modules" / relative
        copied = OUTPUT / original_latin.name
        if "sans-latin-wght" in original_latin.name:
            latin_font = TTFont(original_latin, recalcTimestamp=False)
            instantiateVariableFont(latin_font, {"wght": (400, 700)}, inplace=True)
            latin_font.flavor = "woff2"
            latin_font.save(copied)
        else:
            shutil.copyfile(original_latin, copied)
        latin_files.append({"font": copied.name, "bytes": copied.stat().st_size, "sha256": hashlib.sha256(copied.read_bytes()).hexdigest()})
    manifest = {
        "font": FONT_FILENAME,
        "sourceUrl": SOURCE_URL,
        "sourceGitBlob": SOURCE_GIT_BLOB,
        "sourceSha256": hashlib.sha256(original).hexdigest(),
        "sourceBytes": len(original),
        "fontToolsVersion": version,
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
        "characters": "".join(chr(cp) for cp in coverage),
        "codepoints": coverage,
        "axes": [{"tag": axis.axisTag, "min": axis.minValue, "default": axis.defaultValue, "max": axis.maxValue} for axis in produced["fvar"].axes],
        "latin": latin_files,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    license_path = cache / f"{COMMIT}-OFL.txt"
    if not license_path.exists():
        license_path.write_bytes(download(LICENSE_URL))
    shutil.copyfile(license_path, OUTPUT / "Noto-Sans-SC-OFL.txt")
    shutil.copyfile(ROOT / "node_modules/@fontsource-variable/ibm-plex-sans/LICENSE", OUTPUT / "IBM-Plex-OFL.txt")
    public_licenses = ROOT / "public/fonts"
    public_licenses.mkdir(parents=True, exist_ok=True)
    for name in ["Noto-Sans-SC-OFL.txt", "IBM-Plex-OFL.txt"]:
        shutil.copyfile(OUTPUT / name, public_licenses / name)
    print(f"已生成 {len(coverage)} 个中文字符，{len(data):,} 字节，变量轴保留：{manifest['axes']}")


if __name__ == "__main__":
    main()
