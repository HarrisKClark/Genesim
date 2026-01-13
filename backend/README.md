# Genesim Backend

This is the backend API for Genesim - it's where all the simulation magic happens! Built with FastAPI, it provides a RESTful API that handles all the heavy lifting when you want to simulate genetic circuits.

## What It Does

### Simulation Methods

- **Deterministic Simulation**: 
  - Uses Runge-Kutta 4 (RK4) for numerical integration
  - Models everything as continuous ODEs
  - Super fast, great for quick checks or long time ranges

- **Stochastic Simulation**:
  - Implements the Gillespie Stochastic Simulation Algorithm (SSA)
  - Models discrete molecular events
  - Accounts for all that molecular noise and variability that makes biology interesting

- **Flow Cytometry Simulation**:
  - Runs a batch of stochastic simulations
  - Perfect for seeing how a population of cells behaves
  - Generates histograms showing cell-to-cell variation

### The Biology

- **Transcription**: mRNA gets made based on promoter strength
- **Translation**: Proteins get made based on RBS strength
- **Degradation**: Everything decays over time (first-order kinetics)
- **Hill Function Regulation**: 
  - Promoters can be repressed by inhibitors
  - Promoters can be activated by activators
  - You can tweak the cooperativity (Hill coefficient) to match your system
- **Polycistronic mRNA**: One mRNA can make multiple proteins

## Getting Started

### What You Need

- **Python** 3.8 or higher
- **pip** or **conda**

### Setup

1. **Create a virtual environment**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. **Install the dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Server

**Development mode** (auto-reloads when you change code):
```bash
uvicorn app.main:app --reload --port 8000
```

**Production mode** (when you're ready to deploy):
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Once it's running, you can access:
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## API Endpoints

### Health Check

```http
GET /api/health
```

Just a quick check to see if the server is alive and kicking.

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

This is the main endpoint - it simulates one or more genetic transcripts (operons). You can run them independently, which is pretty flexible.

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

**What all these parameters mean**:
- `transcripts`: An array of transcript specs (you can simulate multiple at once!)
  - `promoterStrength`: How fast mRNA gets made (mRNA/min)
  - `rbsStrengths`: Translation rates for each protein in the operon (protein/min per mRNA)
  - `degradationRates`: How fast things break down (1/min)
  - `inhibitorName`: Name of the repressor protein (optional - leave null if you don't need it)
  - `hillK`: Half-maximal concentration for the Hill function
  - `hillN`: Cooperativity (how steep the response is)
  - `leak`: Basal promoter activity
  - `activatorName`: Name of activator protein (optional)
  - `actK`, `actN`: Activation Hill parameters (optional)
- `params`:
  - `tEnd`: How long to run the simulation (minutes)
  - `dt`: Time step for deterministic simulation (smaller = more accurate but slower)
  - `method`: Choose `"deterministic"`, `"stochastic"`, or `"flow"`
  - `seed`: Random seed for stochastic simulations (optional - useful for reproducibility)
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
│   ├── main.py          # FastAPI app and all the routes
│   ├── models.py        # Pydantic models for requests/responses
│   ├── simulate.py      # The actual simulation engine
│   ├── integrators.py   # Numerical integration methods
│   ├── kinetics.py      # Biological kinetics models
│   └── response_builder.py # Builds the response data
├── requirements.txt     # All the Python packages you need
└── README.md           # This file!
```

## Dependencies

- **fastapi**: The web framework
- **uvicorn**: The ASGI server that runs everything
- **pydantic**: Makes sure your data is valid before we even look at it
- **numpy**: Does all the number crunching
- **scipy**: For the fancy scientific computing stuff

## How the Simulations Work

### ODE Model

For each transcript, we model:

**mRNA dynamics**:
```
dm/dt = α_m · f_regulation([I], [A]) - δ_m · m
```

**Protein dynamics** (for each protein in the operon):
```
dp_i/dt = α_p · rbsStrength_i · m - δ_p · p_i
```

Where:
- `α_m`: Promoter strength (how fast mRNA gets made)
- `α_p`: Translation rate (scaled by RBS strength)
- `δ_m`, `δ_p`: Degradation rates (how fast things break down)
- `f_regulation`: Hill function that handles repression/activation

### Hill Function

**Repression** (when something turns the promoter off):
```
f_repression([I]) = leak + (1 - leak) / (1 + ([I]/K)^n)
```

**Activation** (when something turns the promoter on):
```
f_activation([A]) = leak + (1 - leak) · ([A]^n) / (K^n + [A]^n)
```

### Gillespie Algorithm

The stochastic simulation uses the Gillespie SSA to model discrete molecular events:
- Transcription events (mRNA production)
- Translation events (protein production)
- Degradation events (mRNA/protein decay)

The algorithm models each molecule individually and accounts for randomness.

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Everything worked perfectly
- `400`: Bad request
- `422`: Validation error (Pydantic caught something wrong with your data)
- `500`: Internal server error

Error responses include a message explaining what went wrong:
```json
{
  "detail": "Error message describing what went wrong"
}
```
