# Genesim - Design & Simulate Genetic Circuits

Hey there! 👋 Welcome to Genesim, a web-based platform that lets you design and simulate genetic circuits with a pretty intuitive visual interface. Think of it like a digital lab bench where you can drag and drop biological components onto a DNA strand, then run simulations to see how your circuit would actually behave.

![Genesim](https://img.shields.io/badge/version-0.1.0-blue)
![Python](https://img.shields.io/badge/python-3.8+-green)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue)
![React](https://img.shields.io/badge/react-18.0+-61dafb)

## What Can You Do?

### Design Your Circuit
- **Visual DNA Editor**: Work with an interactive canvas that shows you both the big picture (abstract view) and the nitty-gritty details (actual DNA sequences)
- **Component Library**: We've got a bunch of pre-built biological parts ready to go:
  - Promoters (pR, pLac, pTet, or make your own custom ones)
  - Genes organized by what they do (reporters, activators, repressors)
  - RBS (Ribosome Binding Sites)
  - Terminators
- **Custom Promoters**: Want something specific? Create your own promoters and tweak their activity, leakiness, and Hill function parameters
- **Operon Detection**: We automatically check if your circuit makes sense and highlight any genetic operons
- **DNA Manipulation**: Copy, paste, delete, and flip DNA sequences around - all the basics you'd expect

### Run Simulations
- **Deterministic Simulation**: Fast and smooth using Runge-Kutta 4 (RK4) - great for getting quick results
- **Stochastic Simulation**: Uses the Gillespie algorithm to account for the randomness that happens in real cells
- **Flow Cytometry**: Run a bunch of stochastic simulations to see how a population of cells would behave
- **Hill Function Regulation**: Promoters can be turned on or off based on inhibitor/activator concentrations - just like in real biology
- **Polycistronic mRNA**: Build operons that make multiple proteins from one mRNA - because biology is efficient like that

### The Interface
- **Two Ways to View**: Switch between seeing the big picture (parts) or zooming in to see every base pair
- **Interactive Selection**: Click and drag to select DNA regions - it's pretty satisfying, honestly
- **Beautiful Charts**: Results show up as interactive Plotly charts so you can see how mRNA and proteins change over time
- **Export Your Work**: Save your simulation results and circuit designs for later

## What's Under the Hood?

### Frontend
- **React 18** with TypeScript (because type safety is your friend)
- **Vite** for lightning-fast development
- **Plotly.js** for those gorgeous interactive charts
- **react-dnd** for the drag-and-drop magic

### Backend
- **FastAPI** - it's fast, it's modern, we love it
- **NumPy** for all the number crunching
- **SciPy** for the heavy-duty scientific computing
- **Pydantic** to make sure your data is valid before we even touch it

## How to Use It

### Building a Circuit

1. **Add Components**: Just drag components from the library onto the DNA canvas - it's that simple
2. **Build Operons**: Put components in the right order: Promoter → RBS → Gene(s) → Terminator
3. **Custom Promoters**: Click the "+" button in the Promoters section if you want to make something custom
4. **Switch Views**: Use the zoom controls to toggle between seeing the big picture or every single base pair

### Running Simulations

1. **Design Your Circuit**: First, build at least one complete operon (you know, Promoter → RBS → Gene → Terminator)
2. **Open Simulation Panel**: Click the "Simulation" button
3. **Pick Your Method**:
   - **Deterministic**: Fast and smooth - perfect for quick checks
   - **Stochastic**: Accounts for randomness - more realistic but slower
   - **Flow Cytometer**: Run many stochastic simulations to see population-level behavior
4. **Set Your Parameters**: Choose your time range, number of runs (for flow cytometry), and all that good stuff
5. **Hit Run**: Click "Run Simulation" and watch the magic happen
6. **Check Results**: You'll see interactive charts showing how mRNA and protein concentrations change over time

### Editing DNA

- **Select DNA**: Click and drag on the DNA strand to select regions
- **Delete**: Press Delete/Backspace to remove selected DNA and any components that overlap
- **Copy/Paste**: Standard shortcuts work here - Ctrl+C / Ctrl+V (or Cmd on Mac)
- **Reverse Complement**: Right-click on your selection for more options

## Want to Contribute?

We'd love to have you! Feel free to submit a Pull Request. If you're planning something big, maybe open an issue first so we can chat about it.

## Thanks & Credits

- Built with [FastAPI](https://fastapi.tiangolo.com/) - seriously, it's amazing
- Charts powered by [Plotly.js](https://plotly.com/javascript/) - they make everything look good
- UI built with [React](https://react.dev/) - because it just works

## Need Help?

Found a bug? Have a question? Want to suggest a feature? Just open an issue on GitHub and we'll take a look!
