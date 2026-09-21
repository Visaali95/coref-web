"""Generates a self-contained HTML labelling tool.

Open ``artifacts/review/review.html`` in a browser, label with keyboard shortcuts
(1-3 = category, 0 = reject, arrow keys to navigate), click **Download labels.csv**
and drop the file over ``data/dataset/labels.csv``. No server required.
"""

from __future__ import annotations

import json
from pathlib import Path

from furniture_ml.config import Settings, get_settings
from furniture_ml.constants import CATEGORIES
from furniture_ml.dataset.manifest import Manifest
from furniture_ml.exceptions import DatasetError
from furniture_ml.utils.io_utils import ensure_dir
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

_TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Image labelling - furniture-ml</title>
<style>
:root{color-scheme:dark}
body{font-family:system-ui,Segoe UI,sans-serif;margin:0;background:#12141a;color:#e8e8ef}
header{position:sticky;top:0;background:#1b1e27;padding:12px 20px;border-bottom:1px solid #2c3040;
display:flex;gap:16px;align-items:center;flex-wrap:wrap;z-index:5}
button{background:#2b3242;color:#e8e8ef;border:1px solid #3b4356;border-radius:6px;
padding:7px 12px;cursor:pointer;font-size:13px}
button:hover{background:#39415a}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;padding:20px}
.card{background:#1b1e27;border:1px solid #2c3040;border-radius:10px;padding:10px}
.card.done{border-color:#3ea06a}
.card.active{outline:2px solid #5b8cff}
.thumb{width:100%;height:170px;object-fit:contain;background:#0d0f14;border-radius:6px}
.meta{font-size:11px;color:#98a0b3;margin:6px 0;line-height:1.4;word-break:break-all}
select{width:100%;background:#0d0f14;color:#e8e8ef;border:1px solid #3b4356;
border-radius:6px;padding:6px;font-size:12px}
.pill{background:#2b3242;border-radius:20px;padding:4px 10px;font-size:12px}
.hint{color:#8f97aa;font-size:12px}
</style></head><body>
<header>
<strong>Image labelling</strong>
<span class="pill" id="progress"></span>
  <span class="hint">Click a card then press 1-3 to label, 0 = reject, &larr;/&rarr; to move.</span>
<button onclick="applySuggestions()">Accept all text suggestions</button>
<button onclick="download()">Download labels.csv</button>
<span class="hint" id="cats"></span>
</header>
<div class="grid" id="grid"></div>
<script>
const CATEGORIES = __CATEGORIES__;
const ITEMS = __ITEMS__;
let active = 0;

document.getElementById('cats').textContent =
CATEGORIES.map((c,i)=>`${i+1}=${c}`).join(' | ');

function render(){
const grid = document.getElementById('grid');
grid.innerHTML = '';
ITEMS.forEach((item, i) => {
const card = document.createElement('div');
card.className = 'card' + (item.label ? ' done' : '') + (i===active ? ' active' : '');
card.onclick = () => { active = i; render(); };
const options = ['<option value="">-- unlabelled --</option>']
.concat(CATEGORIES.map(c => `<option value="${c}" ${item.label===c?'selected':''}>${c}</option>`))
.concat([`<option value="reject" ${item.label==='reject'?'selected':''}>reject (not a product)</option>`]);
card.innerHTML = `
<img class="thumb" loading="lazy" src="${item.src}" alt="${item.image_id}">
<div class="meta">${item.image_id}<br>${item.source_pdf} &middot; page ${item.page_number}
${item.suggested_category ? '<br>hint: ' + item.suggested_category : ''}</div>
<select>${options.join('')}</select>`;
card.querySelector('select').onchange = (e) => {
ITEMS[i].label = e.target.value; save(); render();
};
grid.appendChild(card);
});
const done = ITEMS.filter(x => x.label).length;
document.getElementById('progress').textContent = `${done} / ${ITEMS.length} labelled`;
const el = grid.children[active];
if (el) el.scrollIntoView({block:'nearest'});
}

function save(){ localStorage.setItem('fml_labels', JSON.stringify(
Object.fromEntries(ITEMS.map(i => [i.image_id, i.label||''])))); }

function restore(){
try {
const saved = JSON.parse(localStorage.getItem('fml_labels') || '{}');
ITEMS.forEach(i => { if (saved[i.image_id]) i.label = saved[i.image_id]; });
} catch(e){}
}

function applySuggestions(){
ITEMS.forEach(i => { if (!i.label && i.suggested_category) i.label = i.suggested_category; });
save(); render();
}

document.addEventListener('keydown', (e) => {
if (e.target.tagName === 'SELECT') return;
if (e.key === 'ArrowRight') { active = Math.min(active+1, ITEMS.length-1); render(); }
else if (e.key === 'ArrowLeft') { active = Math.max(active-1, 0); render(); }
else if (e.key === '0') { ITEMS[active].label = 'reject'; save(); active++; render(); }
else if (/^[1-9]$/.test(e.key)) {
const idx = parseInt(e.key,10)-1;
if (idx < CATEGORIES.length) { ITEMS[active].label = CATEGORIES[idx];
save(); active = Math.min(active+1, ITEMS.length-1); render(); }
}
});

function download(){
const header = ['image_id','image_path','source_pdf','page_number','suggested_category','label','notes'];
const esc = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
const lines = [header.join(',')].concat(ITEMS.map(i => [
i.image_id, i.image_path, i.source_pdf, i.page_number,
i.suggested_category, i.label || '', ''].map(esc).join(',')));
const blob = new Blob([lines.join('\\n')], {type:'text/csv'});
const a = document.createElement('a');
a.href = URL.createObjectURL(blob); a.download = 'labels.csv'; a.click();
}

restore(); render();
</script></body></html>
"""

def build_review_page(settings: Settings | None = None,
    only_unlabelled: bool = True,
    limit: int | None = None) -> Path:
    settings = settings or get_settings()
    manifest_path = settings.data_dir / "manifest.csv"
    if not manifest_path.exists():
        raise DatasetError(f"Manifest not found at {manifest_path}. Run 'fml prepare' first.")

    manifest = Manifest.load(manifest_path)
    rows = manifest.unlabelled() if only_unlabelled else manifest.unique()
    if limit:
        rows = rows[:limit]
    if not rows:
        raise DatasetError("Nothing to review - every unique image already has a label.")

    out_dir = ensure_dir(settings.artifacts_dir / "review")
    out_path = out_dir / "review.html"

    items = []
    for row in rows:
        image_path = Path(row.image_path).resolve()
        try:
            src = image_path.relative_to(out_dir).as_posix()
        except ValueError:
            src = image_path.as_uri()
        items.append(
            {
                "image_id": row.image_id,
                "image_path": str(image_path),
                "source_pdf": row.source_pdf,
                "page_number": row.page_number,
                "suggested_category": row.suggested_category,
                "label": row.label,
                "src": src,
            }
        )

    html = (
        _TEMPLATE.replace("__CATEGORIES__", json.dumps(CATEGORIES))
        .replace("__ITEMS__", json.dumps(items))
    )
    out_path.write_text(html, encoding="utf-8")
    logger.info("Review tool written to %s (%s images)", out_path, len(items))
    return out_path
