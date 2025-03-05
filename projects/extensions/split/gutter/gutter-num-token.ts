import { InjectionToken } from '@angular/core';

/**
 * Identifies the gutter by number through DI
 * to allow SplitGutterDragHandleDirective and SplitGutterExcludeFromDragDirective to know
 * the gutter template context without inputs
 */
export const MTX_GUTTER_NUM_TOKEN = new InjectionToken<number>('Mtx Gutter num');
