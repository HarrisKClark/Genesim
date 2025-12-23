declare module 'react-plotly.js' {
  import { Component } from 'react'
  import { PlotParams } from 'plotly.js'

  export interface PlotParams extends PlotParams {}
  
  export default class Plot extends Component<PlotParams> {}
}

