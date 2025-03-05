import { Directive, OnDestroy, ElementRef, inject } from '@angular/core';
import { MtxSplitGutterDirective } from './split-gutter.directive';
import { MTX_GUTTER_NUM_TOKEN } from './gutter-num-token';

@Directive({
  selector: '[mtx-split-gutter-exclude-from-drag]',
  standalone: true,
})
export class MtxSplitGutterExcludeFromDragDirective implements OnDestroy {
  private readonly gutterNum = inject(MTX_GUTTER_NUM_TOKEN);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly gutterDir = inject(MtxSplitGutterDirective);

  constructor() {
    this.gutterDir._addToMap(
      this.gutterDir._gutterToExcludeDragElementMap,
      this.gutterNum,
      this.elementRef
    );
  }

  ngOnDestroy(): void {
    this.gutterDir._removedFromMap(
      this.gutterDir._gutterToExcludeDragElementMap,
      this.gutterNum,
      this.elementRef
    );
  }
}
