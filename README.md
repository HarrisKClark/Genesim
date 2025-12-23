# Genesim - Genetic Circuit Design & Simulation Platform

A web-based platform for designing and simulating genetic circuits with an intuitive visual interface. Design circuits by placing biological components on a DNA strand, then run deterministic or stochastic simulations to predict protein expression dynamics.

![Genesim](https://img.shields.io/badge/version-0.1.0-blue)
![Python](https://img.shields.io/badge/python-3.8+-green)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue)
![React](https://img.shields.io/badge/react-18.0+-61dafb)

## Features

### 🧬 Circuit Design
- **Visual DNA Editor**: Interactive canvas with both abstract and detailed DNA views
- **Component Library**: Pre-built biological parts including:
  - Promoters (pR, pLac, pTet, custom)
  - Genes (reporters, activators, repressors)
  - RBS (Ribosome Binding Sites)
  - Terminators
- **Custom Promoters**: Create promoters with configurable activity, leakiness, and Hill function parameters
- **Operon Detection**: Automatic detection and validation of genetic operons
- **DNA Manipulation**: Copy, paste, delete, and reverse complement DNA sequences

### 📊 Simulation Engine
- **Deterministic Simulation**: Runge-Kutta 4 (RK4) solver for ODE-based simulations
- **Stochastic Simulation**: Gillespie Stochastic Simulation Algorithm (SSA)
- **Flow Cytometry**: Batch stochastic runs for population-level analysis
- **Hill Function Regulation**: Promoter repression/activation based on inhibitor/activator concentrations
- **Polycistronic mRNA**: Support for multi-protein operons

### 🎨 User Interface
- **Dual View Modes**: Switch between abstract parts view and detailed DNA sequence view
- **Interactive Selection**: Click and drag to select DNA regions with visual highlighting
- **Real-time Cursor**: Precise cursor positioning for DNA editing
- **Results Visualization**: Interactive Plotly charts for mRNA and protein time-series
- **Export Functionality**: Export simulation results and circuit designs

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Plotly.js** for data visualization
- **react-dnd** for drag-and-drop functionality

### Backend
- **FastAPI** for RESTful API
- **NumPy** for numerical computation
- **SciPy** for scientific computing
- **Pydantic** for data validation

## Installation

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.8+
- **pip** or conda

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/genesim.git
   cd genesim
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Run the application**
   
   In one terminal (backend):
   ```bash
   cd backend
   source .venv/bin/activate
   uvicorn app.main:app --reload --port 8000
   ```
   
   In another terminal (frontend):
   ```bash
   cd frontend
   npm run dev
   ```

5. **Open your browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Usage

### Designing a Circuit

1. **Add Components**: Drag components from the library onto the DNA canvas
2. **Build Operons**: Place components in order: Promoter → RBS → Gene(s) → Terminator
3. **Custom Promoters**: Click the "+" button in the Promoters section to create custom promoters
4. **View Modes**: Toggle between abstract view (parts) and DNA view (sequence) using zoom controls

### Running Simulations

1. **Design Your Circuit**: Build at least one complete operon
2. **Open Simulation Panel**: Click the "Simulation" button
3. **Choose Simulation Type**:
   - **Deterministic**: Fast, continuous ODE simulation
   - **Stochastic**: Discrete event simulation using Gillespie algorithm
   - **Flow Cytometer**: Multiple stochastic runs for population analysis
4. **Configure Parameters**: Set time range, number of runs (for flow cytometry), etc.
5. **Run Simulation**: Click "Run Simulation" to execute
6. **View Results**: Results appear as interactive charts showing mRNA and protein concentrations over time

### DNA Editing

- **Select DNA**: Click and drag on the DNA strand to select regions
- **Delete**: Press Delete/Backspace to remove selected DNA and overlapping components
- **Copy/Paste**: Use Ctrl+C / Ctrl+V (Cmd on Mac) to copy and paste DNA sequences
- **Reverse Complement**: Right-click on selection for context menu options

## Project Structure

```
genesim/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── models.py        # Pydantic models
│   │   └── simulate.py      # Simulation engine (RK4, Gillespie)
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── models/          # Data models
│   │   ├── utils/           # Utility functions
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── README.md
└── README.md
```

## API Documentation

The backend provides a RESTful API for circuit simulation:

- `GET /api/health` - Health check endpoint
- `POST /api/simulate/transcripts` - Run simulation on circuit design

See the interactive API documentation at http://localhost:8000/docs when the backend is running.

### Example API Request

```json
{
  "transcripts": [
    {
      "promoterStrength": 10.0,
      "rbsStrengths": [1.0],
      "degradationRates": {"mRNA": 0.1, "protein": 0.01},
      "inhibitorName": "LacI",
      "hillK": 1.0,
      "hillN": 2.0,
      "leak": 0.01
    }
  ],
  "params": {
    "tEnd": 100.0,
    "dt": 0.1,
    "method": "deterministic"
  }
}
```

## Development

### Frontend Development
```bash
cd frontend
npm run dev        # Start dev server
npm run build      # Build for production
npm run lint       # Run linter
```

### Backend Development
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

The frontend is configured to proxy API requests to `http://localhost:8000` during development.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

[Add your license here - e.g., MIT, Apache 2.0, etc.]

## Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Visualization powered by [Plotly.js](https://plotly.com/javascript/)
- UI built with [React](https://react.dev/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
