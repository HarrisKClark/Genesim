# Genesim Backend

FastAPI-based backend for genetic circuit simulation. Provides RESTful API endpoints for running deterministic and stochastic simulations of genetic circuits.

## Features

### Simulation Methods

- **Deterministic Simulation**: 
  - Runge-Kutta 4 (RK4) numerical integration
  - Continuous ODE-based modeling
  - Fast computation for large time ranges

- **Stochastic Simulation**:
  - Gillespie Stochastic Simulation Algorithm (SSA)
  - Discrete event simulation
  - Accounts for molecular noise and variability

- **Flow Cytometry Simulation**:
  - Batch stochastic runs
  - Population-level analysis
  - Histogram generation for cell-to-cell variation

### Biological Models

- **Transcription**: mRNA production with promoter strength
- **Translation**: Protein production with RBS strength
- **Degradation**: First-order decay for mRNA and proteins
- **Hill Function Regulation**: 
  - Promoter repression by inhibitors
  - Promoter activation by activators
  - Configurable cooperativity (Hill coefficient)
- **Polycistronic mRNA**: Support for multi-protein operons

## Installation

### Prerequisites

- **Python** 3.8 or higher
- **pip** or **conda**

### Setup

1. **Create virtual environment** (recommended):
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Server

**Development mode** (with auto-reload):
```bash
uvicorn app.main:app --reload --port 8000
```

**Production mode**:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## API Endpoints

### Health Check

```http
GET /api/health
```

Returns server status and version information.

**Response**:
```json
{
  "status": "healthy",
  "version": "0.1.0"
}
```

### Run Simulation

```http
POST /api/simulate/transcripts
```

Simulates one or more genetic transcripts (operons) independently.

**Request Body**:
```json
{
  "transcripts": [
    {
      "promoterStrength": 10.0,
      "rbsStrengths": [1.0, 0.5],
      "degradationRates": {
        "mRNA": 0.1,
        "protein": 0.01
      },
      "inhibitorName": "LacI",
      "hillK": 1.0,
      "hillN": 2.0,
      "leak": 0.01,
      "activatorName": null,
      "actK": null,
      "actN": null
    }
  ],
  "params": {
    "tEnd": 100.0,
    "dt": 0.1,
    "method": "deterministic",
    "seed": null,
    "runs": null
  }
}
```

**Parameters**:
- `transcripts`: Array of transcript specifications
  - `promoterStrength`: Transcription rate (mRNA/min)
  - `rbsStrengths`: Translation rates for each cistron (protein/min per mRNA)
  - `degradationRates`: Decay rates for mRNA and proteins (1/min)
  - `inhibitorName`: Name of repressor protein (optional)
  - `hillK`: Hill function K parameter (half-maximal concentration)
  - `hillN`: Hill function n parameter (cooperativity)
  - `leak`: Basal promoter activity (leakiness)
  - `activatorName`: Name of activator protein (optional)
  - `actK`, `actN`: Activation Hill parameters (optional)
- `params`:
  - `tEnd`: Simulation end time (minutes)
  - `dt`: Time step for deterministic simulation
  - `method`: `"deterministic"`, `"stochastic"`, or `"flow"`
  - `seed`: Random seed for stochastic simulations (optional)
  - `runs`: Number of runs for flow cytometry (required if `method` is `"flow"`)

**Response** (Deterministic/Stochastic):
```json
{
  "transcripts": [
    {
      "mRNA": {
        "time": [0.0, 0.1, 0.2, ...],
        "concentration": [0.0, 0.5, 1.0, ...]
      },
      "proteins": [
        {
          "name": "protein_0",
          "time": [0.0, 0.1, 0.2, ...],
          "concentration": [0.0, 0.2, 0.4, ...]
        }
      ]
    }
  ],
  "summary": [
    {
      "transcript": 0,
      "mRNA_final": 10.0,
      "protein_0_final": 50.0
    }
  ]
}
```

**Response** (Flow Cytometry):
```json
{
  "flowCytometry": {
    "protein_0": {
      "concentrations": [45.2, 48.1, 52.3, ...],
      "cellCounts": [1, 2, 3, ...]
    }
  }
}
```

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application and routes
│   ├── models.py        # Pydantic request/response models
│   └── simulate.py      # Simulation engine implementation
├── requirements.txt     # Python dependencies
└── README.md
```

## Dependencies

- **fastapi**: Web framework
- **uvicorn**: ASGI server
- **pydantic**: Data validation
- **numpy**: Numerical computation
- **scipy**: Scientific computing (optional, for advanced features)

## Simulation Details

### ODE Model

For each transcript:

**mRNA dynamics**:
```
dm/dt = α_m · f_regulation([I], [A]) - δ_m · m
```

**Protein dynamics** (per cistron):
```
dp_i/dt = α_p · rbsStrength_i · m - δ_p · p_i
```

Where:
- `α_m`: Promoter strength (transcription rate)
- `α_p`: Translation rate (scaled by RBS strength)
- `δ_m`, `δ_p`: Degradation rates
- `f_regulation`: Hill function for regulation

### Hill Function

**Repression**:
```
f_repression([I]) = leak + (1 - leak) / (1 + ([I]/K)^n)
```

**Activation**:
```
f_activation([A]) = leak + (1 - leak) · ([A]^n) / (K^n + [A]^n)
```

### Gillespie Algorithm

The stochastic simulation uses the Gillespie SSA to model discrete molecular events:
- Transcription events (mRNA production)
- Translation events (protein production)
- Degradation events (mRNA/protein decay)

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid parameters)
- `422`: Validation error (Pydantic)
- `500`: Internal server error

Error responses include detailed error messages:
```json
{
  "detail": "Error message describing what went wrong"
}
```

## CORS

The API is configured with permissive CORS settings for development. **Important**: Tighten CORS settings for production deployments.

## Development

### Running Tests

[Add test instructions when tests are implemented]

### Code Style

Follow PEP 8 style guidelines. Consider using:
- `black` for code formatting
- `flake8` or `pylint` for linting
- `mypy` for type checking

## License

[Add your license here]
