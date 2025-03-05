import { Directive, ElementRef, inject, TemplateRef } from '@angular/core';
import { MtxSplitPaneComponent } from '../split-pane/split-pane.component';

export interface MtxSplitGutterTemplateContext {
  /**
   * The pane before the gutter.
   * In RTL the right pane and in LTR the left pane
   */
  paneBefore: MtxSplitPaneComponent;
  /**
   * The pane after the gutter.
   * In RTL the left pane and in LTR the right pane
   */
  paneAfter: MtxSplitPaneComponent;
  /**
   * The absolute number of the gutter based on direction (RTL and LTR).
   * First gutter is 1, second is 2, etc...
   */
  gutterNum: number;
  /**
   * Whether this is the first gutter.
   * In RTL the most right pane and in LTR the most left pane
   */
  first: boolean;
  /**
   * Whether this is the last gutter.
   * In RTL the most left pane and in LTR the most right pane
   */
  last: boolean;
  /**
   * Whether the gutter is being dragged now
   */
  isDragged: boolean;
}

@Directive({
  selector: '[mtx-split-gutter]',
  standalone: true,
})
export class MtxSplitGutterDirective {
  readonly template = inject<TemplateRef<MtxSplitGutterTemplateContext>>(TemplateRef);

  /**
   * The map holds reference to the drag handle elements inside instances
   * of the provided template.
   *
   * @internal
   */
  readonly _gutterToHandleElementMap = new Map<number, ElementRef<HTMLElement>[]>();
  /**
   * The map holds reference to the excluded drag elements inside instances
   * of the provided template.
   *
   * @internal
   */
  readonly _gutterToExcludeDragElementMap = new Map<number, ElementRef<HTMLElement>[]>();

  /**
   * @internal
   */
  _canStartDragging(originElement: HTMLElement, gutterNum: number) {
    if (this._gutterToExcludeDragElementMap.has(gutterNum)) {
      const isInsideExclude = this._gutterToExcludeDragElementMap
        .get(gutterNum)!
        .some(gutterExcludeElement => gutterExcludeElement.nativeElement.contains(originElement));

      if (isInsideExclude) {
        return false;
      }
    }

    if (this._gutterToHandleElementMap.has(gutterNum)) {
      return this._gutterToHandleElementMap
        .get(gutterNum)!
        .some(gutterHandleElement => gutterHandleElement.nativeElement.contains(originElement));
    }

    return true;
  }

  /**
   * @internal
   */
  _addToMap(
    map: Map<number, ElementRef<HTMLElement>[]>,
    gutterNum: number,
    elementRef: ElementRef<HTMLElement>
  ) {
    if (map.has(gutterNum)) {
      map.get(gutterNum)!.push(elementRef);
    } else {
      map.set(gutterNum, [elementRef]);
    }
  }

  /**
   * @internal
   */
  _removedFromMap(
    map: Map<number, ElementRef<HTMLElement>[]>,
    gutterNum: number,
    elementRef: ElementRef<HTMLElement>
  ) {
    const elements = map.get(gutterNum);

    if (elements) {
      elements.splice(elements.indexOf(elementRef), 1);
      if (elements.length === 0) {
        map.delete(gutterNum);
      }
    }
  }

  static ngTemplateContextGuard(
    _dir: MtxSplitGutterDirective,
    ctx: unknown
  ): ctx is MtxSplitGutterTemplateContext {
    return true;
  }
}
