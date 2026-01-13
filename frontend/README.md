# Genesim Frontend

This is the frontend for Genesim - the part you actually see and interact with! It's built with React and TypeScript, and it gives you a pretty intuitive visual interface for designing genetic circuits and checking out your simulation results.

## What's Cool About It

### Circuit Design
- **Two Ways to View**: 
  - Abstract view: See your biological parts as nice visual blocks
  - DNA view: Zoom in and see every single base pair
- **Interactive Canvas**: 
  - Drag and drop components right onto the DNA strand
  - Click and drag to select DNA regions for editing
  - Real-time cursor positioning so you always know where you are
  - Zoom and pan controls to navigate around
- **Component Library**:
  - **Promoters**: We've got pR, pLac, pTet, and you can make custom ones too
  - **Genes**: Organized by what they do (Reporters, Activators, Repressors)
  - **RBS**: Ribosome Binding Sites
  - **Terminators**: The stop signs of transcription
- **Custom Parts**: Want something specific? Create custom promoters and tweak all the parameters
- **Operon Detection**: We automatically check if your circuit makes sense and highlight any operons we find

### Simulation Interface
- **Multiple Simulation Types**:
  - Deterministic (RK4 solver) - fast and smooth
  - Stochastic (Gillespie SSA) - accounts for randomness
  - Flow Cytometry (batch stochastic runs) - see population-level behavior
- **Results Visualization**: 
  - Interactive Plotly charts that you can zoom and pan
  - Time-series plots for mRNA and protein concentrations
  - Summary tables showing final values
  - Histogram visualization for flow cytometry results

### DNA Editing
- **Selection**: Click and drag on the DNA strand to select regions
- **Copy/Paste**: Standard keyboard shortcuts work (Ctrl+C/Ctrl+V, or Cmd on Mac)
- **Delete**: Remove selected DNA and any components that overlap
- **Reverse Complement**: Flip your DNA sequences around
- **Undo/Redo**: Made a mistake? No problem, just undo it

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Analysis/           # Components for analyzing operons
│   │   ├── Canvas/             # Canvas-related UI components
│   │   ├── DNA/                # DNA visualization components
│   │   ├── CircuitCanvas.tsx   # The main design canvas
│   │   ├── ComponentLibrary.tsx # The sidebar with all the parts
│   │   ├── ResultsPanel.tsx    # Where simulation results show up
│   │   └── ...                 # Lots more components
│   ├── hooks/                  # Custom React hooks
│   │   ├── useCircuitAnalysis.ts
│   │   ├── useDNAEditing.ts
│   │   ├── useDNASelection.ts
│   │   └── ...                 # More hooks for various features
│   ├── models/                 # Data models
│   │   └── CircuitModel.ts
│   ├── utils/                  # Utility functions
│   │   ├── expandedLayout.ts   # Calculates how to lay out DNA
│   │   ├── operonDetection.ts  # Detects operons using a state machine
│   │   ├── partLibrary.ts      # Defines all the components
│   │   └── ...                 # More utilities
│   ├── types/                  # TypeScript type definitions
│   ├── constants/              # Constants and configuration
│   ├── App.tsx                 # The root component
│   └── main.tsx                # Entry point
├── package.json
├── vite.config.ts              # Vite configuration
└── tsconfig.json               # TypeScript configuration
```

## Key Components

### CircuitCanvas
This is the main design area - it's where you build your genetic circuits. It handles:
- Drag-and-drop component placement
- DNA sequence visualization (both abstract and detailed views)
- Interactive selection and editing
- Zoom and pan controls
- Operon highlighting

### ComponentLibrary
The sidebar panel with all the draggable biological components:
- Organized by type (Promoters, Genes, RBS, Terminators)
- Custom promoter creation dialog
- Genes classified by function (Reporters, Activators, Repressors)

### ResultsPanel
Where all your simulation results show up:
- Time-series plots for mRNA and proteins
- Summary tables with final values
- Flow cytometry histograms
- Export functionality so you can save your results

### DNASequenceRenderer
This renders the actual DNA strand visualization:
- Shows base-pair level detail in DNA view
- Shows abstract component blocks in parts view
- Interactive cursor and selection highlighting
- Component overlays so you can see what's where

## Tech Stack

- **React 18** - The UI framework
- **TypeScript** - Type safety makes everything better
- **Vite** - Super fast build tool and dev server
- **react-dnd** - Handles all the drag and drop functionality
- **Plotly.js** - Makes those beautiful interactive charts
- **CSS Modules** - Component styling that doesn't leak

## Browser Support

We support the latest versions of:
- Chrome/Edge
- Firefox
- Safari

Modern browsers are supported.
