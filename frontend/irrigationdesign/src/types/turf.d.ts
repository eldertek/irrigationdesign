declare module '@turf/turf' {
  export function polygon(coordinates: number[][][]): any;
  export function lineString(coordinates: number[][]): any;
  export function area(polygon: any): number;
  export function length(line: any, options?: { units: string }): number;
  export function distance(point1: number[], point2: number[], options?: { units: string }): number;
} 