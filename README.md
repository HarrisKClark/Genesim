# Genesim - Genetic Circuit Design & Simulation Platform

A web-based platform for designing and simulating genetic circuits with an intuitive visual interface. Design circuits by placing biological components on a DNA strand, then run deterministic or stochastic simulations to predict protein expression dynamics.

![Genesim](https://img.shields.io/badge/version-0.1.0-blue)
![Python](https://img.shields.io/badge/python-3.8+-green)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue)
![React](https://img.shields.io/badge/react-18.0+-61dafb)

## Features

### Circuit Design
- **Visual DNA Editor**: Interactive canvas with both abstract and detailed DNA views
- **Component Library**: Pre-built biological parts including:
  - Promoters (pR, pLac, pTet, custom)
  - Genes (reporters, activators, repressors)
  - RBS (Ribosome Binding Sites)
  - Terminators
- **Custom Promoters**: Create promoters with configurable activity, leakiness, and Hill function parameters
- **Operon Detection**: Automatic detection and validation of genetic operons
- **DNA Manipulation**: Copy, paste, delete, and reverse complement DNA sequences

### Simulation Engine
- **Deterministic Simulation**: Runge-Kutta 4 (RK4) solver for ODE-based simulations
- **Stochastic Simulation**: Gillespie Stochastic Simulation Algorithm (SSA)
- **Flow Cytometry**: Batch stochastic runs for population-level analysis
- **Hill Function Regulation**: Promoter repression/activation based on inhibitor/activator concentrations
- **Polycistronic mRNA**: Support for multi-protein operons

### User Interface
- **Dual View Modes**: Switch between abstract parts view and detailed DNA sequence view
- **Interactive Selection**: Click and drag to select DNA regions with visual highlighting
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Visualization powered by [Plotly.js](https://plotly.com/javascript/)
- UI built with [React](https://react.dev/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
