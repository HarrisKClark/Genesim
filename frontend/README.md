# Genesim Frontend

React + TypeScript frontend for the Genesim genetic circuit simulation platform. Provides an intuitive visual interface for designing genetic circuits and viewing simulation results.

## Features

### Circuit Design
- **Dual View Modes**: 
  - Abstract view: Visual representation of biological parts
  - DNA view: Detailed base-pair level sequence visualization
- **Interactive Canvas**: 
  - Drag-and-drop component placement
  - Click and drag selection for DNA editing
  - Real-time cursor positioning
  - Zoom and pan controls
- **Component Library**:
  - **Promoters**: pR, pLac, pTet, and custom promoters
  - **Genes**: Organized by function (Reporters, Activators, Repressors)
  - **RBS**: Ribosome Binding Sites
  - **Terminators**: Transcription termination signals
- **Custom Parts**: Create custom promoters with configurable parameters
- **Operon Detection**: Automatic validation and highlighting of genetic operons

### Simulation Interface
- **Multiple Simulation Types**:
  - Deterministic (RK4 solver)
  - Stochastic (Gillespie SSA)
  - Flow Cytometry (batch stochastic runs)
- **Results Visualization**: 
  - Interactive Plotly time-series charts
  - mRNA and protein concentration plots
  - Summary tables with final values
  - Histogram visualization for flow cytometry

### DNA Editing
- **Selection**: Click and drag to select DNA regions
- **Copy/Paste**: Standard keyboard shortcuts (Ctrl+C/Ctrl+V)
- **Delete**: Remove selected DNA and overlapping components
- **Reverse Complement**: Transform DNA sequences
- **Undo/Redo**: Full undo/redo support


## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Analysis/           # Operon analysis components
│   │   ├── Canvas/             # Canvas-related components
│   │   ├── DNA/                # DNA visualization components
│   │   ├── CircuitCanvas.tsx   # Main design canvas
│   │   ├── ComponentLibrary.tsx # Component library sidebar
│   │   ├── ResultsPanel.tsx    # Simulation results display
│   │   └── ...
│   ├── hooks/                  # Custom React hooks
│   │   ├── useCircuitAnalysis.ts
│   │   ├── useDNAEditing.ts
│   │   ├── useDNASelection.ts
│   │   └── ...
│   ├── models/                 # Data models
│   │   └── CircuitModel.ts
│   ├── utils/                  # Utility functions
│   │   ├── expandedLayout.ts   # DNA layout calculations
│   │   ├── operonDetection.ts  # Operon detection FSM
│   │   ├── partLibrary.ts      # Component definitions
│   │   └── ...
│   ├── types/                  # TypeScript type definitions
│   ├── constants/              # Constants and configuration
│   ├── App.tsx                 # Root component
│   └── main.tsx                # Entry point
├── package.json
├── vite.config.ts              # Vite configuration
└── tsconfig.json               # TypeScript configuration
```

## Key Components

### CircuitCanvas
The main design area where users build genetic circuits. Features:
- Drag-and-drop component placement
- DNA sequence visualization (abstract and detailed views)
- Interactive selection and editing
- Zoom and pan controls
- Operon highlighting

### ComponentLibrary
Sidebar panel containing draggable biological components:
- Categorized by type (Promoters, Genes, RBS, Terminators)
- Custom promoter creation dialog
- Gene classification (Reporters, Activators, Repressors)

### ResultsPanel
Displays simulation results:
- Time-series plots for mRNA and proteins
- Summary tables
- Flow cytometry histograms
- Export functionality

### DNASequenceRenderer
Renders the DNA strand visualization:
- Base-pair level detail in DNA view
- Abstract component blocks in parts view
- Interactive cursor and selection
- Component overlays

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **react-dnd** - Drag and drop functionality
- **Plotly.js** - Data visualization
- **CSS Modules** - Component styling


## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
