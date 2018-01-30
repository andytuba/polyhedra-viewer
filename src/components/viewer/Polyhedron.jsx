import React, { Component } from 'react'
import { Motion, spring, presets } from 'react-motion'
import { rgb } from 'd3-color'
import _ from 'lodash'
import { connect } from 'react-redux'
import { createStructuredSelector } from 'reselect'
import EventListener from 'react-event-listener'

import polygons from 'constants/polygons'
import {
  getPolyhedron,
  getPolyhedronConfig,
  getOperation,
  getApplyOpts,
  getAugments,
} from 'selectors'
import { applyOperation } from 'actions'
import { mapObject } from 'util.js'
import { getAugmentFace } from 'math/operations'

// Join a list of lists with an inner and outer separator.
export const joinListOfLists = (list, outerSep, innerSep) => {
  return list.map(elem => elem.join(innerSep)).join(outerSep)
}

const Coordinates = ({ points }) => {
  // We pad the number of points in case we move from a solid with more vertices
  // to one with less, so that x3dom does accidentally map an index to a non-existing point
  const buffer = _.times(100, _.constant([0, 0, 0]))
  const bufferedPoints = points.concat(buffer)

  return <coordinate point={joinListOfLists(bufferedPoints, ', ', ' ')} />
}

/* Faces */

// Convert the hex color to RGB
const toRgb = hex =>
  ['r', 'g', 'b'].map(_.propertyOf(rgb(hex))).map(d => d / 255)
const colorIndexForFace = mapObject(polygons, (n, i) => [n, i])
const getColorIndex = face => colorIndexForFace[face.length]
const polygonColors = colors => polygons.map(n => toRgb(colors[n]))
const getColorAttr = colors =>
  joinListOfLists(
    _.flatMap(_.range(100), () => polygonColors(colors)).concat([[0, 1, 0]]),
    ',',
    ' ',
  )

class Faces extends Component {
  state = {
    applyArgs: null,
    error: null,
  }

  getColors = () => {
    // const buffer = _.times(100, _.constant([0, 0, 0]))
    const { solidData: { faces }, config: { colors } } = this.props
    const { applyArgs } = this.state
    const defaultColors = polygonColors(colors)
    const buffer = _.times(100, _.constant([0, 0, 0]))
    const foo = joinListOfLists(
      faces
        .map((face, fIndex) => {
          if (_.isNumber(applyArgs) && fIndex === applyArgs) {
            return [0, 1, 0]
          }
          if (
            _.isObject(applyArgs) &&
            _.includes(applyArgs.faceIndices(), fIndex)
          ) {
            return [1, 1, 0]
          }
          return defaultColors[getColorIndex(face)]
        })
        .concat(buffer),
      ',',
      ' ',
    )
    console.log(foo)
    return foo
  }

  render() {
    const { solidData, config } = this.props
    const { applyArgs, error } = this.state
    const { opacity, colors } = config
    const { vertices, faces } = solidData
    // this.getColors()

    if (error) {
      throw error
    }
    // TODO implement highlighting
    // NOTE: The mouse handlers are duplicated to make it easy to test on enzyme.
    // They don't actually do anything in production
    // colorindex={faces.map(this.getColors).join(' ')}
    return (
      <shape
        ref={shape => (this.shape = shape)}
        onMouseDown={this.handleMouseDown}
        onMouseMove={this.handleMouseMove}
        onMouseUp={this.handleMouseUp}
      >
        <EventListener target="document" onLoad={_.once(this.handleLoad)} />
        <appearance>
          <material transparency={1 - opacity} />
        </appearance>
        <indexedfaceset
          solid="true"
          colorpervertex="false"
          coordindex={joinListOfLists(faces, ' -1 ', ' ')}
        >
          <Coordinates points={vertices} />
          <color color={this.getColors()} />
        </indexedfaceset>
      </shape>
    )
  }

  // Manually adding event listeners swallows errors, so we have to store it in the component itself
  wrapError = fn => event => {
    try {
      fn(event)
    } catch (error) {
      this.setState({ error })
    }
  }

  addEventListener(type, fn) {
    this.shape.addEventListener(type, this.wrapError(fn))
  }

  handleLoad = () => {
    this.addEventListener('mousedown', this.handleMouseDown)
    this.addEventListener('mouseup', this.handleMouseUp)
    this.addEventListener('mousemove', this.handleMouseMove)
  }

  handleMouseDown = () => {
    // logic to ensure drags aren't registered as clicks
    this.drag = false
  }

  handleMouseUp = () => {
    if (this.drag) return
    const { operation, options, solidData, applyOperation } = this.props
    const { applyArgs } = this.state

    if (operation && !_.isNil(applyArgs)) {
      applyOperation(operation, solidData, applyArgs, options)
      this.setState({ applyArgs: null })
    }
  }

  handleMouseMove = event => {
    // TODO replace this with logs
    this.drag = true
    const { solidData, operation, augments } = this.props
    console.log('operation', operation)
    switch (operation) {
      case '+':
        const fIndex = getAugmentFace(solidData, event.hitPnt, augments)
        console.log('fIndex', fIndex)
        this.setState({
          applyArgs: fIndex === -1 ? null : fIndex,
        })
        this.forceUpdate()
        return
      case '-':
      case 'g':
        const peak = solidData.findPeak(event.hitPnt)
        console.log('peak', peak && peak.innerVertexIndices())
        this.setState({
          applyArgs: peak,
        })
        return
      default:
        return
    }
  }
}

const ConnectedFaces = connect(
  createStructuredSelector({
    operation: getOperation,
    options: getApplyOpts,
    augments: getAugments,
  }),
  { applyOperation },
)(Faces)

/* Edges */

const Edges = ({ edges, vertices }) => {
  return (
    <shape>
      <indexedlineset coordindex={joinListOfLists(edges, ' -1 ', ' ')}>
        <Coordinates points={vertices} />
      </indexedlineset>
    </shape>
  )
}

/* Polyhedron */

// const getScaleAttr = scale => `${scale} ${scale} ${scale}`

class Polyhedron extends Component {
  // TODO color
  render() {
    const { config, solidData } = this.props
    const { showEdges, showFaces } = config
    const { vertices, edges } = solidData
    const toggle = 1

    return (
      <Motion
        defaultStyle={{ scale: 0 }}
        style={{ scale: spring(toggle, presets.noWobble) }}
      >
        {({ scale }) => {
          return (
            <transform>
              {showFaces && (
                <ConnectedFaces solidData={solidData} config={config} />
              )}
              {showEdges && <Edges edges={edges} vertices={vertices} />}
            </transform>
          )
        }}
      </Motion>
    )
  }
}

const mapStateToProps = createStructuredSelector({
  config: getPolyhedronConfig,
  solidData: getPolyhedron,
})

export default connect(mapStateToProps)(Polyhedron)
