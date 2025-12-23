import { CircuitModel, SimulationCircuit } from '../models/CircuitModel'

/**
 * Export circuit to JSON format for simulation
 */
export function exportToJSON(circuit: CircuitModel): SimulationCircuit {
  return circuit.toSimulationFormat()
}

/**
 * Export circuit to SBML (Systems Biology Markup Language)
 * Simplified version - would need full SBML library for complete implementation
 */
export function exportToSBML(circuit: CircuitModel): string {
  const simCircuit = circuit.toSimulationFormat()
  
  let sbml = `<?xml version="1.0" encoding="UTF-8"?>
<sbml xmlns="http://www.sbml.org/sbml/level3/version2/core" level="3" version="2">
  <model id="${sanitizeId(simCircuit.name)}" name="${simCircuit.name}">
    <listOfCompartments>
      <compartment id="cell" spatialDimensions="3" size="1" constant="true"/>
    </listOfCompartments>
    
    <listOfSpecies>
`

  // Create species for each gene product
  simCircuit.operons.forEach((operon) => {
    operon.genes.forEach((gene) => {
      const speciesId = `${sanitizeId(gene.name)}_protein`
      sbml += `      <species id="${speciesId}" name="${gene.product}" compartment="cell" initialConcentration="0" hasOnlySubstanceUnits="false" boundaryCondition="false" constant="false"/>\n`
    })
  })

  sbml += `    </listOfSpecies>
    
    <listOfReactions>
`

  // Create transcription/translation reactions for each operon
  simCircuit.operons.forEach((operon) => {
    operon.genes.forEach((gene) => {
      const reactionId = `transcription_${sanitizeId(gene.name)}`
      const productId = `${sanitizeId(gene.name)}_protein`
      
      sbml += `      <reaction id="${reactionId}" reversible="false">
        <listOfProducts>
          <speciesReference species="${productId}" stoichiometry="1" constant="true"/>
        </listOfProducts>
        <kineticLaw>
          <math xmlns="http://www.w3.org/1998/Math/MathML">
            <apply>
              <times/>
              <ci>k_transcription</ci>
              <ci>promoter_strength</ci>
              <ci>rbs_strength</ci>
            </apply>
          </math>
          <listOfParameters>
            <parameter id="k_transcription" value="1.0" units="per_second"/>
            <parameter id="promoter_strength" value="${operon.promoter.strength}" units="dimensionless"/>
            <parameter id="rbs_strength" value="${gene.rbsStrength}" units="dimensionless"/>
          </listOfParameters>
        </kineticLaw>
      </reaction>
`
      
      // Add degradation reaction
      const degradationId = `degradation_${sanitizeId(gene.name)}`
      sbml += `      <reaction id="${degradationId}" reversible="false">
        <listOfReactants>
          <speciesReference species="${productId}" stoichiometry="1" constant="true"/>
        </listOfReactants>
        <kineticLaw>
          <math xmlns="http://www.w3.org/1998/Math/MathML">
            <apply>
              <times/>
              <ci>k_degradation</ci>
              <ci>${productId}</ci>
            </apply>
          </math>
          <listOfParameters>
            <parameter id="k_degradation" value="0.1" units="per_second"/>
          </listOfParameters>
        </kineticLaw>
      </reaction>
`
    })
  })

  sbml += `    </listOfReactions>
  </model>
</sbml>`

  return sbml
}

/**
 * Export circuit to SBOL (Synthetic Biology Open Language)
 * Simplified version - would need full SBOL library for complete implementation
 */
export function exportToSBOL(circuit: CircuitModel): string {
  const simCircuit = circuit.toSimulationFormat()
  const elements = circuit.getElements()
  
  let sbol = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:sbol="http://sbols.org/v2#"
         xmlns:dcterms="http://purl.org/dc/terms/">
         
  <sbol:ComponentDefinition rdf:about="http://genesim.org/${sanitizeId(simCircuit.name)}">
    <dcterms:title>${simCircuit.name}</dcterms:title>
    <dcterms:description>Genetic circuit exported from GeneSim</dcterms:description>
    <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
    <sbol:role rdf:resource="http://identifiers.org/so/SO:0000804"/>
    
    <sbol:sequenceAnnotation>
`

  // Add sequence annotations for each component
  elements.forEach((element, idx) => {
    sbol += `      <sbol:SequenceAnnotation rdf:about="http://genesim.org/${sanitizeId(simCircuit.name)}/annotation_${idx}">
        <dcterms:title>${element.name}</dcterms:title>
        <sbol:location>
          <sbol:Range>
            <sbol:start>${element.startBp}</sbol:start>
            <sbol:end>${element.endBp}</sbol:end>
          </sbol:Range>
        </sbol:location>
        <sbol:roleIntegration rdf:resource="http://sbols.org/v2#merge"/>
        <sbol:component>
          <sbol:ComponentDefinition rdf:about="http://genesim.org/${sanitizeId(element.name)}">
            <dcterms:title>${element.name}</dcterms:title>
            <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
            <sbol:role rdf:resource="${getSBOLRole(element.type)}"/>
          </sbol:ComponentDefinition>
        </sbol:component>
      </sbol:SequenceAnnotation>
`
  })

  sbol += `    </sbol:sequenceAnnotation>
  </sbol:ComponentDefinition>
</rdf:RDF>`

  return sbol
}

/**
 * Export circuit to CSV format (simple table)
 */
export function exportToCSV(circuit: CircuitModel): string {
  const elements = circuit.getElements()
  const operons = circuit.detectOperons()
  
  let csv = 'Type,Name,Start BP,End BP,Length,Operon\n'
  
  elements.forEach(element => {
    // Find which operon this element belongs to
    const operon = operons.find(op => 
      element.startBp >= op.startBp && element.endBp <= op.endBp
    )
    
    csv += `${element.type},${element.name},${element.startBp},${element.endBp},${element.endBp - element.startBp},${operon ? operon.id : 'none'}\n`
  })
  
  return csv
}

/**
 * Export operons as JSON
 */
export function exportOperonsJSON(circuit: CircuitModel): string {
  const operons = circuit.detectOperons()
  return JSON.stringify({
    operons: operons.map(operon => ({
      id: operon.id,
      promoter: operon.promoter.name,
      genes: operon.rbsGenePairs.map(pair => ({
        rbs: pair.rbs.name,
        gene: pair.gene.name,
      })),
      terminator: operon.terminator?.name || null,
      startBp: operon.startBp,
      endBp: operon.endBp,
      isValid: operon.isValid,
      warnings: operon.warnings,
    })),
  }, null, 2)
}

/**
 * Export circuit statistics
 */
export function exportStatistics(circuit: CircuitModel): string {
  const stats = circuit.getStatistics()
  const operons = circuit.detectOperons()
  const validation = circuit.validateCircuit()
  
  return JSON.stringify({
    statistics: {
      totalElements: stats.totalElements,
      typeCounts: stats.typeCounts,
      totalDNALength: stats.totalLength,
      coveragePercent: stats.coveragePercent.toFixed(2),
    },
    operons: {
      total: operons.length,
      valid: operons.filter(op => op.isValid).length,
      invalid: operons.filter(op => !op.isValid).length,
    },
    validation: {
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
    },
  }, null, 2)
}

/**
 * Download a string as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Helper function to sanitize IDs for XML/SBML/SBOL
 */
function sanitizeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1') // IDs can't start with numbers
}

/**
 * Get SBOL role URI for a component type
 */
function getSBOLRole(type: string): string {
  const roles: Record<string, string> = {
    promoter: 'http://identifiers.org/so/SO:0000167',
    rbs: 'http://identifiers.org/so/SO:0000139',
    gene: 'http://identifiers.org/so/SO:0000316',
    terminator: 'http://identifiers.org/so/SO:0000141',
    operator: 'http://identifiers.org/so/SO:0000057',
    other: 'http://identifiers.org/so/SO:0000001',
  }
  return roles[type] || roles.other
}

