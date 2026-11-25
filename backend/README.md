# AI Trash Classifier Backend

This FastAPI service accepts an image and returns the highest-scoring trash
labels from the configured ResNet18 V2 classifier. The model is loaded during
application startup and reused for prediction requests.

## Setup

Developed and verified with Python 3.11.5 on Windows 10.

From the project root, create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

On macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

Install the backend dependencies from the project root:

```bash
python -m pip install -r backend/requirements.txt
```

The requirements pin `torch==2.15.0` and `torchvision==0.29.2`. The team's
default is a CPU build. Do not switch to a CUDA build or mix CPU and CUDA
builds.

## Configuration

Relative model paths are resolved from the project root; absolute paths remain
absolute.

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `MODEL_CHECKPOINT_PATH` | `checkpoints/resnet18_v2_best.pth` | ResNet18 V2 checkpoint file. |
| `MODEL_CLASSES_PATH` | `artifacts/resnet18_v2_classes.json` | JSON list of model labels in output-index order. |
| `MODEL_DEVICE` | `auto` | Device selection: `auto`, `cpu`, or `cuda`. |
| `MODEL_TOP_K` | `3` | Positive integer number of predictions requested. |
| `MAX_UPLOAD_BYTES` | `10 MiB` | Positive integer upload limit for the image file. |

The decoded image limit is 10,000 pixels in width, 10,000 pixels in height,
and 25,000,000 pixels total. The complete `/api/predict` request body is
limited to `MAX_UPLOAD_BYTES + 1 MiB` to allow for multipart framing and part
headers. The middleware counts the received body bytes even when
`Content-Length` is missing; `Content-Length` is only used for an early
rejection. The request body is spooled to a temporary file after 1 MiB in
memory.

### Changing the model files

Change `MODEL_CHECKPOINT_PATH` and `MODEL_CLASSES_PATH` together so they refer
to a matching checkpoint and class list. The backend loads only the configured
paths: it does not fall back to another file or select the newest checkpoint.
The class JSON list defines the only mapping from model output index to label:
`classes[index]`. Keep its order as produced for the model; the backend does
not sort it. The classifier output layer size is taken from the JSON list, and
a checkpoint that does not load with that size causes startup to fail.

### Device selection

`MODEL_DEVICE=auto` selects CUDA when PyTorch reports CUDA as available and
otherwise selects CPU. `MODEL_DEVICE=cuda` causes startup to fail if CUDA is
unavailable. The CUDA path has not been verified on any of the team's machines;
confirm that a compatible GPU and driver are available before selecting it.

## Run the server

From the project root, with the virtual environment active:

```bash
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

The interactive API documentation is at `http://127.0.0.1:8000/docs`.

### Startup behavior

The application loads the model once in its startup lifespan, before serving
requests. It does not load the model inside a prediction request. If loading
fails, startup fails and the process does not serve requests.

With the Uvicorn command above, startup failure exits with code `3` for an
exception raised in the lifespan, including `ModelFileError`, `ModelLoadError`,
or `ModelConfigurationError`. A configuration error raised while importing
`config.py` exits with code `1`; this includes invalid `MODEL_DEVICE`,
`MODEL_TOP_K`, or `MAX_UPLOAD_BYTES` values.

## Endpoints

### `GET /health`

Returns `200` with:

```json
{"status": "ok"}
```

### `POST /api/predict`

Send `multipart/form-data` with the image in the `file` field. A successful
response contains the original filename and up to `MODEL_TOP_K` predictions:

```json
{"filename": "Cardboard_115.jpg", "predictions": [{"label": "cardboard", "confidence": 0.9999860525131226}, {"label": "glass", "confidence": 6.912132903380552e-06}, {"label": "plastic", "confidence": 6.756355105608236e-06}]}
```

`MODEL_TOP_K` defaults to `3`. The response count is capped at the number of
labels in the class JSON; for example, `MODEL_TOP_K=10` with six classes
returns six predictions. Predictions are ordered by decreasing confidence.

### Error responses

Errors use a JSON object with a `detail` string.

| Status | `detail` | When it occurs |
| --- | --- | --- |
| `400` | `Uploaded file is empty.` | The uploaded file has no bytes. |
| `400` | `Uploaded file is not a valid image.` | The uploaded bytes cannot be decoded as an image. |
| `413` | `Image exceeds the upload size limit.` | The image file is larger than `MAX_UPLOAD_BYTES`. |
| `413` | `Image dimensions exceed the supported limits.` | The decoded image exceeds a width, height, or total-pixel limit. |
| `413` | `Request body exceeds the total upload size limit.` | The full `/api/predict` request body exceeds `MAX_UPLOAD_BYTES + 1 MiB`. |
| `422` | `Request is missing required fields or is malformed.` | The required `file` field is missing or the request is malformed. |
| `500` | `Internal server error.` | An unexpected server error occurs; details are logged server-side. |
| `503` | `Prediction is unavailable: the model is not loaded.` | Defensive internal state when prediction is called without a loaded model. |

The `503` response is a defensive internal state. Because startup is
fail-fast, it is not expected while the server is running. Clients should
handle it with their general `5xx` error handling and do not need separate
logic for `503`.

Other HTTP exceptions, including an unknown path or unsupported method, pass
through the HTTP exception handler: it preserves the status and returns the
exception's string detail in the same JSON shape.

## Image preprocessing

For inference, the backend applies this pipeline:

`convert("RGB")` -> `Resize(256)` -> `CenterCrop(224)` -> `ToTensor()` ->
`Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])`.

This matches the deterministic evaluation preprocessing in the training code
and the preprocessing in the project app. The backend does not apply
`exif_transpose`; for an image whose rotation is stored in EXIF metadata, the
model sees the stored pixel orientation. Changing this behavior is a decision
for the AI team.

## Nginx reverse proxy example

With the default `MAX_UPLOAD_BYTES` of 10 MiB, `client_max_body_size 11m`
allows the 10 MiB file plus the application's 1 MiB request-body allowance.
The application still enforces its own total-body limit. If
`MAX_UPLOAD_BYTES` changes, set the proxy limit to at least
`MAX_UPLOAD_BYTES + 1 MiB`.

The proxy timeout settings help limit resource use by slow clients.

```nginx
location / {
    client_max_body_size 11m;
    client_body_timeout 15s;
    proxy_read_timeout 60s;
    proxy_pass http://127.0.0.1:8000;
}
```

## Tests

With the project-root virtual environment active, run from the project root:

```bash
python -m pytest backend/tests
```

From `backend/` on Windows, use:

```powershell
..\.venv\Scripts\python.exe -m pytest tests
```

The real-checkpoint test is skipped by default. To enable it, set
`RUN_REAL_MODEL_TESTS=1`:

PowerShell, from the project root:

```powershell
$env:RUN_REAL_MODEL_TESTS = "1"
python -m pytest backend/tests/test_real_model.py -v
Remove-Item Env:RUN_REAL_MODEL_TESTS
```

Remove the variable after this run so a later `pytest` command does not
unintentionally run the real-model test.

bash, from the project root:

```bash
RUN_REAL_MODEL_TESTS=1 python -m pytest backend/tests/test_real_model.py -v
```

The test needs image files under `datasets/split_v2/test/<class>/`. Dataset
image files are ignored by Git, so they must be present in the local checkout.

## Known limitations

- CORS is not configured by this backend.
- The CUDA path has not been verified on a team machine; confirm GPU and driver
  availability before using it.
- Concurrent use has only had a light check with four parallel requests. There
  is no lock around inference, and this is not a load-capacity guarantee.
