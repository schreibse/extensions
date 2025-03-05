import { InjectionToken, Provider, inject } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { MtxSplitDir, MtxSplitDirection, MtxSplitUnit } from './models';

export interface MtxSplitDefaultOptions {
  dir: MtxSplitDir;
  color?: ThemePalette;
  direction: MtxSplitDirection;
  disabled: boolean;
  gutterDblClickDuration: number;
  gutterSize: number;
  gutterStep: number;
  gutterClickDeltaPx: number;
  restrictMove: boolean;
  unit: MtxSplitUnit;
  useTransition: boolean;
}

const defaultOptions: MtxSplitDefaultOptions = {
  dir: 'ltr',
  direction: 'horizontal',
  disabled: false,
  gutterDblClickDuration: 0,
  gutterSize: 4,
  gutterStep: 1,
  gutterClickDeltaPx: 2,
  restrictMove: false,
  unit: 'percent',
  useTransition: false,
};

export const MTX_SPLIT_DEFAULT_OPTIONS = new InjectionToken<MtxSplitDefaultOptions>(
  'mtx-split-global-config',
  { providedIn: 'root', factory: () => defaultOptions }
);

/**
 * Provides default options for angular split. The options object has hierarchical inheritance
 * which means only the declared properties will be overridden
 */
export function provideAngularSplitOptions(options: Partial<MtxSplitDefaultOptions>): Provider {
  return {
    provide: MTX_SPLIT_DEFAULT_OPTIONS,
    useFactory: (): MtxSplitDefaultOptions => ({
      ...inject(MTX_SPLIT_DEFAULT_OPTIONS, { skipSelf: true }),
      ...options,
    }),
  };
}
