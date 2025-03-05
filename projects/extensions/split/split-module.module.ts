import { NgModule } from '@angular/core';
import { MtxSplitPaneComponent } from './split-pane/split-pane.component';
import { MtxSplitComponent } from './split/split.component';
import { MtxSplitGutterDirective } from './gutter/split-gutter.directive';
import { MtxSplitGutterDragHandleDirective } from './gutter/split-gutter-drag-handle.directive';
import { MtxSplitGutterExcludeFromDragDirective } from './gutter/split-gutter-exclude-from-drag.directive';

@NgModule({
  imports: [
    MtxSplitComponent,
    MtxSplitPaneComponent,
    MtxSplitGutterDirective,
    MtxSplitGutterDragHandleDirective,
    MtxSplitGutterExcludeFromDragDirective,
  ],
  exports: [
    MtxSplitComponent,
    MtxSplitPaneComponent,
    MtxSplitGutterDirective,
    MtxSplitGutterDragHandleDirective,
    MtxSplitGutterExcludeFromDragDirective,
  ],
})
export class MtxSplitModule {}
