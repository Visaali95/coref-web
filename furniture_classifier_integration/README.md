# Furniture Classifier — Integration Package

## Contents

```
furniture_classifier_integration/
├── furniture_ml/          # Python package (inference + API)
├── models/
│   ├── classifier.pt      # Trained EfficientNet-B0 (15.6 MB)
│   ├── labels.json        # Class map: Office Furniture, Villa Furniture, Chandelier
│   └── model_metadata.json
├── config/
│   └── pipeline.yaml      # Pipeline settings (confidence threshold etc.)
├── requirements-inference.txt
├── pyproject.toml
└── README.md
```

---

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements-inference.txt
pip install -e .
```

### 2. Run the API server
```bash
python -m furniture_ml.cli serve
# Server starts at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### 3. Upload a PDF (curl)
```bash
curl -X POST http://localhost:8000/api/v1/pdf/process \
  -F "file=@your_catalogue.pdf" \
  -F "include_probabilities=true"
```

### 4. Use in Python directly
```python
from furniture_ml.inference.pipeline import PDFClassificationPipeline

pipeline = PDFClassificationPipeline()
result = pipeline.run("path/to/catalogue.pdf")

print(result.summary.by_category)
# {'Office Furniture': 99, 'Villa Furniture': 43, 'Chandelier': 8}

for item in result.results:
    print(f"Page {item.page_number}: {item.category} ({item.confidence:.1%})")
```

### 5. Use from Node.js / Any Language
```javascript
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

const form = new FormData();
form.append('file', fs.createReadStream('catalogue.pdf'));

const res = await fetch('http://localhost:8000/api/v1/pdf/process', {
  method: 'POST',
  body: form,
});
const data = await res.json();
console.log(data.summary.by_category);
```

---

## Classes

| Label | Description |
|---|---|
| `Office Furniture` | Desks, chairs, filing cabinets, shelves |
| `Villa Furniture` | Sofas, armchairs, dining sets, ornate cabinets |
| `Chandelier` | Ceiling fixtures, pendant lights, lanterns |

---

## Configuration

Edit `config/pipeline.yaml` to change:
- `confidence_threshold` (default 0.60) — images below this are marked `needs_review`
- `min_image_area` — skip tiny/logo images

Set `FML_MODEL_PATH` env var to point to a different model file.

---

## API Response Shape

```json
{
  "source_pdf": "catalogue.pdf",
  "status": "completed",
  "summary": {
    "total_pages": 47,
    "images_extracted": 150,
    "duplicates_removed": 2,
    "images_classified": 142,
    "needs_review": 6,
    "by_category": {
      "Office Furniture": 99,
      "Villa Furniture": 37,
      "Chandelier": 6
    },
    "processing_seconds": 39.4
  },
  "results": [
    {
      "image_id": "page2_img0",
      "page_number": 2,
      "category": "Villa Furniture",
      "confidence": 1.0,
      "status": "classified",
      "probabilities": {
        "Chandelier": 0.0,
        "Office Furniture": 0.0,
        "Villa Furniture": 1.0
      }
    }
  ]
}
```
