import React, { useEffect, useRef, MouseEvent } from 'react';
import _ from 'lodash';

import { Point } from 'types';
import { SolidData } from 'math/polyhedra';

// Join a list of lists with an inner and outer separator.
function joinListOfLists<T>(list: T[][], outerSep: string, innerSep: string) {
  return _.map(list, elem => elem.join(innerSep)).join(outerSep);
}

const Coordinates = ({ points }: { points: Point[] }) => {
  return <coordinate is="x3d" point={joinListOfLists(points, ', ', ' ')} />;
};

/* Edges */

const Edges = ({
  edges = [],
  vertices = [],
}: Pick<SolidData, 'edges' | 'vertices'>) => {
  return (
    <shape is="x3d">
      <indexedlineset is="x3d" coordindex={joinListOfLists(edges, ' -1 ', ' ')}>
        <Coordinates points={vertices} />
      </indexedlineset>
    </shape>
  );
};

interface X3dEvent extends MouseEvent {
  hitPnt: Point;
}

interface SolidConfig {
  showFaces: boolean;
  showEdges: boolean;
  showInnerFaces: boolean;
  opacity: number;
}

interface Props {
  value: SolidData;
  colors: number[][];
  config?: SolidConfig;
  onHover?: (p: Point) => void;
  onMouseOut?: () => void;
  onClick?: (p: Point) => void;
}

const defaultConfig = {
  showFaces: true,
  showEdges: true,
  showInnerFaces: true,
  opacity: 0.7,
};

export default function X3dPolyhedron({
  value,
  colors,
  config = defaultConfig,
  onHover = _.noop,
  onMouseOut = _.noop,
  onClick = _.noop,
}: Props) {
  const shape = useRef<any>(null);
  const hitPnt = useRef<Point | null>(null);

  const { vertices, faces, edges } = value;
  const { showFaces, showEdges, showInnerFaces, opacity } = config;

  const listeners = {
    mousedown(e: X3dEvent) {
      hitPnt.current = e.hitPnt;
    },
    mouseup(e: X3dEvent) {
      if (!_.isEqual(hitPnt.current, e.hitPnt)) return;
      onClick(e.hitPnt);
    },
    mousemove(e: X3dEvent) {
      hitPnt.current = e.hitPnt;
      onHover(e.hitPnt);
    },
    mouseout() {
      onMouseOut();
    },
  };

  useEffect(() => {
    _.forEach(listeners, (fn, type) => {
      if (shape.current !== null) {
        shape.current.addEventListener(type, fn);
      }
    });

    return () => {
      _.forEach(listeners, (fn, type) => {
        // The X3DOM node isn't managed by React so this rule doesn't apply
        // If we store this in a var this causes a type error
        // eslint-disable-next-line
        const shapeNode = shape.current;
        if (shapeNode !== null) {
          shapeNode.removeEventListener(type, fn);
        }
      });
    };
  }, [listeners]);

  const colorStr = joinListOfLists(colors, ',', ' ');
  return (
    <>
      {showFaces && (
        // NOTE: The mouse handlers are duplicated to make it easy to test on enzyme.
        // They don't actually do anything in production
        <shape
          is="x3d"
          ref={shape}
          onMouseDown={listeners.mousedown}
          onMouseMove={listeners.mousemove}
          onMouseUp={listeners.mouseup}
          onMouseOut={listeners.mouseout}
        >
          <appearance is="x3d">
            <material is="x3d" transparency={1 - opacity} />
          </appearance>
          <indexedfaceset
            is="x3d"
            solid={(!showInnerFaces).toString()}
            colorpervertex="false"
            coordindex={joinListOfLists(faces, ' -1 ', ' ')}
          >
            <Coordinates points={vertices} />
            <color is="x3d" color={colorStr} />
          </indexedfaceset>
        </shape>
      )}
      {showEdges && <Edges edges={edges} vertices={vertices} />}
    </>
  );
}
